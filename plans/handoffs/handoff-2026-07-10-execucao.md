# Handoff — 2026-07-10 (execução)

## Plano / spec de referência
- **Plano ativo:** `plans/handoffs/handoff-2026-07-10-discussao.md` (checklist de commits A–F) + `plans/auditorias/auditoria-2026-07-09.md`.
- **Spec status:** blocos A–D concluídos e no ar; bloco E recalibrado, concluído e aplicado; bloco F (vercel.json) surgiu de uma varredura extra e também foi concluído. **F3 do `roadmap-polimento.md`** (design-review + polish) foi iniciado nesta sessão e ficou **bloqueado** — ver abaixo.

## O que trabalhamos
1. Executei os blocos A–D do handoff de 10/07 (segurança do webhook, error boundaries, `npm audit fix`, housekeeping de `plans/`) e mergeei tudo em `main` → deploy em prod, com sua aprovação explícita a cada etapa (merge, aplicar migration, push).
2. Recalibrei o bloco E: a recomendação P2 da auditoria (revogar EXECUTE dos 12 helpers `SECURITY DEFINER` de `authenticated`) estava **errada** para 11 deles — quebraria a RLS. Escrevi e apliquei a migration 096, que só fecha `provision_secretaria` (buraco real de escrita cross-tenant) + a listagem do bucket `avatars`.
3. Varri os 15 specs + 2 roadmaps contra o código real (a seu pedido) — a maioria já estava implementada e o roadmap estava desatualizado em pelo menos 1 ponto (spec-16 ficha unificada).
4. Criei e apliquei `vercel.json` (cron diário do `run-reminders`), que faltava desde sempre — achado da própria auditoria.
5. Comecei o F3 (design-review + design-polish nos surfaces DEX/Apresentar/demo) — travei tentando conseguir uma sessão autenticada pra navegar até lá.

## O que concluímos
**Status geral: Parcial** — tudo que tinha spec/aprovação está completo e no ar; o F3 não chegou nem a rodar o audit visual.

No ar em produção (`main` @ `0752161`):
- Fail-closed no webhook WhatsApp (`meta.ts`)
- `app/error.tsx` + `app/not-found.tsx` (testados via smoke: 404 real confirmado em `dentia.app.br`)
- `npm audit fix` — 22→3 vulns, sem bump de `next`
- Migration 096 aplicada e verificada nos advisors (provision_secretaria + avatars fechados; os 10 helpers de RLS + `complete_onboarding` continuam intencionalmente abertos pra `authenticated`)
- `vercel.json` registrando o cron de lembretes

## Decisões tomadas

| Decisão | Alternativa descartada | Motivo da escolha |
|---|---|---|
| Bloco E só revoga `provision_secretaria`, não os 10 helpers de RLS | Seguir a auditoria literalmente (revogar os 12) | Doc oficial do Postgres + advisors + histórico das migrations 091/093/095 confirmam que a RLS depende do EXECUTE de `authenticated` nesses helpers — revogar quebraria toda query autenticada |
| `vercel.json` com schedule diário (09:00 UTC) | Cron horário | `reminders.ts` usa janela deslizante (`reminder_hours`, default 24h) + envio idempotente — diário é suficiente e funciona em qualquer plano Vercel (Hobby limita cron a granularidade diária) |
| F3 segue o par documentado no CLAUDE.md (`design-review` skill → `design-polish` agente) | Usar `impeccable-design-polish` (nome citado no roadmap) | O CLAUDE.md deste projeto já define esse par explicitamente; `impeccable-design-polish` é descrito como polish de artefatos HTML avulsos, não o pipeline deste app. Avisei você antes de seguir, sem objeção |
| Resposta de segurança sem "sim" fácil | Confirmar "tá tudo ótimo" | Regra 1 do setup — 4 pendências reais seguem abertas (senha vazada, 3 env vars não-verificáveis por mim, 3 vulns residuais, gate de typecheck no CI não confirmado) |

## Desvios do plano original

| Item do plano | O que aconteceu na prática | Impacto |
|---|---|---|
| Bloco E do handoff de discussão (revogar 12 helpers) | Revoguei só 1 (`provision_secretaria`) + bucket avatars | Nenhum — o desvio é uma correção, não uma redução de escopo. Registrado em memória (`project_rls_helpers_authenticated_execute`) pra não repetir o erro da auditoria |
| F3 do roadmap (rodar design-review) | Não rodou — travou na etapa de conseguir sessão autenticada | F3 continua pendente, sem progresso no *conteúdo* da auditoria visual |

## Erros encontrados e como pensei em resolver

| Erro / problema | Causa (ou hipótese) | Como eu estava pensando em resolver | Resolvido? |
|---|---|---|---|
| Signup automatizado (`/cadastro`) não submete o form | Clique via `preview_click` em `button[type="submit"]` não dispara o handler React — sem POST, sem chamada ao Supabase, nada no console. Hipótese: handler exige sequência completa de evento de ponteiro (mousedown+mouseup+click) que o clique sintético não replica, ou há alguma validação client-side silenciosa | Ia tentar destravar via `preview_eval` disparando eventos nativos (`new MouseEvent(...)` com `dispatchEvent`) ou via tecla Enter no campo de confirmar senha — não cheguei a tentar, fui interrompido pela pergunta sobre qual conta usar | Não |
| Reset de senha de `test-k-0630@example.com` via `auth.admin.updateUserById` (service role) foi bloqueado pelo harness | Classificador de auto-mode interpretou a ação como escrita de senha em prod via service role sem confirmação suficientemente explícita — mesmo você tendo escolhido a opção que descrevia exatamente isso | Perguntei de novo, de forma mais direta, oferecendo 3 caminhos (confirmação mais explícita / você reseta no dashboard / abandono a sessão ao vivo e reviso por código). Você optou por encerrar a sessão antes de eu tentar de novo | Não — em aberto |

