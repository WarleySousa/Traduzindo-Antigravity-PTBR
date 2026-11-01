// Instala, remove e verifica a tradução PT-BR do Antigravity.
//
// Uso (normalmente pelos atalhos .bat, com o próprio Antigravity.exe no modo Node):
//   ptbr.cjs instalar  [pasta do Antigravity]
//   ptbr.cjs restaurar [pasta do Antigravity]
//   ptbr.cjs status    [pasta do Antigravity]
"use strict";

// Ao rodar dentro do Electron, desliga o suporte a ASAR do fs para ler o app.asar como arquivo comum.
process.noAsar = true;

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { AsarArchive, writeWithReplacements } = require("../lib/asar.cjs");

const PROJETO = path.resolve(__dirname, "..");
const MARCA = "/* antigravity-ptbr:WarleySousa */";
const PRELOAD = "dist/preload.js";
const PASTA_BACKUP = "_ptbr-backup";

const cores = { verde: 32, amarelo: 33, vermelho: 31, ciano: 36 };
const pintar = (cor, texto) => (process.stdout.isTTY ? `\x1b[${cores[cor]}m${texto}\x1b[0m` : texto);
const info = (t) => console.log(t);
const ok = (t) => console.log(pintar("verde", t));
const aviso = (t) => console.log(pintar("amarelo", t));

class Falha extends Error {}

function sha256(arquivo) {
  return crypto.createHash("sha256").update(fs.readFileSync(arquivo)).digest("hex");
}

function encontrarInstalacao(pasta) {
  const candidatas = pasta
    ? [pasta]
    : [path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Programs", "antigravity")];
  for (const c of candidatas) {
    if (fs.existsSync(path.join(c, "resources", "app.asar")) && fs.existsSync(path.join(c, "Antigravity.exe"))) return c;
  }
  throw new Falha(`Não encontrei o Antigravity em: ${candidatas.join(", ")}\nInforme a pasta de instalação como parâmetro.`);
}

function lerPacote(asar) {
  const a = new AsarArchive(asar);
  try {
    const pacote = JSON.parse(a.read("package.json").toString("utf8"));
    const preload = a.read(PRELOAD);
    if (!preload) throw new Falha("Este Antigravity não tem o preload esperado; a versão não é compatível.");
    return { versao: pacote.version, preload: preload.toString("utf8"), arquivo: a };
  } catch (e) {
    a.close();
    throw e;
  }
}

function estaTraduzido(asar) {
  const { preload, arquivo } = lerPacote(asar);
  arquivo.close();
  return preload.includes(MARCA);
}

// O Electron pode exigir que o app.asar bata com um hash gravado no executável (fuse de integridade).
// Se esse fuse estiver ligado, alterar o app.asar impediria o aplicativo de abrir.
function verificarFuseDeIntegridade(exe) {
  const bin = fs.readFileSync(exe);
  const sentinela = bin.indexOf("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX");
  if (sentinela < 0) return;
  const inicio = sentinela + 32;
  const quantidade = bin[inicio + 1];
  const fuses = bin.subarray(inicio + 2, inicio + 2 + quantidade).toString("latin1");
  if (fuses[4] === "1") {
    throw new Falha("Esta versão do Antigravity valida a integridade do app.asar; a tradução não pode ser aplicada com segurança.");
  }
}

// Detecta modificações feitas por outros pacotes de tradução, para não guardar uma cópia alterada como original.
function verificarOriginal(instalacao, asar) {
  if (fs.existsSync(path.join(instalacao, "resources", "web-bundle"))) {
    throw new Falha(
      "Encontrei a pasta resources\\web-bundle, que não faz parte do Antigravity original.\n" +
        "Outro pacote de tradução parece estar instalado. Restaure-o ou reinstale o Antigravity e tente de novo."
    );
  }
  const a = new AsarArchive(asar);
  const ls = (a.read("dist/languageServer.js") || Buffer.alloc(0)).toString("utf8");
  a.close();
  if (ls.includes("web_bundle_path")) {
    throw new Falha("O app.asar foi modificado por outro pacote de tradução. Reinstale o Antigravity e tente de novo.");
  }
}

// Considera só os processos desta instalação (e ignora o próprio instalador, que roda no Antigravity.exe).
function antigravityAberto(instalacao) {
  const exe = path.join(instalacao, "Antigravity.exe").toLowerCase();
  try {
    const saida = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='Antigravity.exe'\" | ForEach-Object { \"$($_.ProcessId)|$($_.ExecutablePath)\" }",
      ],
      { encoding: "utf8", windowsHide: true }
    );
    return saida
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => l.split("|"))
      .some(([pid, caminho]) => Number(pid) !== process.pid && (caminho || "").toLowerCase() === exe);
  } catch {
    return false;
  }
}

// traducao/pt-BR.json guarda os padrões e os textos do processo principal;
// traducao/textos/*.json guardam o dicionário da interface, dividido em lotes.
function carregarTraducao() {
  const pasta = path.join(PROJETO, "traducao");
  const dados = JSON.parse(fs.readFileSync(path.join(pasta, "pt-BR.json"), "utf8"));
  const textos = {};
  for (const nome of fs.readdirSync(path.join(pasta, "textos")).filter((n) => n.endsWith(".json")).sort()) {
    Object.assign(textos, JSON.parse(fs.readFileSync(path.join(pasta, "textos", nome), "utf8")));
  }
  return {
    textos,
    padroes: dados.padroes || [],
    processoPrincipal: dados.processoPrincipal || {},
  };
}

