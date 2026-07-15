# Auditoria técnica — Odonto.IA (DentAI)

> **Data:** 2026-07-09 · **Escopo:** varredura read-only completa (segurança, arquitetura, bugs, maturidade SaaS).
> **Método:** análise estática de 317 arquivos / ~56k linhas, 95 migrations, `npm audit`, Supabase advisors (via MCP, read-only), inspeção de RLS/webhooks/rotas.
> **Nada foi alterado no código.** Este documento é diagnóstico — a correção é decisão de outra sessão.
> **Régua:** o teste com clínica real (2 secretárias + 5 dentistas) está próximo — priorizei o que quebra dinheiro, vaza dado entre clínicas, ou trava o loop clínico.

---

## Sumário executivo

**Veredito geral: base sólida e madura para o estágio.** A arquitetura multi-tenant é séria — RLS por-dentista (silo) com defense-in-depth (filtro de `clinica_id` na aplicação **e** policies no banco), TypeScript estrito sem `any`, webhooks de billing com HMAC timing-safe + idempotência, `service_role` isolado em pouquíssimos pontos. Isso não é protótipo; é um SaaS com higiene de segurança acima da média para pré-lançamento.

**Os riscos reais não são de arquitetura — são de completude e configuração:**

| # | Severidade | Achado | Impacto |
|---|---|---|---|
| P0-1 | 🔴 Alto | **WhatsApp Meta provider é 100% stub** (envio/recebimento/mídia são `console.log`) | Lembretes/confirmações/orçamentos "enviados" são no-op silencioso |
| P0-2 | 🔴 Alto | **Validação de assinatura do webhook WhatsApp falha-aberto** se `WHATSAPP_APP_SECRET` ausente | Qualquer um pode POSTar comprovante PIX falso → marca pagamento |
| P1-1 | 🟠 Médio | **1 vuln crítica + 7 high** em dependências (`protobufjs`, `next`, `ws`) | Superfície de exploração transitiva |
| P1-2 | 🟠 Médio | **Zero validação de schema (Zod) nas server actions** | Confia só em RLS+TS; dados malformados passam |
| P1-3 | 🟠 Médio | **Sem `error.tsx` / `not-found.tsx` em todo o app** | Erro não tratado → tela crua do Next, possível vazamento de stack |
| P2-x | 🟡 Baixo | 12 funções `SECURITY DEFINER` executáveis por `authenticated`, bucket `avatars` lista arquivos, `next.config` mascara erro de tipo, rate-limit parcial | Endurecimento incremental |

O teste da semana **não está bloqueado** por nenhum P0 desde que: (a) o WhatsApp esteja com credenciais Meta reais **ou** a clínica saiba que WhatsApp está off; (b) `WHATSAPP_APP_SECRET` esteja setada em prod.

---

## 1. Segurança

### 1.1 O que está BOM (não mexer)

- **Isolamento multi-tenant é defense-in-depth.** Toda rota que recebe um `id` de recurso escopa por `clinica_id` na query (ex: `fichas/[id]/pdf`, `pacientes/[id]/prontuario`, `dex/patient-context`) **e** o RLS-silo (migration `089_hierarquia_silo_rls`) bloqueia no banco mesmo se a aplicação esquecer. Testei o padrão em ~6 rotas — consistente. IDOR cross-clínica está fechado nas duas camadas.
- **`service_role` (bypass de RLS) confinado.** Só aparece em `src/lib/supabase/service.ts` e é consumido por: webhooks de billing, `provision_secretaria` (via `team.ts`), `activateTrial`. Nenhum uso solto em rota de leitura de usuário final. ✓
- **Webhook AbacatePay (`webhooks/abacatepay`)** — referência de como fazer: HMAC-SHA256 **timing-safe** (`crypto.timingSafeEqual`), Zod valida o shape, idempotência via `external_payment_id UNIQUE`, cross-check `orcamento.clinica_id`. Exemplar. ✓
- **Cron de lembretes (`whatsapp/run-reminders`)** protegido por `CRON_SECRET` no header `Authorization`. ✓
- **`.env` / `.env.local` NÃO estão versionados** (só `.env.example`). Confirmado via `git ls-files`. ✓
- **Sem `dangerouslySetInnerHTML`.** Os builders de HTML (`prontuario-html.ts`) têm helper `esc()` aplicado em todas as interpolações de dados do usuário (32 usos). XSS no export/PDF mitigado. ✓
- **TypeScript estrito honrado:** zero `any` no código (`grep` limpo). ✓
- **`SUPER_USERS` está vazio** — não há e-mail hardcoded com bypass de plano/role. ✓
- **Middleware** protege `/dashboard` e `/onboarding`, resolve sessão via `getUser()` (valida JWT no servidor, não confia em cookie). ✓

