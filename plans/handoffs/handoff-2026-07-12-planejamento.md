# Handoff — 2026-07-12 (madrugada · planejamento + diagnóstico)

> Sessão longa: começou como diagnóstico completo (3 papéis) e virou planejamento — consolidou tudo em 3 fases e produziu as 4 specs da Fase 1. **Nada de código de produção foi tocado** (correto pro modo). Artefatos: 1 diagnóstico, 1 roadmap de 3 fases, 4 specs, 3 memórias, 1 conta de teste em prod.

## Plano / spec de referência
- **Roadmap mestre novo:** `plans/roadmap/roadmap-3-fases-2026-07.md` — consolida `roadmap-polimento.md` + `plano-fase1-retencao.md` + auditoria 09/07 + diagnóstico 12/07 em 3 fases.
- **Diagnóstico base:** `plans/auditorias/diagnostico-2026-07-12-tres-papeis.md`.
- **Specs Fase 1 (4, prontas):** `plans/specs/spec-fase1-{1-estabilizacao, 2-ia-precisao, 3-dex-identidade-motion, 4-secretaria}.md`.
- **Spec status:** as 4 da Fase 1 = **aprovadas, prontas pra execução**. Fx1 (ficha) e Ap1/Ap2 (apresentação) = **direção discutida, Fase 3, design-first — sem spec ainda**.

## O que trabalhamos
1. **Diagnóstico completo em 3 papéis** (programador/dentista/secretária) — li todos os handoffs+roadmaps+specs, varri o código, criei conta de teste real e **testei o loop ao vivo** (Playwright contra build de produção). Salvo em `plans/auditorias/`.
2. **Roadmap de 3 fases** — Fase 1 (esta semana, funcionalidades pro teste presencial), Fase 2 (pagamento+WhatsApp+manutenção mensal, frente do Mateus), Fase 3 (retenção + núcleo clínico + endurecimento).
3. **4 specs da Fase 1 escritas** com contrato `arquivo:linha` e modelo no cabeçalho.
4. **Direção de produto da ficha/apresentação** — separamos 3 superfícies (ficha/tratamento/apresentação) e o princípio de sinergia.
5. Convenção nova: **modelo recomendado no cabeçalho de toda spec** (memória `feedback_modelo_no_spec`).

## O que concluímos
**Status geral: Completo** (pro escopo de planejamento — nada ficou pela metade).
- Diagnóstico verificado **ao vivo** (não só leitura de código): loop clínico funciona ponta a ponta; achados graves são de costura, não de fundação.
- 3 bugs 🔴 confirmados com evidência: **B1** onboarding quebra na retomada · **B2** trial infinito (12/12 clínicas com `trial_ends_at=NULL`) · **B3** IA perde dente sem observação (canal sumiu do orçamento).
- As 4 specs cobrem: A/B/F (estabilização), C1+C2+C4 (IA), D+E (DEX+motion), G2 (secretária).
- **F3 (design-review) destravado:** o harness Playwright resolve o bloqueio de sessão autenticada que travava desde 10/07.