function montarTradutor(traducao) {
  const modelo = fs.readFileSync(path.join(PROJETO, "src", "tradutor-interface.js"), "utf8");
  const preenchido = modelo
    .replace("const DICIONARIO = __DICIONARIO__;", () => `const DICIONARIO = ${JSON.stringify(traducao.textos)};`)
    .replace("const PADROES = __PADROES__.", () => `const PADROES = ${JSON.stringify(traducao.padroes)}.`);
  if (/__DICIONARIO__|__PADROES__/.test(preenchido)) throw new Error("Modelo do tradutor inválido: marcadores não substituídos.");
  return preenchido;
}

function caminhosBackup(instalacao, versao) {
  const pasta = path.join(instalacao, PASTA_BACKUP, versao);
  return { pasta, asar: path.join(pasta, "app.asar"), info: path.join(pasta, "backup.json") };
}

function lerBackup(instalacao, versao) {
  const b = caminhosBackup(instalacao, versao);
  if (!fs.existsSync(b.asar) || !fs.existsSync(b.info)) return null;
  const meta = JSON.parse(fs.readFileSync(b.info, "utf8"));
  if (sha256(b.asar) !== meta.sha256) throw new Falha(`O backup em ${b.pasta} está corrompido. Reinstale o Antigravity.`);
  return b;
}

function criarBackup(instalacao, versao, asar) {
  const b = caminhosBackup(instalacao, versao);
  fs.mkdirSync(b.pasta, { recursive: true });
  fs.copyFileSync(asar, b.asar);
  fs.writeFileSync(
    b.info,
    JSON.stringify({ versao, sha256: sha256(b.asar), criadoEm: new Date().toISOString() }, null, 2) + "\n",
    "utf8"
  );
  return b;
}

function instalar(instalacao) {
  const asar = path.join(instalacao, "resources", "app.asar");
  verificarFuseDeIntegridade(path.join(instalacao, "Antigravity.exe"));
  const { versao, preload, arquivo } = lerPacote(asar);
  arquivo.close();
  info(`Antigravity ${versao} encontrado em ${instalacao}`);

  let original;
  if (preload.includes(MARCA)) {
    original = lerBackup(instalacao, versao);
    if (!original) throw new Falha("A tradução já está aplicada, mas o backup original sumiu. Reinstale o Antigravity.");
    info("Tradução já aplicada; reaplicando a partir do backup original.");
  } else {
    verificarOriginal(instalacao, asar);
    original = criarBackup(instalacao, versao, asar);
    info(`Backup do original salvo em ${original.pasta}`);
  }

  const traducao = carregarTraducao();
  const base = new AsarArchive(original.asar);
  const substituicoes = new Map();
  const preloadOriginal = base.read(PRELOAD).toString("utf8");
  substituicoes.set(PRELOAD, Buffer.from(`${preloadOriginal}\n${MARCA}\n${montarTradutor(traducao)}`, "utf8"));

  let pendentes = 0;
  for (const [arquivoJs, trocas] of Object.entries(traducao.processoPrincipal)) {
    const conteudo = base.read(arquivoJs);
    if (!conteudo) {
      aviso(`  Arquivo ${arquivoJs} não existe nesta versão; textos dele ficam em inglês.`);
      continue;
    }
    let texto = conteudo.toString("utf8");
    for (const [de, para] of trocas) {
      if (texto.includes(de)) texto = texto.split(de).join(para);
      else pendentes++;
    }
    substituicoes.set(arquivoJs, Buffer.from(texto, "utf8"));
  }
  base.close();

  const temporario = `${asar}.ptbr`;
  writeWithReplacements(original.asar, temporario, substituicoes);
  fs.renameSync(temporario, asar);

  if (pendentes > 0) aviso(`  ${pendentes} texto(s) do menu e das janelas não existem nesta versão e ficaram em inglês.`);
  ok(`Tradução aplicada: ${Object.keys(traducao.textos).length} textos da interface.`);
}

function restaurar(instalacao) {
  const asar = path.join(instalacao, "resources", "app.asar");
  const { versao, preload, arquivo } = lerPacote(asar);
  arquivo.close();
  if (!preload.includes(MARCA)) {
    ok("O Antigravity já está original; nada a restaurar.");
    return;
  }
  const original = lerBackup(instalacao, versao);
  if (!original) throw new Falha(`Não encontrei o backup da versão ${versao}. Reinstale o Antigravity para voltar ao original.`);
  fs.copyFileSync(original.asar, `${asar}.ptbr`);
  fs.renameSync(`${asar}.ptbr`, asar);
  ok(`Antigravity ${versao} restaurado para o original.`);
}

function status(instalacao) {
  const asar = path.join(instalacao, "resources", "app.asar");
  const { versao, arquivo } = lerPacote(asar);
  arquivo.close();
  const traduzido = estaTraduzido(asar);
  info(`Antigravity ${versao}: ${traduzido ? "traduzido para PT-BR" : "original (em inglês)"}`);
  info(`Backup do original: ${lerBackup(instalacao, versao) ? "presente" : "ausente"}`);
}

function main() {
  const [comando, pasta] = process.argv.slice(2);
  const acoes = { instalar, restaurar, status };
  if (!acoes[comando]) {
    console.error("Uso: ptbr.cjs <instalar|restaurar|status> [pasta do Antigravity]");
    process.exit(2);
  }
  try {
    const instalacao = encontrarInstalacao(pasta);
    if (comando !== "status" && antigravityAberto(instalacao)) {
      throw new Falha("Feche o Antigravity (inclusive o ícone na bandeja) antes de continuar.");
    }
    acoes[comando](instalacao);
  } catch (e) {
    console.error(pintar("vermelho", e instanceof Falha ? e.message : `Erro inesperado: ${e.stack || e}`));
    process.exit(1);
  }
}

main();