### 1.2 🔴 P0-2 — Validação de assinatura WhatsApp falha-aberto

**Arquivo:** `src/lib/whatsapp/providers/meta.ts:346-358`

```ts
validateSignature(rawBody, signature): boolean {
  // TODO: habilitar após plugar WHATSAPP_APP_SECRET
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.warn('[meta] ... validação de assinatura desabilitada');
    return true;   // ← FALHA-ABERTO
  }
  ...
}
```

O POST de `api/whatsapp/webhook` chama isso antes de processar. Se `WHATSAPP_APP_SECRET` não estiver setada em produção, **o webhook aceita qualquer payload não assinado**. Como o mesmo webhook processa comprovantes PIX (`analyzeReceipt → matchReceiptToOrcamento`) e cria/identifica pacientes, um atacante que descubra a URL pode: marcar pagamentos como recebidos, injetar mensagens no fluxo do bot, criar pacientes-fantasma.

**Risco:** alto **se** a secret não estiver em prod. Baixo se estiver. **Ação:** garantir `WHATSAPP_APP_SECRET` em prod e trocar o fail-open por fail-closed (retornar `false` quando a secret faltar). O padrão correto já existe no `webhooks/abacatepay` (retorna 500 se secret ausente).

### 1.3 🟡 Supabase advisors (via linter oficial)

