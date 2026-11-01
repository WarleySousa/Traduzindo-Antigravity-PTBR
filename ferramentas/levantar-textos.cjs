// Levanta os textos em inglês que aparecem na interface, a partir do main.js extraído.
// Uso: node ferramentas/levantar-textos.cjs <main.js> <saída.json>
//
// Considera literais de string usados como filhos de createElement ou em propriedades
// visíveis (placeholder, title, label, aria-label, description, tooltip…).
"use strict";

const fs = require("fs");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Uso: node ferramentas/levantar-textos.cjs <main.js> <saída.json>");
  process.exit(1);
}

const src = fs.readFileSync(input, "utf8");
const STR = String.raw`"((?:[^"\\\n]|\\.){1,300})"`;
const VISIBLE_PROPS = [
  "placeholder", "title", "label", "aria-label", "ariaLabel", "description", "tooltip",
  "text", "message", "header", "subtitle", "buttonText", "confirmText", "cancelText",
  "emptyText", "helperText", "heading", "caption", "hint", "content", "name", "displayName",
];

const patterns = [
  // filho de createElement: createElement("div",{...},"Texto") ou ...,null,"Texto")
  new RegExp(String.raw`[,)}]\s*${STR}(?=\s*[,)])`, "g"),
  new RegExp(String.raw`(?:${VISIBLE_PROPS.map((p) => p.replace("-", "\\-")).join("|")}|"(?:${VISIBLE_PROPS.join("|")})")\s*:\s*${STR}`, "g"),
];

const looksLikeUiText = (s) =>
  /^[A-Z][a-z]/.test(s) || /^[A-Z]{2,}\b.*\s/.test(s) || /^[a-z]+(?: [a-z]+)+[.!?]?$/.test(s);

const looksLikeCode = (s) =>
  /[{}<>;=]|=>|\$\{|^https?:|\\u|\.(?:js|ts|tsx|css|json|png|svg)\b|^[\w.-]+\/[\w./-]+$|^[A-Z][a-zA-Z]+(?:[A-Z][a-z]+)+$|^[A-Z_0-9]+$/.test(s);

// Textos de bibliotecas embutidas (layout de grafos, temas do editor, blocos Unicode, erros internos)
// que não aparecem nas telas do Antigravity.
const LIBRARY_NOISE = new RegExp(
  [
    String.raw`\$`, "%s", "lambda", "Type$", "[Cc]olor", "Lexical", String.raw`\b(?:node|edge|layer|port)s?\b`,
    "spanning", "[Bb]endpoint", "NumPad", "^Key[A-Z]$", "^Digit", "[Gg]raph", "hierarch", "compaction",
    "polyomino", "Syllables$", "Forms$", "Symbols$", "Extended", "Supplement", "Script$", "-Regular$", "-Bold$",
    "[Ee]ditor", "[Mm]inimap", "[Gg]utter", "[Ss]crollbar", "[Bb]readcrumb", "squiggl", "decoration",
    "[Ss]ash", "[Pp]eek view", "[Aa]ctivity bar", "[Ss]tatus bar", "[Ss]ide bar", "[Tt]itle bar",
    "[Bb]adge", "[Oo]verview ruler", "[Bb]racket", "indentation", "whitespace", "[Gg]lyph",
    "[Ii]nlay", "[Cc]ode[Ll]ens", "[Ll]ightbulb", "[Ss]nippet", "[Ss]ymbol icon", "[Cc]hart",
    "[Ww]orkbench", "[Qq]uick picker", "[Kk]eybinding label", "[Ll]ist/[Tt]ree",
  ].join("|")
);

const counts = new Map();
for (const re of patterns) {
  for (const m of src.matchAll(re)) {
    let s;
    try {
      s = JSON.parse(`"${m[1]}"`);
    } catch {
      continue;
    }
    s = s.trim();
    if (s.length < 2 || !/[a-z]/i.test(s) || !looksLikeUiText(s) || looksLikeCode(s) || LIBRARY_NOISE.test(s)) continue;
    counts.set(s, (counts.get(s) || 0) + 1);
  }
}

const sorted = [...counts.keys()].sort((a, b) => a.localeCompare(b, "en"));
fs.writeFileSync(output, JSON.stringify(sorted, null, 2) + "\n", "utf8");
console.log(`${sorted.length} textos gravados em ${output}`);
