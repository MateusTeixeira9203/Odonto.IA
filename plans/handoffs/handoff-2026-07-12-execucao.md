# Handoff — 2026-07-12 23:14 (execução Fase 1, specs 1+2)

> Sessão de execução: retomou do handoff de planejamento (mesma data), rodou a **Spec 1
> (Estabilização)** e a **Spec 2 (IA — precisão)** completas, ponta a ponta — código,
> validação, eval, commit e push. Mateus testou em prod e confirmou que está tudo
> funcionando. No fim da sessão surgiu um **problema novo no Modo Consulta** (ainda não
> descrito) + um pedido de **mudança no odontograma** (ainda não descrito) — o roadmap foi
> pausado ali e esta sessão fecha para abrir uma nova dedicada só a isso.

## Plano / spec de referência
- **Roadmap ativo:** `plans/roadmap/roadmap-3-fases-2026-07.md` — Fase 1.
- **Spec 1 (Estabilização):** `plans/specs/spec-fase1-1-estabilizacao.md` — **implementada e commitada**, todos os 9 itens (A2, B11, B7, B4, B5, B8, A1, F2, F1).
- **Spec 2 (IA precisão):** `plans/specs/spec-fase1-2-ia-precisao.md` — **implementada e commitada**, C1+C2+C3+C4.
- **Spec 3 (DEX/identidade/motion):** `plans/specs/spec-fase1-3-dex-identidade-motion.md` — aprovada, **não iniciada**.
- **Spec 4 (secretária):** `plans/specs/spec-fase1-4-secretaria.md` — aprovada, **não iniciada**.
- **Roadmap pausado** a pedido do Mateus para tratar um bug fora do escopo das specs (Modo Consulta + odontograma) antes de continuar pra Spec 3.

## O que trabalhamos
1. **Spec 1 completa** — onboarding curto (identidade→dashboard), DexGuide/PrimeirosPassosCard desligados, guard de papel no Modo Consulta (secretária barrada), conflito de agenda cobrindo `checked_in`/`in_progress`, botão "Agendar retorno" na ficha expandida (D12), auto-redirect pós-ficha removido (CTA explícito no lugar), copy (pluralização/rótulos), `npm audit fix`, CI mínimo (`.github/workflows/ci.yml`) + 12 erros de lint baratos corrigidos.
2. **Spec 2 completa** — eval set de consistência (5 casos, `plans/specs/eval/`) rodado como baseline (2 órfãos, 3/5 PASS), prompt reescrito (C2, Opus: observação-por-dente universal + achado≠procedimento), backstop determinístico (C1: todo dente sempre ganha `dentes_observacoes`), rate-limit no `sugerir-orcamento` (C4), eval re-rodado (0 órfãos, 4/5 PASS).
3. **Dogfood + design-review ao vivo** — Playwright + Chromium local (MCP Playwright falha por falta do canal 'chrome'; browser pane embutido trava por oclusão, como já documentado). Confirmei A2, B7, B4 e C4 (429) navegando de verdade como usuário real.
4. **3 commits + push pra `main`** (`4273d39`, `7c91f34`, `18da426`) — Mateus testou em prod e confirmou que está funcionando.
5. Mateus achou um **bug no Modo Consulta** e quer uma **mudança no odontograma** — nenhum dos dois foi descrito ainda nesta sessão. Pediu handoff pra abrir sessão nova dedicada.

## O que concluímos
**Status geral: Completo** para o escopo do roadmap (Specs 1+2) — mas a sessão fecha com um problema novo em aberto que ainda não foi sequer descrito.
- Specs 1 e 2 100% implementadas, validadas (typecheck+lint+build limpos) e em produção.
- QA ao vivo cobriu os pontos de maior risco (segurança/guard, visual) via browser real; B5/B8/A1/B11 ficaram verificados só por código+typecheck/lint, não clicados — **se o bug do Modo Consulta for nessas áreas, começar a investigação por aqui.**
- Eval de IA (C3) é reutilizável — `plans/specs/eval/run-formatar-evolucao.mjs` roda contra qualquer build de prod.

