# Handoff de EXECUÇÃO — 2026-07-03

> Fecha uma sessão de **planejamento** (escopamos #16 e #9). A próxima sessão é **execução**.
> Este é um **checklist acionável** — o "porquê" e os contratos estão nos specs; aqui não se repete, aponta-se.

## Specs / roadmap de referência (ler primeiro na execução)
- `plans/specs/spec-16-ficha-unificada.md` — **aprovado**, pronto pra codar
- `plans/specs/spec-9-performance-app.md` — **aprovado**, pronto pra codar
- `plans/specs/spec-orcamento-cluster.md` — aprovado (sessão anterior), pendente
- `plans/specs/spec-odontograma-referencia.md` — aprovado (sessão anterior), pendente
- `plans/roadmap/roadmap-polimento.md` — panorama (#1–#18)

## O que esta sessão produziu (planejamento)
1. **#16 Ficha unificada** escopado → `spec-16`. Criar+acompanhar numa superfície só; 3 status; odontograma-mapa; quadrante; sai DEX-sugere-orçamento e anexos; impacto na consulta mapeado (v1 não toca consulta).
2. **#9 Performance do app** escopado → `spec-9`. Fundo Opção A (partículas animam na entrada e congelam + blobs estáticos), `optimizePackageImports`, lazy recharts/pdf, remover `framer-motion`.
3. **Achado no meio:** bug da voz na ficha (registrado em `spec-16` §10).
4. **Roadmap:** entraram **#17 Landing** (redesenho + Google no hero + perf landing) e **#18 Largura global** pós-sidebar — pra depois do teste.

---

## CHECKLIST DE EXECUÇÃO

### 🔴 Bloco 0 — Working tree pendente (da sessão anterior — resolver ANTES)
Código escrito, `tsc`/`eslint` limpos, **não testado ao vivo, não commitado**. Ver `handoff-2026-07-03-1223.md` + `spec-odontograma-referencia.md`.
- [ ] **Testar ao vivo** consulta multi-proc por dente (ditar "PPR inferior; canal/pino/provisório/coroa 13; extração 38/16"), odontograma decíduos (marcar 54), #12 (barra ancorada + toast).
- [ ] **Commitar por bloco** + **deployar**. Arquivos: `consulta-client.tsx`, `Odontograma.tsx`, `arch-chips.tsx` (novo), `mini-odontograma.tsx` (del), `novo-paciente-form.tsx`, `formatar-evolucao/route.ts`, `CLAUDE.md` (regra 6) + specs/roadmap em `plans/`.

### 🟢 Bloco 1 — Pronto pra codar (têm spec)
- [ ] **#16 Ficha unificada** → segue `spec-16`. Ordem sugerida (v1): (a) migração do enum `procedimentos_status`; (b) `Odontograma` ganha prop `colorMode` (aditivo, não quebra consulta); (c) refatorar `FichasTab` pra superfície única (edição↔leitura); (d) fonte única de status (planejamento deriva da ficha); (e) remover modal DEX-sugere-orçamento + seção de anexos do painel; (f) limpar órfãos (`FichasTab:1174`, `NovaEvolucaoPanel` se sem uso); (g) quadrante **manual** (sentinelas — confirmar `src/lib/arcadas.ts`). **Consulta intocada** exceto a prop de cor.
  - [ ] **Bug voz na ficha (§10):** `FichasTab:354` lê `data.texto` → trocar por `data.transcricao` (endpoint Groq retorna `transcricao`). Fix trivial, destrava a voz da ficha.
- [ ] **#9 Performance** → segue `spec-9`. `ParticleNetwork` (anima e congela + guards `prefers-reduced-motion`/`document.hidden`), blobs estáticos no `dashboard-shell`, `optimizePackageImports` no `next.config`, lazy recharts/pdf, remover `framer-motion`. **Prototipar no browser e mostrar lado a lado antes de commitar.**
- [ ] **Cluster orçamento (#13/#14/#15)** → segue `spec-orcamento-cluster`.

### 🔵 Bloco 2 — Verificação / deploy
- [ ] Testar cada bloco ao vivo (gates de aceite nos specs), commit por bloco, deploy.
- [ ] **#2 fallback:** só se o link novo de reset cair em "Link Expirado" → `verifyOtp` na `redefinir-senha`.

### ⚪ Bloco 3 — NÃO executar (precisa planning antes)
Ficam no roadmap, exigem sessão de planejamento própria: **#17 Landing** (design-first: brief→shotgun), **#18 Largura global**, e os 🗣️ restantes (#3, #5, #8, #6, #7, C/D, F3, #1-por-último).

---

## Decisões desta sessão (não re-debater)
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Ficha = superfície única (edição↔leitura), não copiar a ficha de papel | copiar o papel / manter 2 telas | papel é desorganizado; o valor é coesão + estado vivo; mata o clicar-duas-vezes |
| 3 status: não iniciado (cinza) / em andamento (âmbar) / concluído (**teal**, cor da marca) | manter binário; concluído em verde-esmeralda | fundador escolheu coesão de marca; "em andamento" cobre multi-sessão |
| Fonte única de status (`fichas.procedimentos_status`); planejamento deriva | manter as 2 fontes | eram origem da duplicação/clicar-duas-vezes |
| Anexos NÃO na ficha (ficam no pool/aba Arquivos) | seção de anexos na ficha | ficha magra; menos poluição; aba já organiza por data |
| Perf: Opção A (anima na entrada, congela) + blobs estáticos | full-static; remover; pausar-quando-oculto | mantém premium na abertura, app leve no uso |
| #9 foca no APP; perf da landing vai pro #17 | otimizar tudo junto | landing é topo de funil, não bloqueia o teste da clínica |

## O que ficou cogitando / em aberto
- **Quadrante por voz (v2 do #16):** ensinar o prompt `formatar-evolucao` + chips a capturar quadrante (sentinelas 91–94). v1 é manual.
- **Fonte única de status:** decidir na execução entre `planejamento_procedimentos` virar view/derivação vs aposentar a tabela (spec-16 §5 recomenda derivar).
- **Orçamento "já estruturado, só aprovar":** item adjacente ao #16 (fluxo do orçamento), a escopar depois.
- **Perf partículas:** se a Opção A ficar "morta demais" no eyeball, a alternativa B (pontos flutuando via CSS/GPU) fica de reserva.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git status   # working tree: código da sessão anterior (Bloco 0) + specs/roadmap desta
# EXECUÇÃO: ler spec-16 e spec-9 → começar pelo Bloco 0 (testar/commitar o pendente), depois Bloco 1
```

## Dívidas técnicas
- [ ] Working tree por commitar (Bloco 0). `main` = `7ba634e` (deployado).
- [ ] `set-state-in-effect` pré-existentes (`consulta-assinatura-modal.tsx`, `useDexGuide.ts`, `primeiros-passos-card.tsx`) — dívida antiga.
- [ ] Contas `test-*-0630@` + Storage órfão do Clênio na prod.

## Próxima sessão
- **Modo:** execução
- **Ler primeiro:** `spec-16` + `spec-9` (contratos) e `handoff-2026-07-03-1223.md` (contexto do Bloco 0). Começar pelo **Bloco 0**.
