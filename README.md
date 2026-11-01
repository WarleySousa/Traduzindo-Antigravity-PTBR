# Antigravity PT-BR

Tradução para português do Brasil do aplicativo **Google Antigravity** para Windows.

O pacote não troca nem baixa nenhum arquivo do Google: ele faz backup do `app.asar` original, acrescenta um tradutor ao script de inicialização da janela e traduz a interface enquanto você usa. Para voltar ao inglês, basta restaurar o backup.

## Como usar

1. Feche o Antigravity, inclusive o ícone na bandeja do sistema.
2. Dê dois cliques em **`Instalar.bat`**.
3. Abra o Antigravity.

Para voltar ao original, feche o Antigravity e dê dois cliques em **`Restaurar.bat`**.

Se o Antigravity não estiver na pasta padrão (`%LOCALAPPDATA%\Programs\antigravity`), arraste a pasta de instalação sobre o `Instalar.bat` ou o `Restaurar.bat`.

Não é preciso instalar o Node.js: os atalhos usam o próprio `Antigravity.exe` para rodar o instalador.

### Depois de uma atualização do Antigravity

Atualizações do Antigravity substituem o `app.asar` e removem a tradução. É só rodar o `Instalar.bat` de novo: ele guarda o backup da nova versão e reaplica a tradução.

## O que é traduzido

- **A interface principal** (telas, menus, botões, avisos e dicas): textos são trocados conforme aparecem, usando o dicionário em `traducao/textos/`.
- **Menus e janelas do sistema** (menu Arquivo/Ajuda, ícone da bandeja, confirmação de saída, diálogos de pastas e atualização): trocas feitas direto nos arquivos do processo principal, listadas em `traducao/pt-BR.json`.

O conteúdo das conversas, o código, os terminais e tudo o que você digita nunca é alterado.

## Como funciona

| Arquivo | Função |
| --- | --- |
| `src/ptbr.cjs` | Instala, restaura e mostra o status. Faz o backup em `<pasta do Antigravity>\_ptbr-backup\<versão>` e confere o hash do backup antes de usá-lo. |
| `src/tradutor-interface.js` | Tradutor que roda na janela: percorre a página e observa as mudanças (`MutationObserver`), trocando nós de texto e os atributos `placeholder`, `title` e `aria-label`. |
| `lib/asar.cjs` | Leitura e gravação do formato ASAR do Electron. |
| `traducao/textos/*.json` | Dicionário da interface (inglês → português). |
| `traducao/pt-BR.json` | Padrões com números (por exemplo, "3 files changed") e textos do processo principal. |
| `ferramentas/` | Ferramentas para atualizar a tradução quando sair uma nova versão. |

O instalador recusa continuar se:

- o Antigravity estiver aberto;
- o executável exigir validação de integridade do `app.asar` (o aplicativo deixaria de abrir);
- a instalação tiver sido alterada por outro pacote de tradução — nesse caso, restaure esse pacote ou reinstale o Antigravity antes.

## Atualizar a tradução para uma nova versão

```bash
node ferramentas/extrair-interface.cjs "%LOCALAPPDATA%\Programs\antigravity\resources\bin\language_server.exe" saida
node ferramentas/levantar-textos.cjs saida/main.js saida/textos-en.json
```

O segundo comando gera a lista de textos em inglês da interface. Compare com o dicionário em `traducao/textos/` e traduza os textos novos em um novo arquivo dessa pasta.

Para conferir o resultado no aplicativo, abra o Antigravity com `--remote-debugging-port=9333` e rode `node ferramentas/inspecionar-janela.cjs`: ele lista os textos visíveis na janela e aponta os que continuam em inglês.

As descrições de plugins do Marketplace vêm do servidor e mudam com frequência, por isso ficam em inglês.

## Licença

[MIT](LICENSE) © 2026 Warley Lourenço de Sousa.

Google Antigravity é marca do Google LLC. Este projeto é independente e não tem vínculo com o Google.