## Decisões tomadas
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| 3 commits separados (`chore:plans`, `feat:estabilizacao`, `feat:ia`) | 1 commit monolítico | Unidades lógicas distintas, segue convenção do histórico do repo |
| Corrigir os 12 erros de lint "baratos" achados no F1 (não estavam na spec) | Deixar tudo pra `continue-on-error` | Eram mecânicos e de baixo risco (prefer-const, aspas, jsx-comment-textnodes, scripts/ fora do lint, ref durante render) — só os 24 `set-state-in-effect` (retrabalho de efeito, não mecânico) ficaram pro `continue-on-error` |
| `scripts/**` excluído do ESLint | Reescrever `cleanup-test-data.js` pra ESM | É CLI standalone CommonJS (`node scripts/...`), converter quebraria a forma de rodar; excluir do lint é o fix correto, não o código |
| Playwright local (`--no-save`) pra QA, de novo | Insistir no MCP Playwright ou no browser pane | MCP Playwright exige canal 'chrome' (ausente, sem admin); browser pane trava por oclusão — mesmo diagnóstico da sessão QA anterior (memória `project_qa_playwright_harness`) |
| Instabilidade do sentinela 98 (~91% detecção) registrada como achado, não corrigida | Investigar/trocar modelo agora | Fora de escopo explícito da Spec 2 (§8): troca de modelo só se C3 mostrar que prompt+dicionário não bastam — 1 caso de 5 não é esse sinal ainda |

## Desvios do plano original
| Item do plano | O que aconteceu na prática | Impacto |
|---|---|---|
| Diagnóstico apontava 33 erros de lint pré-existentes | Achei 36 na execução (diagnóstico um pouco desatualizado) | Nenhum — corrigi os 12 baratos, os 24 `set-state-in-effect` batem exatamente com o número do diagnóstico |
| Spec 2 não previa instabilidade de detecção de sentinela | Caso `ppr-inferior-36` variou 1/15 chamadas (depois confirmei 10/11 com testes extras) | Nenhum bloqueio — registrado como achado pro futuro, dentro do "fora de escopo" já previsto pela própria spec |

## Erros encontrados e como pensei em resolver
| Erro / problema | Causa | Como resolvi | Resolvido? |
|---|---|---|---|
| Browser pane embutido trava (`computer`/screenshot timeout, `getBoundingClientRect` zerado) | Oclusão do pane suspende o pipeline de paint/layout do Chromium | Migrei pra Playwright + Chromium local via script Node (`npm i --no-save playwright`), rodando contra `npm run start` | Sim |
| MCP Playwright falha: `Chromium distribution 'chrome' is not found` | Canal 'chrome' não instalado, `npx playwright install chrome` precisaria de admin | Mesmo fallback acima (Chromium local já instalado em `%LOCALAPPDATA%/ms-playwright` de sessão anterior) | Sim |
| Clique em linha de tabela via `ref` resolvia coordenada `(0,0)` | Consequência do freeze do browser pane (layout não commitava) | Não era um problema de seletor — resolvido junto com a migração pro Playwright externo | Sim |
| "Prontuário" parecia botão de export de PDF | Suposição errada sem checar o componente fonte | Chequei `paciente-detail-client.tsx` — é o `TabsTrigger` da aba (`value: 'ficha-clinica'`, já é a aba default) | Sim |
| Checks de string tipo `.includes('Odontograma')` davam falso-negativo mesmo com o card expandido corretamente | `innerText` reflete `text-transform: uppercase` do CSS — o texto real no DOM é "Odontograma", o computado é "ODONTOGRAMA" | Troquei pra dump completo do texto renderizado em vez de checagem exata de case | Sim — lição registrada aqui pra não repetir |
| Eval baseline: 2 dentes órfãos (`ruido-small-talk-11` sumiu a chave em 2/3 rodadas) | Bug real do prompt (B3 do diagnóstico) | C1 (backstop em código) + C2 (prompt reforçado) — confirmado 0 órfãos em 15 chamadas depois | Sim |
| Eval depois: `ppr-inferior-36` perdeu o sentinela 98 inteiro em 1/3 rodadas | Suspeita: variância estocástica do modelo (Groq/Llama), não meu prompt | Rodei 5 chamadas extras da mesma narrativa: 5/5 corretas → 10/11 no total, não é regressão introduzida pelo C2 | **Não corrigido — é ruído do modelo, fora de escopo por decisão da própria spec; registrado como dívida/sinal** |

## Arquivos alterados
**Commit `4273d39` (chore: plans)** — CLAUDE.md (regras 6/7), diagnóstico 12/07, 2 handoffs, roadmap 3 fases, 4 specs Fase 1.

**Commit `7c91f34` (feat: estabilização)** — `.github/workflows/ci.yml` (novo), `eslint.config.mjs`, `package-lock.json`, `src/app/(auth)/verifique-email/page.tsx`, `src/app/consulta/[agendamentoId]/{page.tsx, _components/consulta-client.tsx}`, `src/app/dashboard/agendamentos/{actions.ts, _components/agendamentos-client.tsx}`, `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx`, `src/app/dashboard/orcamentos/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/onboarding/_components/onboarding-client.tsx`, `src/app/page.tsx`, `src/components/command-palette/command-palette.tsx`, `src/components/layout/dashboard-shell.tsx`, `src/components/pacientes/FichasTab.tsx`, `src/hooks/use-session-guard.ts`, `src/lib/supabase/middleware.ts`.