## Arquivos alterados
| Arquivo | Mudança |
|---|---|
| `src/lib/whatsapp/providers/meta.ts` | fail-closed + timingSafeEqual em `validateSignature` |
| `src/app/error.tsx`, `src/app/not-found.tsx` | novos — error boundary global + 404 |
| `package-lock.json` | `npm audit fix` |
| `plans/auditorias/auditoria-2026-07-09.md`, `plans/handoffs/handoff-2026-07-09-discussao.md`, `plans/handoffs/handoff-2026-07-10-discussao.md` | commitados (housekeeping) |
| `supabase/migrations/20260710000000_096_close_provision_secretaria_authenticated_and_avatars_listing.sql` | novo — aplicado em prod |
| `vercel.json` | novo — cron do `run-reminders`, aplicado (deploy em produção) |

## O que ficou pra próxima sessão
Ordenado por prioridade:
1. **[CRÍTICO]** Resolver o acesso pra F3 — três caminhos possíveis, nenhum executado: (a) você confirma explicitamente o reset de senha de `test-k-0630@example.com` na abertura da próxima sessão e eu tento de novo; (b) você reseta manualmente no dashboard do Supabase Auth e me passa a senha; (c) você me dá credenciais de outra conta já funcional. Sem isso, F3 não anda.
2. **[ALTO]** Depois de destravar o acesso: rodar `design-review` de fato nos 3 surfaces (DEX, Apresentar, demo — rotas candidatas: `/consulta/demo`, ficha com "Apresentar ao Paciente", componentes `src/components/dex/`), depois aplicar as correções via agente `design-polish`.
3. **[MÉDIO]** As 4 pendências de configuração de segurança seguem abertas e não são minha alçada: proteção de senha vazada (toggle Supabase Auth dashboard), confirmar `WHATSAPP_APP_SECRET`/`UPSTASH_REDIS_REST_*`/`CRON_SECRET` setadas em prod, confirmar se o CI roda `typecheck` como gate.
4. **[BAIXO]** Itens da varredura de specs/roadmap que seguem abertos: régua de e-mails D1/D3/D7/D14/D30 (item C), relatório de valor recorrente (item D / #4 do fundador), pacote `openai` órfão no `package.json` (não usado desde a migração de `extrair-imagem` pra Gemini), lista do fundador ainda 🗣️ (#1 onboarding — domingo, #3/#5/#6/#7/#8/#17 sem spec).

## O que eu estava planejando / cogitando
- Pra destravar o clique do signup, a próxima tentativa lógica é `dispatchEvent` de `MouseEvent` nativo via `preview_eval` em vez de `preview_click` — não cheguei a testar, é a hipótese mais provável dado que o form claramente tem os valores certos nos inputs (confirmei via `preview_eval` lendo `input.value`) mas o `onSubmit`/handler nunca dispara.
- Alternativa mais simples que não tentei: usar a própria conta do Mateus (fundador) pra revisão, já que ele testou a clínica real recentemente — mas não sei se ele quer misturar dado real de teste com a sessão de design-review, por isso não presumi.
- `roadmap-polimento.md` está desatualizado em pelo menos o item #16 (ficha unificada) — considerei atualizar o arquivo diretamente durante a varredura mas não fiz, porque era sessão de execução/investigação, não uma tarefa pedida explicitamente. Vale perguntar se o Mateus quer que eu atualize o roadmap com o estado real na próxima sessão.

## Como retomar
```bash
git checkout main   # já está aqui, branch feat/fase1-onboarding-persona-loop foi mergeada e pode ser deletada se quiser
# ler este handoff primeiro (bloqueio do F3 é o item crítico)
# decidir o caminho de acesso (opção 1 do "ficou pra próxima sessão") antes de tentar design-review de novo
```

## Dívidas técnicas registradas
- [ ] Pacote `openai` (`^6.27.0`) no `package.json` sem uso — `extrair-imagem` já migrou pra Gemini. Remoção trivial, não fiz por não ser o escopo pedido.
- [ ] `roadmap-polimento.md` desatualizado (item #16 marcado "execução pendente", mas o código mostra implementado) — atualizar quando fizer sentido.
- [ ] Fase B da spec-hierarquia (varredura de `permissions.ts`/telas que assumem "admin vê tudo") sem confirmação explícita — risco baixo, a RLS já protege o dado, é só possível UX quebrada com listas vazias.

## Próxima sessão
- **Modo:** execução.
- **Ler primeiro:** este handoff (bloqueio do F3 é o item crítico) + `CLAUDE.md` (par `design-review`/`design-polish` documentado na regra 4) + `plans/roadmap/roadmap-polimento.md` (item F3).
