# Handoff de execução — 2026-07-06 09:36

> Sessão de **discussão** que virou **revisão de segurança + commits**. Não escrevi feature nova; revisei o que a execução aplicou na spec-seguranca, verifiquei achados no código real, investiguei o bug do agendamento e organizei a working tree em 2 commits.
> **Próxima sessão: EXECUÇÃO.** Este é o checklist. O "porquê" e os contratos estão nos specs — **aponto, não repito**.

## Specs / handoffs de referência (fonte da verdade)
- `plans/specs/spec-seguranca-silo-validacao.md` — blindagem do silo (RLS/service-role/storage). **IMPLEMENTADA + validada** (harness 63/63).
- `plans/handoffs/handoff-2026-07-05-2300.md` — sessão de execução que aplicou a spec-seguranca (contexto do que foi feito, erros, pendências).
- `plans/specs/spec-hierarquia-papeis-planos.md` — papéis/silo/planos. **Código feito, NÃO validado ao vivo.**
- `plans/roadmap/roadmap-polimento.md` — mapa geral (IA, ficha, largura, etc.).

---

## Estado atual — LER ANTES DE TUDO

**Git:** branch `feat/fase1-onboarding-persona-loop`, working tree **limpa**, **nada pushado**. 2 commits novos nesta sessão:
| Commit | Conteúdo |
|---|---|
| `ca20833` | **Segurança** (isolado) — F2 fix + migrations 090-093 + harness + spec-seguranca |
| `d879ee1` | **Checkpoint** (44 arq.) — IA + ficha + largura + hierarquia + docs, **NÃO validado ao vivo** |

**Descompasso prod ↔ código (importante):**
- **Prod DB** (`zenfemoxvwerplrjgfqz`): migrations **089-093 já aplicadas e vivas**. O vazamento cross-clínica (F1) já está fechado em produção.
- **Prod código** (deploy = `main`): **não tem nada disso ainda**. `main` está em `69ccd12`; todo o trabalho está na branch de feature, não mergeado, não deployado.
- Consequência: o banco de prod está **à frente** do código de prod. F1 (o urgente) está protegido pelo DB; o F2 (código) só chega em prod quando a branch for deployada.

---

## Checklist de execução

### A. Pronto pra aplicar (com spec/contrato definido)

- [ ] **[ALTO] Ligar proteção de senha vazada (HaveIBeenPwned).** Supabase Dashboard → Authentication → Policies → Password Security. **Só dá pelo dashboard** (sem MCP/SQL). Fecha o F6 da spec-seguranca (único gate manual que sobrou).
- [ ] **[MÉDIO] Fix do default de `agendamentos.status`** (migration 094). O default é `'agendado'` mas a CHECK só aceita inglês (`scheduled`/…) → viola a própria constraint. **Bug dormente** (os 4 inserts do app passam `status` explícito — não quebra hoje), mas é mina enterrada. Fix:
  ```sql
  ALTER TABLE agendamentos ALTER COLUMN status SET DEFAULT 'scheduled';
  ```
  ⚠️ Escrita em prod (dev=prod) — **confirmar com o fundador antes** (ver Gotchas). Versionar como `supabase/migrations/..._094_agendamentos_status_default.sql`.

### B. Verificação ao vivo (testar — não é re-codar)

- [ ] **[CRÍTICO] Validar a hierarquia ao vivo.** O silo de **banco** já está provado (harness `silo_dois_dentistas.sql`, 63/63) — então este teste é de **UX**, não de segurança: logar como dentista A e B na mesma clínica (A não vê nada de B nas telas), como secretária (vê tudo), testar **encaminhamento** (secretária troca o dentista responsável), e conferir que nenhuma tela quebra com **lista vazia** agora que a RLS filtra mais. Rótulo "Criador" no lugar de "admin". → *O fundador disse que faz essa validação.*
- [ ] **[MÉDIO] Testar o fix F2 ao vivo.** Assinar uma ficha como dois dentistas diferentes na mesma clínica; confirmar que o fluxo de assinatura na tela continua funcionando (só foi checado `tsc`/`eslint`, não abriram o app). Ref: `salvarAssinaturaConsulta` em `src/app/consulta/[agendamentoId]/actions.ts`.
- [ ] **[BAIXO] Validar o resto do checkpoint** (`d879ee1`) ao vivo, item a item — cada um tem sua spec:
  - IA precisão com **áudios reais** (`spec-precisao-extracao-consulta`).
  - `extrair-imagem` com **radiografia real** no Gemini → se prestar, remover OpenAI SDK + `OPENAI_API_KEY` (`spec-arquitetura-ia-providers`).
  - D12 (ficha 2 colunas) visual + destaque de região (`spec-16`).
  - Largura Fase B por tela (`spec-18`).

### C. Decisão antes de deployar (precisa do fundador)

- [ ] **[ALTO] Estratégia de deploy da segurança.** O commit `ca20833` (segurança, validado) está na branch junto com o `d879ee1` (não-validado). Opções:
  - **(a)** Validar a hierarquia primeiro → mergear a branch inteira pra `main` (leva tudo junto).
  - **(b)** `git cherry-pick ca20833` pra uma branch a partir de `main` → deployar só a segurança agora, sem esperar a validação do resto.
  - Urgência **baixa**: F1 (o grave) já está vivo no DB; o F2 em código é defesa-em-profundidade. Recomendação: **(a)**, a menos que queira o F2 em prod já.

