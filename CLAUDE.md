# CLAUDE.md, Eleições SP 2024 (fictício)

> **Spec viva.** Porta de entrada lida pelo agente em toda sessão. Não duplica o [README.md](README.md), **aponta** pra ele. Atualize quando uma regra, comando, módulo ou hurdle mudar.
>
> **Última revisão:** 2026-11-10
> **Dados, métricas, como rodar e deploy:** [README.md](README.md)

---

## 1. O que é

Trabalho de IA da faculdade (regressão logística multinomial sobre 100 eleitores **fictícios** gerados com `np.random`, 4 candidatos inventados) transformado em **app de dados** de portfólio de **Gustavo Martins Gripaldi**: visão geral, dashboard exploratório, avaliação do modelo, simulador e downloads. Linkado em https://g2portfolio.grovicdata.com/projetos/eleicoes-sp-2024-ia. Ao vivo: https://g2martins.github.io/EleicoesSP-2024-IA/. **Não é previsão eleitoral** e a página repete isso.

## 2. Stack + Comandos

Python (numpy, pandas, scikit-learn) na raiz; site em `site/`: Angular 21.2 standalone + zoneless + signals, SSG (`outputMode: "static"`, uma rota, sem router), `provideClientHydration(withEventReplay())`, Tailwind v4, Geist + Geist Mono, Node 22 (scripts `.ts` nativos). GitHub Pages em `main:/docs`, `baseHref` `/EleicoesSP-2024-IA/`.

```bash
python -I export_model.py        # (raiz) gera os dados como main.py com seed 42 e escreve site/src/app/data/*.json + site/public/data/*
cd site
npm start                        # http://localhost:4442/EleicoesSP-2024-IA/
npm run build                    # ng build com prerender
npm run check                    # smoke pós-build: SEO, aviso de dados fictícios, seções, downloads, sem travessão longo, paridade TS x sklearn
npm run build:pages              # build + check + copia para ../docs (.nojekyll, 404.html)
npm run og                       # python scripts/og.py: OG 1200x630 + ícones PNG via Playwright
```

## 3. Mapa de módulos

| Caminho | Responsabilidade |
|---|---|
| `main.py` | Código original do trabalho (sem semente). Não mexer. |
| `export_model.py` | Única ponte Python → site: geração idêntica com `SEED = 42`, treino, métricas, ROC um-contra-todos, confiança × acerto, estudo de 500 sementes, EDA, permutação, fixtures e downloads. |
| `site/src/app/data/` | `model.json`, `eda.json`, `fixtures.json` (20 `predict_proba` do sklearn). Gerados, não editar. |
| `site/src/app/model.ts` | Inferência (logits + softmax). Sem imports: `scripts/check.ts` roda o mesmo arquivo no Node. |
| `site/src/app/app.ts` + `app.html` | A página inteira: Visão geral (com o resultado real do TSE à parte), Dashboard, Modelo, Simulador, Dados. Gráficos em SVG/CSS, sem biblioteca; o mapa idade × renda é recalculado ao vivo a partir do simulador. |
| `site/public/data/` | Downloads com "ficticio" no nome (CSV, modelo, dicionário). Gerados pelo export. |
| `site/scripts/` | `check.ts`, `pages.ts`, `og.py` + `og.html`. |
| `docs/` | Saída do build publicada. Nunca editar à mão. |

## 4. Regras SEMPRE-ATIVAS

- **Honestidade:** faixa "Modelo educacional treinado com dados fictícios; não é previsão eleitoral." sempre visível; downloads com "ficticio" no nome; sem JSON-LD `Dataset` (dados inventados). O `check` trava os três.
- **Candidatos são personagens do enunciado.** Nunca associar saídas a candidatos ou partidos reais. O resultado oficial do TSE fica só no box "Contexto real, à parte", com fonte.
- **Rótulos das classes = `modelo.classes_`** (ordem alfabética do `cat.codes`), não a ordem que o `main.py` imprimia.
- **Paridade:** toda mudança no modelo passa por `export_model.py`; o `check` falha se TS e sklearn diferirem mais que 1e-6.
- **SSG:** APIs do browser só em `afterNextRender` ou eventos. Conteúdo visível sem JS (gate `.js`). Animação só `transform`/`opacity`, com `prefers-reduced-motion`.
- **Design Valerium:** Geist, eyebrow mono, card "well", ticks, dot grid; papel claro padrão + escuro via `prefers-color-scheme`; acento vermelho "carimbo". Cores dos candidatos = slots 1 a 4 da paleta do skill `dataviz` (validados em pares adjacentes; o mapa usa um painel por candidato porque 4 cores não passam em todos os pares). Diverging verde/magenta com valores escritos nas células.
- **Zero travessão longo (U+2014)** em texto visível e downloads.
- **Disclaimer** "Projeto de portfólio de Gustavo Martins Gripaldi." no topo e crédito no footer.
- **`npm run build:pages` verde** antes de publicar. **`docs/` é build.**

## 5. Segurança

- Site estático, sem backend, sem formulário, sem cookies, sem `localStorage`. Nenhum dado pessoal: todos os eleitores são sorteados.
- Texto só via interpolação do Angular (escapado); nada de `innerHTML`. JSON-LD é estático no `index.html`.
- Nenhum segredo no repo; `.gitignore` cobre `.env*`, `node_modules`, `dist`, `.angular`, `.shots/`, `venv`.

## 6. Common Hurdles

- **Python com argv de caminho não ASCII ("Programação") quebra:** rodar sempre de dentro da pasta com caminho relativo e `python -I`.
- **`multi_class='multinomial'`** gera FutureWarning no scikit-learn 1.5 e foi removido no 1.8 (`requirements.txt` limita `<1.8`); o export silencia o aviso para manter o código idêntico ao original.
- **Node 22 `cpSync` sai com 127 em silêncio** no caminho com "Programação": `pages.ts` usa `cp` de `fs/promises`.
- **EBUSY** ao recriar `docs/` se um shell ou servidor estiver com cwd dentro dela.
- **Git Bash converte `/EleicoesSP-2024-IA/` em caminho do Windows** ao passar para um servidor local: usar `MSYS_NO_PATHCONV=1`.
- **Angular remove espaço entre elementos** (`</strong> <span>`): pôr o espaço dentro do texto do span.
- **`<option [selected]>` e `[checked]` não vão para o HTML pré-renderizado:** usar também `[attr.selected]`/`[attr.checked]`.
- **Kaspersky intercepta o `chrome.exe`** (injeta script http e tira o gzip do HTML), derrubando performance e boas práticas no Lighthouse local: rodar o Lighthouse pelo `chrome-headless-shell.exe` do Playwright (`--remote-debugging-port` + `lighthouse --port`), que não é interceptado, com servidor gzip. Assim deu 98/100/100/100 (mobile).