## Decisões tomadas
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Desativar onboarding = só o **teatro** (aha/demo/DEX/plano), `identidade→dashboard` | Cortar até o osso (só identidade) | Catálogo enche na hora do orçamento (#7 já existe); persona fica (alimenta recompensa). Reversível por comentário |
| Procedimentos NÃO fica no onboarding | Manter passo procedimentos | Cadastro na hora do orçamento é mais prático (decisão do fundador) |
| C1 (backstop) + C2 (prompt) **juntos** numa spec | Specar C1 sozinho | C1 sem C2 é meio-fix; prompt carrega a regra, código é a rede |
| DEX unifica no **DexMark existente** | Desenhar rosto novo | Já é o canônico; matar `Bot`/`DexAvatar`/`DexMascot` |
| Manutenção mensal = agenda+cobrança recorrente → **Fase 2** | Fase 1 | É recorrência, casa com o motor de pagamento; **um motor só, não dois** |
| Adiantar paciente = preencher vaga de cancelamento → Fase 1 thin | — | Serve a secretária no teste; mini-spec, cortável se apertar |
| Fx2 (embutir Modo Consulta na ficha) **adiado** ⏸️ | Construir agora | Modo Consulta fica separado por ora; reabre se o teste mostrar dor |
| Modelo no cabeçalho da spec; thread não troca sozinho | Prometer auto-switch | Só subagent troca automático; `/model` do thread é manual, guiado pelo campo |

## Desvios do plano original
Nenhum — foi sessão de planejamento, produziu specs/roadmap conforme a regra 6. O único "desvio" é de escopo do roadmap antigo: o rebuild da ficha (#3/#4/#9 do handoff 06/07) **não estava** no roadmap de 3 fases; o Mateus lembrou e trouxemos pra Fase 3.

## Erros encontrados e como pensei em resolver
| Erro / problema | Causa | Como resolvi | Resolvido? |
|---|---|---|---|
| Browser pane embutido congela a página (async nunca comita, screenshot timeout) | Task queues suspensas quando a aba é ocluída | Migrei o QA pra **Playwright por script Node** (chromium local, storageState reutilizável) contra build de produção | Sim — memória `project_qa_playwright_harness` |
| Signup automatizado não submetia (bloqueio herdado de 10/07) | `preview_click` não dispara o handler React | `form_input` (setter nativo) resolveu; conta criada | Sim |
| Confundi **tratamento** com **apresentação** ao escrever o princípio de sinergia | Leitura minha errada | Mateus corrigiu: são 3 superfícies (ficha=documentar, tratamento=cockpit com datas, apresentação=paciente); reescrevi o princípio no roadmap | Sim |

## Arquivos alterados (todos novos em `plans/` — zero código de produção)
| Arquivo | Mudança |
|---|---|
| `plans/auditorias/diagnostico-2026-07-12-tres-papeis.md` | novo — diagnóstico 3 papéis |
| `plans/roadmap/roadmap-3-fases-2026-07.md` | novo — roadmap mestre |
| `plans/specs/spec-fase1-1-estabilizacao.md` | novo (A+B+F) |
| `plans/specs/spec-fase1-2-ia-precisao.md` | novo (C1+C2+C4) |
| `plans/specs/spec-fase1-3-dex-identidade-motion.md` | novo (D+E1/E2) |
| `plans/specs/spec-fase1-4-secretaria.md` | novo (G2) |
| `.claude/launch.json` | +config `prod` (gitignored) |
| memórias `~/.claude/.../memory/` | +`project_qa_playwright_harness`, +`feedback_modelo_no_spec` |

> `M CLAUDE.md` e `?? handoff-2026-07-10-execucao.md` no `git status` são **pré-existentes** (não desta sessão).

## O que ficou pra próxima sessão
1. **[CRÍTICO] Entrar em EXECUÇÃO da Fase 1** — abrir em **Sonnet 5** pela **Spec 1 (Estabilização)**. Ordem no §7 da spec: A2→B11→B7→B4→B5→B8→A1→F2→F1.
2. **[ALTO] Spec 2 (IA)** — subir pra Opus no prompt (C2) + eval set (C3). O **eval de voz espera o áudio do Mateus (amanhã)** — até lá roda só com casos sintéticos, não é gate.
3. **[ALTO] Spec 3 e 4** — Sonnet + `design-review` no fim (o F3 histórico acontece aqui). Cuidado de ordem: Spec 1/A2 desliga o DexGuide, Spec 3/D3 troca o rosto dentro dele — fazer Spec 1 antes da 3.
4. **[MÉDIO] Ações manuais do Mateus:** ligar senha-vazada (Supabase Auth) · decidir env de prod (`WHATSAPP_APP_SECRET`, `UPSTASH_*`, `CRON_SECRET`).
5. **[BAIXO] Limpar contas de teste em prod:** `test-diag-0712@` + `test-diag-sec-0712@` + paciente "Maria Souza Teste" (+1 ficha, 2 agendamentos) + as antigas `test-*-0630@`. SQL sob demanda.

## O que eu estava planejando / cogitando
- **Núcleo clínico como UM conceito (Fase 3):** ficha-cockpit (Fx1) + manutenção mensal (Fase 2) + apresentação (Ap1/Ap2) são "o tratamento ao longo do tempo — planejar/acompanhar/cobrar". O Mateus separou apresentação num spec próprio (certo — público diferente), mas os três compartilham o **odontograma como fio condutor**. Quando a Fase 3 chegar, vale um brief guarda-chuva pra não desenharem layouts conflitantes.
- **Cockpit é temporal:** "a data do que foi feito" é o que vira a ficha numa linha do tempo — subvalorizei isso no começo. É a peça que casa com a manutenção mensal.
- **CI pode nascer vermelho** (33 errors de lint pré-existentes, 24 são `set-state-in-effect`). A Spec 1/F1 propõe `continue-on-error` temporário no lint, gate duro em typecheck+build. Se o Mateus quiser lint 100% verde, é trabalho extra de Fase 3.
- **Ambiente:** deixei `npm run start` (build de produção) rodando em background e o dev preview parado. Playwright+chromium instalados via `--no-save` (não sujam o package.json). Se for reabrir amanhã, o server pode ter que subir de novo.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git checkout main
# Ler, nesta ordem:
#   plans/roadmap/roadmap-3-fases-2026-07.md         (o mapa — Fase 1 é agora)
#   plans/specs/spec-fase1-1-estabilizacao.md        (primeira a executar)
# Modo: EXECUÇÃO. Abrir em Sonnet 5 (/model claude-sonnet-5).
# Ordem das specs: 1 (estabilização) → 2 (IA, sobe Opus no prompt) → 3 (DEX, depois da 1) → 4 (secretária).
```

## Dívidas técnicas registradas
- [ ] Conflito de agenda em janela UTC (consultas 21h+ BRT escapam) — `agendamentos/actions.ts` — Spec 1/B5 anota, não corrige agora.
- [ ] 33 errors de eslint pré-existentes (24 `set-state-in-effect`) — Fase 3/H5.
- [ ] `openai` órfão no `package.json`; 59 casts `as unknown as` — Fase 3.
- [ ] Contas de teste em prod (ver item 5).
- [ ] Bump `next` 16.x (advisories reais) — Fase 3/H3, com CI verde antes.

## Próxima sessão
- **Modo:** execução.
- **Ler primeiro:** `roadmap-3-fases-2026-07.md` + `spec-fase1-1-estabilizacao.md`.
- **Modelo:** Sonnet 5 (subir pra Opus só nos spikes marcados nas specs).