### D. Opcional (defesa em profundidade / higiene)

- [ ] **[BAIXO]** Expandir o F4: revogar de `PUBLIC` os outros 4 `SECURITY DEFINER` expostos (`complete_onboarding`, `provision_secretaria`, `handle_new_auth_user`, `fn_clean_procs_on_ficha_delete`) — já auto-protegidos/trigger-only, mas fecha a superfície. Mesmo padrão da migration 093. Gate: confirmar que nenhum é chamado com a chave `anon` antes da sessão existir (a 23:00 confirmou que `complete_onboarding` se protege sozinho).
- [ ] **[BAIXO]** Considerar CI que roda `silo_dois_dentistas.sql` a cada PR que toque RLS. **Bloqueio:** hoje o harness insere em `auth.users` e só roda contra prod (projeto único) — precisa de casa segura (branch Supabase paga / shadow local) antes de virar CI.

---

## Decisões desta sessão
| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| 2 commits (segurança isolada / resto = checkpoint) | 5 commits por tópico (IA/ficha/largura/hierarquia/segurança) | Os arquivos de UI estão cruzados (ex.: `perfil-client` tem largura **e** rótulo Criador) — split fino exigiria cirurgia hunk-a-hunk sem ganho numa branch de feature. Segurança isola limpo (verificado) |
| Bug do agendamento fica pra execução, como fix de 1 linha | Corrigir agora nesta sessão | É escrita em prod (precisa confirmação) e está dormente — sem urgência |
| Não pushar | Pushar as branches | Fora do que o fundador pediu; push é outward-facing |

## Erros / verificações desta sessão (para não refazer)
| Suspeita levantada | O que verifiquei | Veredito |
|---|---|---|
| F1 (drop das policies amplas) quebraria upload em `radiografias`/`audios` (sem policy de UPDATE) | Não há **nenhum** upload client-side nesses buckets (só service-role, que ignora storage RLS); os uploads de `fichas` usam path `${clinicId}/…` que a policy por-clínica aceita | **F1 limpo** — nada quebrou |
| F2 usaria `dentistaId` que talvez não exista no contexto | `requireClinicContext()` (`src/server/auth/clinic.ts:16,72`) retorna `dentistaId` e **redireciona se nulo** (linha 66) → garantido não-nulo | **F2 correto** — atalho da execução é válido |
| Bug: `agendamentos.status DEFAULT 'agendado'` quebra criação de consulta | Os 4 inserts (`agendamentos/actions.ts:83,533`, `google-provider.ts:377`, `message-handler.ts:131`) passam `status:'scheduled'` explícito | **Dormente** — não quebra hoje |

## Gotchas (registrados, valem pra toda a execução)
- **prod = dev** (projeto Supabase único). Toda migration/DDL escreve em produção → **exige confirmação explícita do fundador** antes de aplicar (memória `feedback_prod_db_writes`).
- **Não pushar / não mergear pra `main` sem pedir.**
- O harness insere linhas reais em `auth.users` (dentro de `BEGIN…ROLLBACK`). Se re-rodar, ciente: `ROLLBACK` não desfaz efeito externo de trigger (e-mail/webhook) — a 23:00 vetou só o trigger `on_auth_user_created`.

## Como retomar
```bash
cd "C:/Users/mateu/Desktop/Odonto.IA-main"
git log --oneline -3          # ca20833 (segurança) + d879ee1 (checkpoint), tree limpa
git status --short            # vazio
# Ler: spec-seguranca-silo-validacao.md (o que está feito) + handoff-2026-07-05-2300.md (como foi feito)
# Prioridade: validar hierarquia ao vivo (fundador) + ligar senha-vazada + decidir deploy (item C)
```

## Dívidas técnicas registradas
- [ ] `agendamentos.status DEFAULT 'agendado'` viola `agendamentos_status_check` — fix = migration 094 (item A).
- [ ] Migration 091 ficou no histórico como no-op (corrigida pela 093) — só registro, não é dívida real (histórico é append-only).
- [ ] Checkpoint `d879ee1` acumula ~2 sessões de trabalho **não validado ao vivo** — validar antes de mergear pra `main`.
- [ ] Itens antigos ainda abertos: clínica morta com 23 procedimentos órfãos; índice em `procedimentos.dentista_id`; branch órfã `claude/brave-mccarthy-8c0d24`; OpenAI SDK sem uso após migração de visão (remover só depois de validar radiografia).

## Próxima sessão
- **Modo:** execução (aplicar itens A + validar B/C) — ou discussão, se quiser decidir a estratégia de deploy (item C) ou o CI do harness (item D) antes.
- **Ler primeiro:** este handoff + `spec-seguranca-silo-validacao.md` + `handoff-2026-07-05-2300.md`. Para a validação da hierarquia: `spec-hierarquia-papeis-planos.md`.
