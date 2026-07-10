# Handoff — 2026-07-10 (discussão → planejamento)

> **Modo:** este documento nasceu como handoff de discussão e foi **atualizado nesta mesma data** para planejamento, a pedido do Mateus — sem trocar de arquivo. A seção nova é o checklist de commits abaixo; o raciocínio da discussão (decisões, fatos verificados, contrapontos) foi preservado como histórico.
> **Insumos:** `handoff-2026-07-09-discussao.md` (os 5 debates) + `plans/auditorias/auditoria-2026-07-09.md` (diagnóstico) + `plans/roadmap/roadmap-polimento.md`.
> **Contexto de calendário:** hoje é sexta 10/07. Mateus viaja e volta **sábado à tarde** e testa. Meta: o mais próximo de 100% (funcionalidades + commits + segurança) até **domingo 12/07**. Domingo = onboarding, exclusivo. Segunda = frente de pagamento.
> **Regra de execução:** commits de código podem acontecer fora desta sessão de planejamento (regra 6 do setup — planejamento no máximo faz spike descartável). O que segue é o **plano**, a codificação roda na sessão de execução que sucede este handoff.

---

## Decisões tomadas (Mateus bateu o martelo)

| Decisão | O que significa | Debate que fecha |
|---|---|---|
| **WhatsApp sai da equação** | Aguardando CNPJ pra pedir a API Meta. Nenhum trabalho de integração agora; o canal volta à pauta quando o CNPJ sair | Debate 1 (e boa parte do 5) — resolvido por circunstância, não por posicionamento |
| **Semana que vem = plataforma de pagamento** | Segunda começa a implementação dessa frente. Mateus cogitou **até excluir o AbacatePay** (ver decisão abaixo) | Reposiciona o Debate 5: o "próximo grande investimento" já foi escolhido — billing |
| **Fim de semana = arrumar a casa** | Funcionalidades, commits e segurança o mais próximo de 100%. Sexta: eu arrumo. Sábado à tarde: Mateus chega de viagem e **testa**. Até domingo: correções | Define a janela dos endurecimentos de baixo-debate da auditoria |
| **Onboarding: polida fica pra domingo** | Foco exclusivo nele no domingo (item #1 do fundador no roadmap). Não misturar com a arrumação de sexta/sábado — **zero escopo de onboarding decidido nesta sessão** | — |
| **Testes automatizados: fora do fim de semana** | Malha de testes é pós-teste, começando pelas actions de dinheiro | Debate 3 adiado sem dor |
| **Bump do `next`: não agora** | `npm audit fix` entra na arrumação; bump de framework não, sem malha de regressão | Debate 4 fechado (audit fix sim, bump depois) |

## Fatos técnicos verificados (read-only — a execução pode confiar)

1. **Prod está 8 commits atrás da branch.** `origin/main` = `69ccd12` (04/07). A branch `feat/fase1-onboarding-persona-loop` tem à frente: voice-fix (`4d0a457`), fixes de segurança do storage/silo (`ca20833`), o checkpoint de hierarquia/ficha/largura/IA (`d879ee1`), fixes de RPC (`97692a9`) e a leva do loop clínico (`c4b5b11`). **Nada disso está no ar.**
2. **O banco de prod tem TODAS as 95 migrations aplicadas** (confirmado via MCP — inclui `089_hierarquia_silo_rls` e `090_storage_drop_legacy_broad_policies`, de 05–06/07). **Prod roda código de 04/07 contra schema/RLS de 06/07.** Pra dentista solo passa despercebido; o teste de sábado é com 5 dentistas + 2 secretárias — cenário que só o código da branch entende. **O merge é pré-requisito do teste, não polimento.**
3. **Não existe `vercel.json`** → o cron de `run-reminders` **nunca roda em prod**. Risco latente, não dano ativo. Os pontos de envio acessíveis por UI têm try/catch — mudar o stub de "finge sucesso" pra "falha honesta" não quebra nada visível.
4. **O webhook (`api/whatsapp/webhook`) já devolve 401** quando `validateSignature` retorna `false` → fail-closed é plug-and-play, nenhum caller muda. `reminders.ts` só marca `whatsapp_reminder_sent` **depois** do envio bem-sucedido — fail-honest não corrompe estado.
5. **`spec-A-onboarding-persona.md` já foi implementada** (migration `081`, no ar desde 03/07) — é o rebuild da máquina de passos (identidade→aha→plano), coisa diferente do pedido atual do Mateus pro onboarding ("modo consulta bem explicado + peculiaridades"). **Domingo começa do zero em termos de escopo**, não reaproveita essa spec.

## Decisões desta sessão sobre os contrapontos (defaults aplicados — Mateus pode sobrescrever a qualquer momento)

| # | Contraponto | Default adotado | Por quê | Reversível? |
|---|---|---|---|---|
| 1 | AbacatePay: manter ou remover agora | **Manter como está.** Nenhum commit toca nele este fim de semana | É o código de referência de segurança do sistema; remover na véspera é churn sem ganho pro teste. Decisão de provider definitivo é segunda | Sim — decisão de segunda-feira, não travada |
| 2 | Timing do merge/deploy | **Merge + deploy ainda sexta à noite/sábado de manhã**, smoke antes do Mateus testar à tarde | Testar prod real (dentia.app.br) vale mais que preview; prod hoje está no estado misto, pior que a branch | Se algo quebrar no smoke, dá pra reverter o deploy antes das 14h de sábado |
| 3 | DB writes (REVOKE EXECUTE + policy do bucket avatars) | **Commitar os arquivos de migration agora; NÃO aplicar em prod sem o "ok" explícito do Mateus** (regra da casa: escrita em prod sempre confirmada) | Resolve o impasse sem violar a regra — o código fica pronto, o gatilho de aplicar é seu | Migration não aplicada = zero risco até você confirmar |
| 4 | Conta de teste pro smoke | **Posso criar uma via signup normal** (padrão `test-*` já usado no projeto) | É fluxo de app padrão, não é escrita privilegiada via service-role/migration — não se enquadra na regra de confirmação de DB write | Deletável a qualquer momento |

---

## Commits a fazer (hoje sexta → sábado de manhã, antes do deploy)

Tudo na branch atual (`feat/fase1-onboarding-persona-loop`). Cada linha é um commit atômico — a ordem importa pouco, exceto o `npm audit fix` que deve vir depois dos commits de código pra não confundir o que quebrou o quê.

### A. Segurança (rápido, sem dependência de nada)
- [ ] **`fix(seguranca): fail-closed na validação de assinatura do webhook WhatsApp`**
  `src/lib/whatsapp/providers/meta.ts` → `validateSignature()`: quando `WHATSAPP_APP_SECRET` ausente, retornar `false` (hoje retorna `true`). Trocar a comparação `signature === expected` por `crypto.timingSafeEqual`, igual ao padrão já usado em `webhooks/abacatepay`. Vale independente da pausa do WhatsApp — a rota `api/whatsapp/webhook` continua publicamente alcançável e já devolve 401 corretamente quando a validação falha (fato 4).

### B. Resiliência / UX de erro (novos usuários batendo em prod no fim de semana)
- [ ] **`feat(resiliencia): app/error.tsx global`** — client component, boundary de erro. Usar os tokens reais do projeto: `bg-bg`, `text-text-primary`, `text-text-secondary`, `bg-coral-pale`/`text-coral` pro acento, `Button` de `@/components/ui/button` (variants `outline` + default). **Não usar os nomes genéricos shadcn** (`bg-background`, `text-foreground`) — não existem nesse projeto.
- [ ] **`feat(resiliencia): app/not-found.tsx`** — 404 global, mesma família de tokens.

### C. Dependências
- [ ] **`chore(deps): npm audit fix`** (sem `--force`) — resolve o subconjunto seguro dos 22 vulns. Depois: `npm run typecheck` (ou `tsc --noEmit`) + `npm run build` pra confirmar que nada quebrou. **Não** bump de `next` além do que o audit fix já resolver sozinho.

### D. Housekeeping do `plans/`
- [ ] **`chore(plans): commitar auditoria + handoffs untracked`** — `plans/auditorias/auditoria-2026-07-09.md`, `plans/handoffs/handoff-2026-07-09-discussao.md`, `plans/handoffs/handoff-2026-07-10-discussao.md` (este arquivo).

### E. Endurecimento condicional — commitar, **não aplicar** sem confirmação (ver decisão #3 acima)
- [ ] **`feat(seguranca): REVOKE EXECUTE dos helpers SECURITY DEFINER de authenticated`** — nova migration em `supabase/migrations/`, cobrindo `belongs_to_active_clinic`, `get_my_role`, `is_clinic_admin`, `provision_secretaria` etc. Arquivo commitado; `apply_migration` só roda com o "ok" do Mateus.
- [ ] **`feat(seguranca): restringe listagem do bucket avatars`** — nova migration ajustando a policy `avatars_public_read` pra não permitir listagem. Mesmo gate.

### F. Opcional/stretch — só se sobrar tempo
- [ ] Zod `safeParse` nas 2 actions de dinheiro (`criarOrcamento`, `registrarPagamento`) — sem Zod em nenhuma action hoje, mas não é bloqueador do teste.
- [ ] Fail-honest nos stubs `sendText`/`sendFile` de `meta.ts` (`throw` em vez de `console.log` + sucesso falso) — baixa prioridade agora que o cron nunca dispara (fato 3) e o canal está pausado. Pode ficar pra quando o WhatsApp voltar à pauta.

### Config a verificar (não é commit — dashboard Vercel/Supabase)
- [ ] `UPSTASH_REDIS_REST_*` setado em prod (senão rate-limit é decorativo).
- [ ] CI roda `npm run typecheck` como gate (já que `next.config.ts` tem `ignoreBuildErrors: true`).
- [ ] Ligar proteção de senha vazada (HaveIBeenPwned) no Supabase Auth dashboard.

### Depois dos commits
- [ ] Merge da branch → `main` → deploy → smoke no ambiente real (conta de teste, decisão #4) — timing conforme decisão #2.

---

## Erro de processo da sessão de discussão (registrado pra não repetir)

Nessa mesma data, ainda em modo discussão, comecei a **executar** itens (editei `meta.ts`, criei `error.tsx`) — Mateus cortou: a regra 6 não abre exceção pra "item trivial". Tudo revertido (`git restore` + `rm`). A fronteira é o modo da sessão, não o tamanho da mudança. Registrado em memória (`feedback_discussao_zero_codigo`) pra não repetir.

## Como retomar (sessão de execução)

```bash
git checkout feat/fase1-onboarding-persona-loop
# ler, nesta ordem:
#   este handoff                                 (checklist de commits + decisões + fatos)
#   plans/auditorias/auditoria-2026-07-09.md     (diagnóstico completo, seção 6 = plano priorizado)
# codar os blocos A–D direto; E fica pronto mas não aplicado; F só se sobrar tempo.
# depois: merge + deploy + smoke (ver "Depois dos commits").
```

## Dívidas técnicas registradas (não entram no fim de semana)
- [ ] AbacatePay — decisão de manter ou trocar de provider fica pra segunda (frente de pagamento).
- [ ] Bump de `next` além do que `audit fix` resolve.
- [ ] Malha de testes (unidade nas actions de dinheiro, e2e do loop clínico).
- [ ] Onboarding de domingo — **precisa de escopo próprio do zero**, não reaproveita `spec-A-onboarding-persona.md`. Se envolver UI nova, passa por design-brief antes de codar (regra 4).

## Próxima sessão
- **Modo:** execução.
- **Ler primeiro:** este handoff (checklist de commits, seção "Commits a fazer") + `plans/auditorias/auditoria-2026-07-09.md` (seção 6, contexto de cada item).
- **Escopo:** blocos A, B, C, D direto. Bloco E commita mas não aplica. Bloco F só se sobrar tempo. Depois: merge/deploy/smoke.
