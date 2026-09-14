# Eval — extração clínica

Rede de segurança para mudanças no prompt/enum de `/api/dex/formatar-evolucao`. A regra do
projeto (AGENTS.md → IA) é: **prompt de extração só muda com eval rodado antes e depois**.

## Eval direto congelado (baseline durante mudança da rota)

`run-direct.ts` chama o Gemini real pelo provider do projeto, mas lê prompt, schema, parser e
reconciliação de um commit fixo via `git show`. Use quando não houver sessão/local server ou quando
a rota estiver sendo editada: a comparação não é contaminada pela árvore de trabalho. Ele só aceita
relatos sintéticos do `golden.json` e não toca no banco.

```bash
/home/mtx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  node_modules/tsx/dist/cli.mjs evals/extracao-clinica/run-direct.ts
```

Por padrão fixa `14fde60` e respeita o timeout de 30 s da rota. `DEX_EVAL_BASELINE_COMMIT` escolhe
outro commit. `EVAL_CASE_LIMIT` limita casos e `EVAL_OUT_DIR` muda somente o diretório de saída.
`EVAL_CASE_IDS=id-1,id-2` seleciona IDs específicos sem alterar o golden.
`EVAL_INCLUDE_PIPELINE=1` anexa os procedimentos e eventos antes/depois da reconciliação ao JSON;
use somente com o golden sintético para diagnosticar cobertura ou duplicações.
`EVAL_PROVIDER_TIMEOUT_MS` é diagnóstico de conectividade; nunca compare seu resultado ao baseline,
pois deixa de representar o timeout de produção.

Para avaliar as mudanças ainda não commitadas como candidato, use
`DEX_EVAL_TARGET=candidate`. Ele carrega a rota e seus helpers da árvore de trabalho, usa a feature
`dex-eval-candidate-r169` e grava um arquivo `candidato-*.json`; não o confunda com o baseline.
Os três casos `r169` exigem resultado exato: evento extra ou duplicado é falha, além de tipo,
status, âncora de região e nome clínico esperado.

O JSON salvo contém métricas, IDs sintéticos e expectativas que falharam; não grava relatos nem
respostas do modelo.

## Eval HTTP de fluxo autenticado

1. Dev server no ar em `localhost:3000` (`preview_start "dev"` ou `npm run dev`).
2. Sessão salva válida em `evals/extracao-clinica/audit-auth.json` (arquivo ignorado pelo Git),
   ou informe `EVAL_AUTH_FILE` com o caminho dela. Se expirou, refaça o login headed uma vez.
3. `NODE_PATH="<repo>/node_modules" node evals/extracao-clinica/run.cjs`. O resultado vai para
   `evals/extracao-clinica/results/` (também ignorado pelo Git); `EVAL_OUT_DIR` troca o destino.

Para o baseline de latência, aqueça uma vez e rode ao menos 20 casos sintéticos:
`EVAL_WARM_UP=1 EVAL_CASE_LIMIT=20 NODE_PATH="<repo>/node_modules" node evals/extracao-clinica/run.cjs`.
O resultado inclui p50/p95 de total, pré-IA, IA e pós-IA; o arquivo não guarda relatos nem respostas.

## Como ler

- **ATUAL** — tipos que a extração já suporta. É a linha que **não pode regredir**: rode o baseline
  antes de qualquer mudança de prompt/enum e confira que o número não cai depois.
- **NOVO** — `ponte`, `esfoliacao`, `profilaxia`, `raspagem`, `fluor`. Barrados no enum hoje, então o
  baseline reporta **0 presentes** — é o esperado. É o buraco que R-06/R-07 preenchem: depois deles,
  esses casos devem virar PASS **sem** derrubar nenhum ATUAL.
- **eventos inventados (falso-positivo)** — o pior modo de falha: a IA emitindo evento que o relato
  não pediu. Vigie esse número nas duas pontas.

## Fluxo antes/depois

1. Rode `run-direct.ts` com o commit da rota atual, ou `run.cjs` com a rota atual, e anote ATUAL e eventos inventados.
2. Muda o enum/prompt na rota, reinicia o dev.
3. `node run.cjs` de novo. Aceite = NOVO sobe, ATUAL **não cai**, inventados **não sobe**.

## Manutenção

Os relatos em `golden.json` são exemplos sintéticos. Trocar pelos **relatos reais** por especialidade
quando o material de base chegar — quanto mais o golden espelha ditado de verdade, mais o eval vale.
Temperatura da extração é 0.2 (não 0), então há pequena variância entre rodadas; diferença de 1 caso
isolado pode ser ruído — o que importa é a tendência e o número de inventados.
