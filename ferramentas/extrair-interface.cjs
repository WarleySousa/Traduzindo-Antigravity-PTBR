// Extrai os arquivos da interface web embutidos (em ZIP) no language_server.exe.
// Uso: node ferramentas/extrair-interface.cjs <language_server.exe> <pasta de saída>
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const [binPath, outDir] = process.argv.slice(2);
if (!binPath || !outDir) {
  console.error("Uso: node ferramentas/extrair-interface.cjs <language_server.exe> <pasta de saída>");
  process.exit(1);
}

const bin = fs.readFileSync(binPath);
const WANTED = new Set(["main.js", "index.html"]);

// Procura cada registro de fim de diretório central (PK\x05\x06) e verifica se o ZIP contém main.js.
let eocd = -1;
for (let i = bin.length - 22; (i = bin.lastIndexOf("PK\x05\x06", i)) >= 0; i--) {
  const entries = bin.readUInt16LE(i + 10);
  const cdSize = bin.readUInt32LE(i + 12);
  const cdStart = i - cdSize;
  if (cdStart < 0 || bin.readUInt32LE(cdStart) !== 0x02014b50) continue;
  if (bin.subarray(cdStart, i).includes("main.js") && entries > 0) {
    eocd = i;
    break;
  }
}
if (eocd < 0) {
  console.error("Não encontrei a interface embutida neste arquivo.");
  process.exit(1);
}

const entries = bin.readUInt16LE(eocd + 10);
const cdSize = bin.readUInt32LE(eocd + 12);
const cdOffset = bin.readUInt32LE(eocd + 16);
const cdStart = eocd - cdSize;
const zipStart = cdStart - cdOffset;

fs.mkdirSync(outDir, { recursive: true });
let p = cdStart;
for (let n = 0; n < entries; n++) {
  const method = bin.readUInt16LE(p + 10);
  const compSize = bin.readUInt32LE(p + 20);
  const nameLen = bin.readUInt16LE(p + 28);
  const extraLen = bin.readUInt16LE(p + 30);
  const commentLen = bin.readUInt16LE(p + 32);
  const localOffset = bin.readUInt32LE(p + 42);
  const name = bin.subarray(p + 46, p + 46 + nameLen).toString("utf8");
  p += 46 + nameLen + extraLen + commentLen;
  if (!WANTED.has(name)) continue;

  const lh = zipStart + localOffset;
  const dataStart = lh + 30 + bin.readUInt16LE(lh + 26) + bin.readUInt16LE(lh + 28);
  const raw = bin.subarray(dataStart, dataStart + compSize);
  const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
  fs.writeFileSync(path.join(outDir, name), data);
  console.log(`${name}: ${data.length} bytes`);
}
