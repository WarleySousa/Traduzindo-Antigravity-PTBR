// Tradutor da interface do Antigravity para PT-BR.
//
// Este código é anexado ao final do preload.js do aplicativo pelo instalador. Ele roda em cada
// janela antes da página carregar e traduz os textos conforme a interface vai sendo montada:
// nós de texto e os atributos placeholder, title e aria-label.
//
// O instalador preenche as duas constantes abaixo com o conteúdo da pasta traducao/.
(function antigravityPtBr() {
  "use strict";

  const DICIONARIO = __DICIONARIO__;
  const PADROES = __PADROES__.map(([de, para]) => [new RegExp(de), para]);
  const ATRIBUTOS = ["placeholder", "title", "aria-label"];

  // Áreas com conteúdo do usuário ou do agente, que nunca devem ser alteradas.
  const IGNORAR = "script, style, textarea, input, code, pre, kbd, samp, [contenteditable=''], [contenteditable='true'], .monaco-editor, .xterm";

  const traduzidos = new WeakSet();

  function traduzirTexto(texto) {
    const limpo = texto.trim();
    if (!limpo || !/[A-Za-z]/.test(limpo)) return null;
    let traducao = Object.prototype.hasOwnProperty.call(DICIONARIO, limpo) ? DICIONARIO[limpo] : null;
    if (traducao === null) {
      for (const [regex, substituto] of PADROES) {
        const grupos = limpo.match(regex);
        if (!grupos) continue;
        // $1 insere o trecho capturado como está; [[$1]] insere o trecho traduzido pelo dicionário.
        traducao = substituto
          .replace(/\[\[\$(\d)\]\]/g, (_, n) => (DICIONARIO[grupos[n]] !== undefined ? DICIONARIO[grupos[n]] : grupos[n]))
          .replace(/\$(\d)/g, (_, n) => grupos[n]);
        break;
      }
    }
    if (traducao === null || traducao === limpo) return null;
    const inicio = texto.slice(0, texto.indexOf(limpo));
    const fim = texto.slice(texto.indexOf(limpo) + limpo.length);
    return inicio + traducao + fim;
  }

  function dentroDeAreaIgnorada(elemento) {
    return elemento !== null && elemento.closest(IGNORAR) !== null;
  }

  function traduzirNoDeTexto(no) {
    if (traduzidos.has(no) || dentroDeAreaIgnorada(no.parentElement)) return;
    const novo = traduzirTexto(no.nodeValue);
    if (novo !== null) {
      traduzidos.add(no);
      no.nodeValue = novo;
    }
  }

  function traduzirAtributos(elemento) {
    if (dentroDeAreaIgnorada(elemento.parentElement)) return;
    for (const nome of ATRIBUTOS) {
      const valor = elemento.getAttribute(nome);
      if (valor === null) continue;
      const novo = traduzirTexto(valor);
      if (novo !== null) elemento.setAttribute(nome, novo);
    }
  }

  function traduzirArvore(raiz) {
    if (raiz.nodeType === Node.TEXT_NODE) {
      traduzirNoDeTexto(raiz);
      return;
    }
    if (raiz.nodeType !== Node.ELEMENT_NODE && raiz.nodeType !== Node.DOCUMENT_NODE) return;
    if (raiz.nodeType === Node.ELEMENT_NODE) {
      traduzirAtributos(raiz);
      if (raiz.matches(IGNORAR)) return;
    }
    const percurso = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (no) => {
        if (no.nodeType !== Node.ELEMENT_NODE || !no.matches(IGNORAR)) return NodeFilter.FILTER_ACCEPT;
        // Campos de texto: traduz o placeholder e as dicas, mas nunca o conteúdo.
        traduzirAtributos(no);
        return NodeFilter.FILTER_REJECT;
      },
    });
    for (let no = percurso.nextNode(); no; no = percurso.nextNode()) {
      if (no.nodeType === Node.TEXT_NODE) traduzirNoDeTexto(no);
      else traduzirAtributos(no);
    }
  }

  const observador = new MutationObserver((mudancas) => {
    for (const mudanca of mudancas) {
      if (mudanca.type === "childList") {
        for (const no of mudanca.addedNodes) traduzirArvore(no);
      } else if (mudanca.type === "characterData") {
        // O React reaproveita o nó e troca o texto: o novo valor precisa ser traduzido de novo.
        traduzidos.delete(mudanca.target);
        traduzirNoDeTexto(mudanca.target);
      } else if (mudanca.type === "attributes") {
        traduzirAtributos(mudanca.target);
      }
    }
  });

  observador.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATRIBUTOS,
  });

  const iniciar = () => {
    document.documentElement.lang = "pt-BR";
    traduzirArvore(document);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