- **12 funções `SECURITY DEFINER` executáveis por `authenticated`** via `/rest/v1/rpc/*` (`belongs_to_active_clinic`, `get_my_role`, `is_clinic_admin`, `provision_secretaria`, etc.). São helpers de RLS — risco real baixo (retornam booleano/uuid do próprio contexto, não escrevem), mas `provision_secretaria` **escreve** em 4 tabelas. Ela já tem `REVOKE ... FROM anon` (migration 095) e valida input, mas segue executável por `authenticated`. **Ação:** `REVOKE EXECUTE ... FROM authenticated` nos helpers puros e em `provision_secretaria` (nenhum caller client-side usa a via RPC direta — só `service_role`). [Doc](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- **Bucket `avatars` (público) permite listagem** — policy `avatars_public_read` com SELECT amplo deixa clientes listarem todos os arquivos. Buckets públicos não precisam disso pra servir URL. **Ação:** restringir a policy de listagem. [Doc](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)
- **`billing_events` com RLS ligado e zero policy** — na prática é *deny-all* (só `service_role` escreve), então é **seguro por padrão**. Só documentar a intenção. (INFO)
- **Proteção contra senha vazada (HaveIBeenPwned) desabilitada** no Supabase Auth. Win fácil de segurança. **Ação:** ligar no dashboard. [Doc](https://supabase.com/docs/guides/auth/password-security)

### 1.4 Observações menores de segurança

- **Rate-limit por `x-forwarded-for` primeiro-hop** (`rate-limit.ts:80`) é spoofável, mas é o padrão da indústria atrás de proxy confiável (Vercel). Aceitável.
- **Fallback de rate-limit em memória** (`memoryStore`) é **por-instância** — em serverless (Vercel) cada lambda tem o seu, então o limite real só existe com Upstash configurado. Sem Upstash, o rate-limit é praticamente decorativo. Confirmar que `UPSTASH_REDIS_REST_*` está em prod.

---

## 2. Dependências (`npm audit --omit=dev`)

**22 vulnerabilidades: 1 crítica, 7 high, 13 moderate, 1 low.** Quase todas transitivas.

| Pacote | Sev | Via (pai) | Nota |
|---|---|---|---|
| `protobufjs` ≤7.6.2 | 🔴 Crítica | `@google/genai` | Prototype pollution / code exec. Uso é sandbox (parsing interno do SDK), mas é crítica nominal |
| `next` 16.1.6 | 🟠 High | direto | Vários advisories (cache poisoning, DoS, CSRF em Server Actions com origin null). Muitos são dev-only/edge |
| `ws` 8.x | 🟠 High | `supabase-js`, `openai`, `@google/genai` | Memory disclosure / DoS |
| `@xmldom/xmldom` | 🟠 High | `mammoth`, `officeparser` | XML injection — relevante pois vocês parseiam `.docx` de upload |
| `fast-uri`, `hono`, `path-to-regexp`, `picomatch` | 🟠 High | transitivos (`@modelcontextprotocol/sdk`, etc.) | — |

**Ação:** `npm audit fix` resolve a maioria sem breaking. `next` merece bump para o patch mais recente da linha 16.x (correções de cache-poisoning e Server Actions CSRF são relevantes pra um SaaS autenticado). `@xmldom/xmldom` merece atenção porque `mammoth`/`officeparser` processam arquivos que o usuário faz upload — validar/limitar isso.

---

## 3. Arquitetura e qualidade de código

### 3.1 Pontos fortes

- **Separação limpa:** `server/auth`, `server/authorization`, `server/services`, `lib/` bem fatiados. `requireClinicContext` e `getDentistaCached` centralizam auth com `React.cache()` (dedup por request). Exatamente o que o CLAUDE.md prega.
- **Padrão de erro consistente** nas actions: `{ error?: string }` tipado, log server-side com `code`, mensagem amigável pro cliente.
- **Idempotência e cross-check** no billing são de nível produção.

### 3.2 🟠 P1-2 — Server actions sem validação de schema

**0 de 13** arquivos `actions.ts` no dashboard usam Zod. As actions confiam em: (a) tipos TypeScript (que somem em runtime), (b) RLS (que protege tenant/injeção, mas não regra de negócio). Zod só aparece nos webhooks.

**Impacto:** um cliente malicioso/bugado pode mandar payload malformado (número onde espera string, campo faltando, valor negativo em preço) e a action processa até bater no banco. RLS não valida *forma*, valida *permissão*. Ex: `criarPacienteRapido({ nome, telefone })` — nada impede `nome` de 10.000 chars.

**Ação:** adotar Zod `safeParse` na entrada das actions de escrita (têm `zodResolver` no projeto, o hábito existe no client — falta no server). Não é bloqueador do teste, é dívida de robustez.

### 3.3 🟠 P1-3 — Ausência total de error boundaries

`find` por `error.tsx` / `global-error.tsx` / `not-found.tsx` em `src/app`: **zero**. Qualquer exceção não capturada em Server Component cai na tela de erro padrão do Next — em prod some o stack, mas é UX ruim e em dev/preview pode vazar detalhe. Só há 4 `loading.tsx`.

**Ação:** ao menos um `app/error.tsx` (boundary global) + `app/not-found.tsx`. O skill `error-handling` do projeto cobre exatamente isso.

### 3.4 `next.config.ts` mascara erros de tipo no build

```ts
typescript: { ignoreBuildErrors: true }
```

Justificado no comentário (tsc roda separado no CI, evita OOM). Aceitável **se** o CI realmente roda `npm run typecheck` como gate. Se não roda, um erro de tipo chega em prod. **Ação:** confirmar o gate de CI.

### 3.5 Débito pontual

- **`hasDentistaRegistro` (`lib/auth.ts`) sem escopo de clínica** (TODO documentado). Só decide roteamento pós-login (dashboard vs onboarding) no client — **não é fronteira de segurança** (o `requireClinicContext` redireciona de qualquer forma). Baixo. Um usuário multi-clínica pode cair no dashboard de uma clínica onde ainda não completou onboarding.
- **59 casts `as unknown as`** — a maioria é para contornar tipos do Supabase sem schema gerado. Funciona, mas cada cast é um ponto cego de tipo. Considerar `supabase gen types` para tipar as queries.
- **20 TODOs** — 13 deles são os stubs do WhatsApp (ver P0-1).

---

## 4. 🔴 P0-1 — WhatsApp está desligado (stub), não "com bug"

**Arquivo:** `src/lib/whatsapp/providers/meta.ts`

`sendText` (`:117`), `sendFile` (`:147`), `sendInteractive` (`:191`), `downloadMedia` (`:244`) são **stubs** — cada um faz `console.log('[meta:...] TODO ...')` e retorna sucesso falso, sem tocar a Graph API da Meta.

**Impacto de produto (não de segurança):** todo o pilar de WhatsApp que o CLAUDE.md chama de prioridade (confirmação, lembrete, follow-up, envio de orçamento) **é no-op silencioso** se o provider ativo for o Meta stub. O `run-reminders` "envia" lembretes que nunca chegam. Pior: retorna sucesso, então o sistema *acha* que enviou.

**Ação:** antes de prometer WhatsApp à clínica de teste, ou (a) plugar as credenciais Meta e remover os stubs, ou (b) deixar explícito no produto que WhatsApp está inativo. É a maior lacuna entre o que o sistema *parece* fazer e o que *faz*.

---

## 5. Maturidade SaaS (visão de produto)

| Dimensão | Estado | Nota |
|---|---|---|
| Multi-tenancy | ✅ Forte | RLS-silo + app-layer, testado em silo (`supabase/tests/silo_dois_dentistas.sql`) |
| Billing | ✅ Bom | AbacatePay com webhook robusto; trial de 14 dias com bloqueio de Modo Consulta ao expirar |
| Auth/onboarding | ✅ Bom | Fluxo de convite, provisão transacional de secretária, troca de senha forçada |
| Observabilidade | 🟡 Parcial | Logs estruturados em billing/AI; **sem** Sentry/error tracking; sem error boundary |
| Testes | 🔴 Fraco | 1 teste SQL de silo. Zero teste de unidade/integração no `src/`. Nenhuma rede de segurança para regressão |
| Rate limiting | 🟡 Parcial | Só rotas de IA; PDF/prontuário/user sem throttle; fallback em memória inócuo em serverless |
| WhatsApp | 🔴 Stub | Ver P0-1 |
| Resiliência | 🟡 | Sem error boundaries; `ignoreBuildErrors` no build |

**Leitura estratégica:** o produto está mais maduro em *fundação* (segurança, tenancy, billing) do que em *operação* (observabilidade, testes, o canal WhatsApp). Isso é o inverso do típico protótipo — é uma base boa esperando os canais e a rede de testes. Para o teste com clínica real, a fundação aguenta; o risco é operacional (WhatsApp mudo, erro não tratado assustando o usuário, nenhum teste pegando regressão na véspera).

---

## 6. Plano de ação priorizado

### Antes do teste com a clínica (bloqueadores operacionais)
1. **[P0-2]** Garantir `WHATSAPP_APP_SECRET` em prod **e** trocar fail-open por fail-closed em `meta.ts:validateSignature`.
2. **[P0-1]** Decidir WhatsApp: plugar credenciais Meta reais **ou** comunicar à clínica que está off (não deixar "enviar" no-op).
3. **[config]** Confirmar em prod: `UPSTASH_REDIS_REST_*` (senão rate-limit é decorativo) e que o CI roda `typecheck`.

### Endurecimento (semanas seguintes)
4. **[P1-1]** `npm audit fix` + bump do `next` para o patch mais recente da 16.x. Atenção a `@xmldom/xmldom` (parsing de upload).
5. **[P1-3]** Adicionar `app/error.tsx` + `app/not-found.tsx` (skill `error-handling`).
6. **[P1-2]** Zod `safeParse` nas server actions de escrita.
7. **[P2]** `REVOKE EXECUTE ... FROM authenticated` nos helpers `SECURITY DEFINER` + `provision_secretaria`. Restringir listagem do bucket `avatars`. Ligar proteção de senha vazada no Supabase Auth.

### Dívida de fundação (contínuo)
8. Introduzir testes (unidade nas actions críticas de dinheiro; e2e do loop clínico). Hoje a rede de segurança é 1 arquivo SQL.
9. Error tracking (Sentry) — hoje não há visibilidade de erro em prod.
10. `supabase gen types` para reduzir os 59 casts `as unknown as`.

---

## 7. O que NÃO é problema (para não perder tempo)

- Isolamento entre clínicas — está fechado nas duas camadas.
- `billing_events` sem policy — é deny-all intencional, seguro.
- `service_role` — bem confinado.
- `.env` no disco — não está versionado.
- Ausência de `any` / uso de tokens de design — disciplina de código respeitada.
- Os 6 itens da leva desta sessão (loop clínico) — revisados, tsc/eslint limpos, já commitados/pushados.

---

*Auditoria read-only. Nenhuma linha de código ou configuração foi alterada. As queries diretas à base de produção foram bloqueadas pela política de auto-mode (correto — prod=dev); os dados de RLS/advisors vieram do linter oficial do Supabase, que é read-only por natureza.*