**Commit `18da426` (feat: ia)** — `src/app/api/dex/formatar-evolucao/route.ts`, `src/app/api/sugerir-orcamento/route.ts`, `src/lib/odonto-dictionary.ts`, `plans/specs/eval/{formatar-evolucao-casos.json, run-formatar-evolucao.mjs, resultado-baseline-2026-07-12.json, resultado-depois-c1c2-2026-07-12.json}` (todos novos).

> `git status` no fim da sessão: **limpo**, tudo commitado e pushed (`origin/main` = `18da426`).

## O que ficou pra próxima sessão
1. **[CRÍTICO] Descrever e corrigir o bug do Modo Consulta** — Mateus encontrou testando em prod, ainda não descreveu o sintoma. Como esta sessão **mexeu no Modo Consulta** (B7: guard de secretária; B8: removeu auto-redirect pós-ficha e trocou por CTA), a hipótese nº1 a checar é se o bug está numa dessas duas mudanças — não assumir que é preexistente sem checar primeiro. Arquivos: `src/app/consulta/[agendamentoId]/page.tsx`, `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`.
2. **[CRÍTICO] Aplicar a mudança no odontograma** — ainda não descrita. Componente provável: `src/components/pacientes/Odontograma` (usado dentro do `FichasTab.tsx`, visto na D12 expandida).
3. **[ALTO] Depois de 1+2: retomar roadmap Fase 1 na Spec 3** (DEX/identidade/motion) — `plans/specs/spec-fase1-3-dex-identidade-motion.md`. Sonnet 5.
4. **[ALTO] Spec 4 (secretária)** depois da 3 — `plans/specs/spec-fase1-4-secretaria.md`. Sonnet 5.
5. **[MÉDIO] Ações manuais do Mateus** (pendente desde o handoff de planejamento): ligar HaveIBeenPwned no Supabase Auth · decidir env de prod (`WHATSAPP_APP_SECRET`, `UPSTASH_*`, `CRON_SECRET`).
6. **[BAIXO] Limpar contas de teste em prod** — `test-diag-0712@`, `test-diag-sec-0712@`, paciente "Maria Souza Teste" — cresceu mais uso nesta sessão (mais chamadas de API de teste no histórico). SQL sob demanda.

## O que eu estava planejando / cogitando
- **QA da Spec 1 ficou parcial por escolha de tempo/risco:** priorizei confirmar ao vivo A2 (segurança visual) e B7 (guard de segurança real) e B4 (mudança visual, pedia design-review) — B5 (conflito de agenda), B8 (auto-redirect) e A1 (onboarding) só foram verificados por código/typecheck/lint, não clicados. Se o bug do Modo Consulta for em B8 especificamente, essa é a lacuna mais provável de esconder o problema.
- **O sinal do `ppr-inferior-36`** (instabilidade ~9% de detecção de sentinela) não é urgente, mas é dado real acumulando pro dia em que a Fase 2/3 reconsiderar o modelo de estruturação (Llama→Gemini, gate explícito da spec-precisao original). Vale não perder esse número.
- **Cockpit temporal / núcleo clínico (Fase 3):** ainda de pé da sessão de planejamento — ficha (Fx1) + manutenção mensal (Fase 2) + apresentação (Ap1/Ap2) compartilham o odontograma como fio condutor. Como a mudança que o Mateus quer agora é justamente no odontograma, vale checar se é um ajuste pontual ou já é o início dessa direção maior — perguntar antes de assumir escopo pequeno.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git log --oneline -3   # confirma 18da426 no topo, working tree limpo
```
Modo: a definir pelo Mateus (provavelmente execução direta, já que ele quer "corrigir e já aplicar"). Primeiro passo: pedir a descrição do bug do Modo Consulta e da mudança do odontograma — nenhum dos dois foi explicado ainda. Depois de resolver, retomar `plans/specs/spec-fase1-3-dex-identidade-motion.md`.

## Dívidas técnicas registradas
- [ ] Conflito de agenda em janela UTC (consultas 21h+ BRT escapam) — `agendamentos/actions.ts` — Spec 1/B5 anotou, não corrigiu.
- [ ] 24 erros de eslint `set-state-in-effect` pré-existentes — Fase 3/H5.
- [ ] `openai` órfão no `package.json`; 59 casts `as unknown as` — Fase 3.
- [ ] Contas de teste em prod (ver item 6 acima).
- [ ] Bump `next` 16.x (advisories reais) — Fase 3/H3, com CI verde antes.
- [ ] **Novo:** instabilidade ~9% de detecção do sentinela de arcada (97/98/99) em `formatar-evolucao` — não é bug de código (backstop cobre o caso órfão), é ruído do modelo. Monitorar via `plans/specs/eval/run-formatar-evolucao.mjs`; só vira ação se o eval mostrar piora sistemática.
