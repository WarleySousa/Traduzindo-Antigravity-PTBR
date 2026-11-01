// Lê os textos visíveis da janela do Antigravity aberta com --remote-debugging-port, para
// conferir a tradução. Lista os textos que continuam em inglês (não estão no dicionário).
// Uso: node ferramentas/inspecionar-janela.cjs [porta=9333]
"use strict";

const porta = Number(process.argv[2] || 9333);

async function avaliar(expressao) {
  const paginas = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
  const pagina = paginas.find((p) => p.type === "page" && /^https?:/.test(p.url));
  if (!pagina) throw new Error("Janela do Antigravity não encontrada.");
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((ok, erro) => {
    ws.onopen = ok;
    ws.onerror = erro;
  });
  const resposta = new Promise((ok) => {
    ws.onmessage = (m) => {
      const dados = JSON.parse(m.data);
      if (dados.id === 1) ok(dados.result);
    };
  });
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expressao, returnByValue: true } }));
  const resultado = await resposta;
  ws.close();
  return resultado.result.value;
}

const COLETAR = `(() => {
  const textos = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim();
    const el = n.parentElement;
    if (!t || !el || el.closest("script, style, code, pre, textarea, [contenteditable='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    textos.add(t);
  }
  for (const el of document.querySelectorAll("[placeholder], [title], [aria-label]")) {
    for (const a of ["placeholder", "title", "aria-label"]) if (el.getAttribute(a)) textos.add(el.getAttribute(a).trim());
  }
  return { lang: document.documentElement.lang, textos: [...textos] };
})()`;

avaliar(COLETAR)
  .then(({ lang, textos }) => {
    const ingles = textos.filter((t) => /[A-Za-z]{3}/.test(t) && !/[áàâãéêíóôõúçÁÉÍÓÚÇ]/.test(t));
    console.log(`lang=${lang} — ${textos.length} textos visíveis`);
    console.log(JSON.stringify(textos, null, 1));
    console.log("\nPossivelmente em inglês:");
    console.log(JSON.stringify(ingles, null, 1));
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
