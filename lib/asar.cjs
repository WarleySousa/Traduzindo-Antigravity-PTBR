// Leitura e escrita de arquivos ASAR (formato de pacote do Electron).
//
// Estrutura do arquivo:
//   [4 bytes: 4] [4 bytes: tamanho do bloco do cabeçalho]
//   [4 bytes: tamanho do pickle] [4 bytes: tamanho do JSON] [JSON] [preenchimento]
//   [conteúdo dos arquivos, na ordem dos offsets]
"use strict";

const fs = require("fs");
const crypto = require("crypto");

const BLOCK_SIZE = 4 * 1024 * 1024;

function readHeader(fd) {
  const prefix = Buffer.alloc(16);
  fs.readSync(fd, prefix, 0, 16, 0);
  const headerBlock = prefix.readUInt32LE(4);
  const jsonSize = prefix.readUInt32LE(12);
  const json = Buffer.alloc(jsonSize);
  fs.readSync(fd, json, 0, jsonSize, 16);
  return { header: JSON.parse(json.toString("utf8")), dataStart: 8 + headerBlock };
}

class AsarArchive {
  constructor(file) {
    this.file = file;
    this.fd = fs.openSync(file, "r");
    const { header, dataStart } = readHeader(this.fd);
    this.header = header;
    this.dataStart = dataStart;
  }

  close() {
    fs.closeSync(this.fd);
  }

  // Lista os arquivos (caminhos com "/"), sem incluir os que ficam fora do pacote.
  list() {
    const out = [];
    const walk = (node, prefix) => {
      for (const [name, entry] of Object.entries(node.files || {})) {
        const p = prefix ? `${prefix}/${name}` : name;
        if (entry.files) walk(entry, p);
        else if (!entry.link) out.push(p);
      }
    };
    walk(this.header, "");
    return out;
  }

  entry(p) {
    let node = this.header;
    for (const part of p.split("/")) {
      node = node.files && node.files[part];
      if (!node) return null;
    }
    return node;
  }

  read(p) {
    const e = this.entry(p);
    if (!e || e.files || e.unpacked || e.link) return null;
    const buf = Buffer.alloc(e.size);
    fs.readSync(this.fd, buf, 0, e.size, this.dataStart + Number(e.offset));
    return buf;
  }
}

function integrityOf(buf) {
  const blocks = [];
  for (let i = 0; i < buf.length; i += BLOCK_SIZE) {
    blocks.push(crypto.createHash("sha256").update(buf.subarray(i, i + BLOCK_SIZE)).digest("hex"));
  }
  if (blocks.length === 0) blocks.push(crypto.createHash("sha256").update(Buffer.alloc(0)).digest("hex"));
  return {
    algorithm: "SHA256",
    hash: crypto.createHash("sha256").update(buf).digest("hex"),
    blockSize: BLOCK_SIZE,
    blocks,
  };
}

// Gera um novo ASAR a partir de `source`, trocando o conteúdo dos arquivos em `replacements`
// (mapa caminho → Buffer). Arquivos desempacotados e links são mantidos como estão.
function writeWithReplacements(source, target, replacements) {
  const archive = new AsarArchive(source);
  const header = JSON.parse(JSON.stringify(archive.header));
  const chunks = [];
  let offset = 0;

  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files || {})) {
      const p = prefix ? `${prefix}/${name}` : name;
      if (entry.files) {
        walk(entry, p);
        continue;
      }
      if (entry.unpacked || entry.link) continue;
      const data = replacements.has(p) ? replacements.get(p) : archive.read(p);
      entry.offset = String(offset);
      entry.size = data.length;
      if (replacements.has(p) || entry.integrity) entry.integrity = integrityOf(data);
      chunks.push(data);
      offset += data.length;
    }
  };
  walk(header, "");
  archive.close();

  for (const p of replacements.keys()) {
    if (!chunks.length || !archiveHas(header, p)) throw new Error(`Arquivo não existe no pacote: ${p}`);
  }

  const json = Buffer.from(JSON.stringify(header), "utf8");
  const padded = (json.length + 3) & ~3;
  const headerBuf = Buffer.alloc(16 + padded);
  headerBuf.writeUInt32LE(4, 0);
  headerBuf.writeUInt32LE(8 + padded, 4);
  headerBuf.writeUInt32LE(4 + padded, 8);
  headerBuf.writeUInt32LE(json.length, 12);
  json.copy(headerBuf, 16);

  const tmp = `${target}.tmp`;
  const fd = fs.openSync(tmp, "w");
  fs.writeSync(fd, headerBuf);
  for (const c of chunks) fs.writeSync(fd, c);
  fs.closeSync(fd);
  fs.renameSync(tmp, target);
  return { headerHash: crypto.createHash("sha256").update(json).digest("hex") };
}

function archiveHas(header, p) {
  let node = header;
  for (const part of p.split("/")) {
    node = node.files && node.files[part];
    if (!node) return false;
  }
  return !node.files;
}

module.exports = { AsarArchive, writeWithReplacements };
