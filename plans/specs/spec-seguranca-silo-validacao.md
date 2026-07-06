# Spec — Validação e blindagem do silo de segurança (RLS · service-role · storage)

> Criado 2026-07-05 (discussão → planejamento). Origem: pressão sobre a decisão "RLS via join/EXISTS" da spec-hierarquia. A investigação read-only descobriu que **o join não é o risco** (está barato e correto) — o risco é que **a RLS de tabela é só 1 de 3 camadas de isolamento**, e as outras duas têm buracos.
> **Status: PRONTA para execução.** Todos os achados foram confirmados read-only no banco de produção (`zenfemoxvwerplrjgfqz`) em 2026-07-05. Complementa `spec-hierarquia-papeis-planos.md` (que fechou a camada de tabela). **Aplicar antes de qualquer clínica real tocar o sistema.**
> **Modo da próxima sessão: execução.** Não re-escopar — o que está aqui, aplicar; o que não está, volta pro planejamento.

---

## 1. Objetivo

Provar — **determinística e sem depender de clínica real** — que o silo por dentista/clínica é íntegro nas **três** camadas onde dado clínico trafega, e fechar os buracos encontrados.

O teste "logar como dois dentistas numa clínica real" valida **UX** (encaminhamento, listas vazias). **Nunca** deve ser o gate de **segurança**: um vazamento de PHI descoberto assim já vazou, sobre paciente real. A prova de segurança é a simulação SQL (Frente 3), que roda hoje, sem clínica.

**Princípio-guia:** RLS de tabela é **1 de 3 camadas**. Service-role **bypassa** RLS por design; storage tem policies **próprias**, independentes das tabelas. As três precisam do mesmo silo, senão a garantia é ilusória.

---

## 2. As três camadas

| Camada | Quem filtra | Bypassa RLS de tabela? | Estado |
|---|---|---|---|
| **Tabela** (`fichas`, `orcamentos`, …) | RLS via `is_own_clinical_record()` | — | ✅ Limpa (conferida) |
| **Service-role** (`createServiceClient()`) | **o código da rota** | ✅ sim, sempre | 🟡 1 over-fetch + ~29 a classificar |
| **Storage** (`storage.objects`) | RLS própria em `storage.objects` | ✅ ignora a das tabelas | 🔴 vazamento cross-clínica |

---

## 3. Achados confirmados (read-only, produção, 2026-07-05)

| # | Achado | Camada | Sev. | Impacto |
|---|---|---|---|---|
| **A** | **Policies legadas amplas em storage.** `fichas`/`radiografias`/`audios` têm cada uma a policy `ALL` (role `authenticated`) com predicado só `auth.uid() IS NOT NULL` — zero checagem de clínica. Policies permissivas somam com **OR**, então ela **anula** as por-clínica. | Storage | 🔴 **ALTO** | Qualquer dentista logado de **qualquer clínica** lê/escreve/apaga radiografia, consentimento assinado e áudio de **todas** as clínicas. A `SELECT` ampla não restringe pasta → dá pra **listar** o bucket e enumerar paths. PHI cross-tenant. |
| **B** | **`salvarAssinaturaConsulta` sem filtro de dono.** Usa `createServiceClient()` (bypassa RLS) e valida a ficha por `clinica_id`+`paciente_id`, **sem** `dentista_id`. | Service-role | 🟡 MÉDIO | Um dentista assina/anexa na ficha de **outro dentista da mesma clínica** (precisa do `fichaId`+`pacienteId`). |
| **C** | **~29 outros arquivos usam service-role**, não classificados 1-a-1. Maioria legítima (webhook sem sessão, onboarding, bot nível-clínica). | Service-role | 🟡 MÉDIO | A confirmar — leitura de clínico sem filtro de dono é vazamento silencioso que a RLS não pega. |
| **D** | **Funções helper expostas via RPC.** `is_my_patient`, `is_own_clinical_record`, `get_my_dentista_id`, etc. são `SECURITY DEFINER` chamáveis por `anon`/`authenticated` em `/rest/v1/rpc/<nome>`. | Superfície | 🟡 MÉDIO | Oráculo de enumeração ("esse `dentista_id` é meu?") sem passar pela tabela. |
| **E** | **Bucket `avatars` público + listável** (`avatars_public_read` = `bucket_id='avatars'`, sem restrição de pasta). | Storage | 🟢 BAIXO | Listar todos os avatares. Baixa sensibilidade (foto de perfil). |
| **F** | **Proteção de senha vazada (HaveIBeenPwned) desligada** no Supabase Auth. | Auth | 🟢 BAIXO | Aceita senha comprovadamente vazada no cadastro. |
| **G** | **`search_path` mutável** em `fn_clean_procs_on_ficha_delete` (SECURITY DEFINER sem `search_path` fixo). | Função | 🟢 BAIXO | Vetor teórico de hijack via `search_path`. |
| **H** | **`relforcerowsecurity = false`** nas tabelas clínicas. | Tabela | ⚪ INFO | Só afeta quem conecta como **dono** da tabela — o app não faz, e o service-role bypassa por atributo de role, não ownership. **Registrar, não agir.** |

**Conferido OK — NÃO mexer:**
- RLS de tabela: 13 tabelas, cada uma só com as policies novas, **nenhuma permissiva legada** sobrando (o modo de falha nº1 de migration de RLS — descartado).
- Bucket `documentos`: privado, **sem** policies → só service-role acessa. OK, desde que os caminhos de código (Frente 2) filtrem por dono.
- `assinatura-actions.ts` (`salvarAssinaturaRecepcao`/`buscarFichaParaAssinar`): **só-secretária**, que vê tudo por design. **Não** é buraco.

---

## 4. Frentes de trabalho

Cada frente: **Problema → Solução → Artefato (SQL/código) → Verificação.**

### 🔴 Frente 1 — Storage cross-clínica (fazer PRIMEIRO — vazamento vivo)

**Problema (achado A):** 3 policies legadas amplas anulam o silo por-clínica dos buckets clínicos.

**Solução:** dropar as 3 policies amplas. As por-clínica já cobrem SELECT/INSERT/DELETE nos três buckets (INSERT com `WITH CHECK` clínica-escopado **confirmado**), então o silo por-clínica passa a valer.

**Artefato** — `supabase/migrations/20260705000001_090_storage_drop_legacy_broad_policies.sql`:
```sql
-- Remove as policies amplas que davam acesso cross-clínica aos buckets clínicos.
-- As policies por-clínica (fichas_objects_*, "dentistas podem ...") permanecem e
-- passam a ser o único controle → silo por clínica.
drop policy if exists "Dentistas acessam fichas"       on storage.objects;
drop policy if exists "Dentistas acessam radiografias" on storage.objects;
drop policy if exists "Dentistas acessam seus audios"  on storage.objects;
```

**Verificação (gate ANTES de aplicar):**
- ⚠️ `radiografias` e `audios` **não têm policy de `UPDATE`** hoje (só a ampla `ALL` cobria). Confirmar se algum upload client-side nesses buckets usa `upsert: true`:
  - Se **sim** → adicionar na mesma migration uma policy `UPDATE` clínica-escopada (espelhar `fichas_objects_update`).
  - Se os uploads são **via service-role ou insert-once** → nada a fazer (service-role ignora storage RLS; INSERT puro não precisa de UPDATE).
- `fichas` já tem `fichas_objects_update` clínica-escopado → OK.

**Verificação (DEPOIS de aplicar):**
```sql
-- Não deve sobrar nenhuma policy com predicado "auth.uid() IS NOT NULL" nos buckets clínicos:
select polname, pg_get_expr(polqual, polrelid) as using_expr
from pg_policy where polrelid = 'storage.objects'::regclass
  and pg_get_expr(polqual, polrelid) ilike '%auth.uid() IS NOT NULL%';
-- Esperado: 0 linhas para fichas/radiografias/audios.
```
- `get_advisors(security)` não deve mais listar acesso amplo nesses buckets.

---

### 🟡 Frente 2 — Auditoria service-role (o código é o silo aqui)

**Problema (achados B, C):** service-role bypassa RLS. Todo caminho sob sessão de **dentista** que lê/escreve clínico precisa filtrar por dono no código.

**Solução:** (1) corrigir o over-fetch confirmado; (2) classificar os 31 arquivos e registrar.

**Artefato — fix confirmado** em `src/app/consulta/[agendamentoId]/actions.ts`, função `salvarAssinaturaConsulta`:
```ts
// ANTES: pega clinicId+role, valida ficha só por clinica_id+paciente_id.
// DEPOIS: resolve o dentista dono e filtra a ficha por dentista_id.

const { supabase, user, clinicId, role } = await requireClinicContext();
if (role === 'secretaria') return { ok: false, error: 'Sem permissão' };

// dono: só o dentista que criou a ficha pode assiná-la
const { data: dentistaPerfil } = await supabase
  .from('dentistas').select('id')
  .eq('user_id', user.id).eq('clinica_id', clinicId).maybeSingle();
if (!dentistaPerfil) return { ok: false, error: 'Sem permissão' };

const db = createServiceClient();
const { data: ficha } = await db
  .from('fichas').select('id')
  .eq('id', fichaId)
  .eq('clinica_id', clinicId)
  .eq('paciente_id', pacienteId)
  .eq('dentista_id', dentistaPerfil.id)        // ← silo
  .maybeSingle();
if (!ficha) return { ok: false, error: 'Ficha não encontrada' };

// ... upload storage inalterado ...

const { error: dbErr } = await db
  .from('fichas')
  .update({ assinatura_url: storagePath, assinado_em: new Date().toISOString() })
  .eq('id', fichaId)
  .eq('clinica_id', clinicId)
  .eq('dentista_id', dentistaPerfil.id);        // ← silo
```

**Artefato — classificação dos 31 arquivos** (entregar como tabela no PR). Categorias:
- **Legítimo (sem sessão — manter):** `api/whatsapp/webhook`, `api/webhooks/abacate`, `api/webhooks/abacatepay`, `primeiro-acesso/*`, `auth/callback`, `bem-vindo-agregado`, `planos/*`, `server/services/{invites,team}`, `api/convite/*`, `api/user/{switch-clinic,clinicas}`, `lib/calendar/google-provider`, `lib/ai/logger`, `lib/supabase/service`.
- **Nível-clínica por design (bot — validar intenção, não ampliar):** `lib/whatsapp/{reminders,message-handler,send-pdf,template}`, `services/whatsapp.service`, `dashboard/{bot,whatsapp}/*`, `dashboard/configuracoes/whatsapp/*`, `dashboard/agendamentos/assinatura-actions` (secretária). Escopo do bot é decisão da **spec-hierarquia Fase C** — aqui só **registrar**.
- **Clínico sob sessão de dentista (DEVE filtrar por dono):** `consulta/[agendamentoId]/actions` → **fix acima**. Varrer os demais deste grupo, se houver, com o mesmo padrão.

**Padrão de correção:** `createServiceClient()` sob sessão de dentista → filtrar por `dentista_id = get_my_dentista_id()` (ou `dentistaPerfil.id` já resolvido). Service-role só se justifica para **storage** ou operação **sem** sessão; a parte de **DB** deve usar o cliente de usuário (RLS) sempre que possível.

**Verificação:** `tsc` + `eslint` limpos; tabela de classificação no PR; a Frente 3 confirma que o fix fecha o caso B.

---

### 🟡 Frente 3 — Harness de simulação dois-dentistas (ESTE é o gate de segurança)

**Problema:** o silo de tabela nunca foi provado ao vivo; a spec-hierarquia mudou o comportamento de produção sem ambiente de teste.

**Solução:** script SQL repetível que impersona dois dentistas + secretária e prova o isolamento, sem clínica real. Vira teste de regressão para toda mudança futura de RLS.

**Artefato** — `supabase/tests/silo_dois_dentistas.sql`:

1. **Seed descartável** (2 dentistas A/B + 1 secretária na MESMA clínica, cada dentista com ≥1 registro por tabela). Não usar dado de cliente real. Guardar os `user_id`/`dentista_id` gerados.

2. **Ground truth** (como service-role, RLS off): contar total por tabela e por dentista.

3. **Impersonar e assertar** (padrão Postgres):
```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<user_id_A>","role":"authenticated"}';
  -- Dentista A deve ver o próprio e ZERO do B:
  select 'fichas' as tabela, count(*) as visivel_por_A from fichas;               -- = own(A)
  select count(*) as fichas_de_B_vistas_por_A from fichas where dentista_id = '<dentista_id_B>'; -- DEVE 0
  -- repetir para cada tabela clínica...
rollback;
```

**Cobertura — tabelas e como testar o "vê do outro":**

| Tabela | `dentista_id` direto? | Assertiva "A vê 0 do B" |
|---|---|---|
| `fichas`, `orcamentos`, `pacientes`, `agendamentos`, `pagamentos`, `planejamentos`, `procedimentos`, `horarios_disponiveis` | ✅ direto | `count(*) where dentista_id = B` = 0 |
| `orcamento_itens` | via `orcamentos` | `count(*)` visível por A = só itens dos orçamentos de A |
| `planejamento_etapas` | via `planejamentos` | idem, ancorado em `planejamentos` de A |
| `planejamento_secoes`, `planejamento_procedimentos`, `paciente_documentos` | via `pacientes` | idem, ancorado em `pacientes` de A |

4. **Papel secretária:** impersonar a secretária → `count(*)` por tabela **== total da clínica** (vê tudo).

5. **Confirmar o fix da Frente 2 (caso B):** como dentista B, tentar `update fichas ... where id = <ficha de A>` → 0 linhas afetadas.

**Verificação:** todos os "vê do outro" = 0; secretária = total; script roda limpo e é re-executável.

---

### 🟡 Frente 4 — Fechar RPC exposto

**Problema (achado D):** helpers de RLS chamáveis por `anon` → oráculo de enumeração.

**Solução:** `REVOKE EXECUTE ... FROM anon` nos helpers de RLS. Manter `EXECUTE` para `authenticated` (a RLS depende deles).

**Artefato** — `supabase/migrations/20260705000002_091_revoke_helper_rpc_from_anon.sql`:
```sql
revoke execute on function public.is_my_patient(uuid)            from anon;
revoke execute on function public.is_own_clinical_record(uuid)   from anon;
revoke execute on function public.is_own_finance_record(uuid)    from anon;
revoke execute on function public.get_my_dentista_id()           from anon;
revoke execute on function public.get_my_role()                  from anon;
revoke execute on function public.get_my_clinica_id()            from anon;
revoke execute on function public.is_clinic_admin()              from anon;
revoke execute on function public.is_clinic_dentista()           from anon;
revoke execute on function public.has_active_membership()        from anon;
revoke execute on function public.belongs_to_active_clinic(uuid) from anon;
```

**Verificação (gate ANTES):** `grep` por `.rpc(` no client anônimo — nenhum desses helpers pode ser chamado sem login. (São helpers internos de policy; não deveriam ter caller no client.)
**Nota:** `complete_onboarding`, `provision_secretaria`, `handle_new_auth_user`, `fn_clean_procs_on_ficha_delete` **também** aparecem expostas — mas são fluxo/trigger, não oráculo. Varredura secundária: confirmar que nenhuma é chamada com a chave `anon` **antes** da sessão existir; se não, revogar de `anon` também. **Não** revogar `complete_onboarding` sem confirmar que o onboarding roda autenticado (risco de quebrar cadastro).

---

### 🟢 Frente 5 — DECISÃO RESOLVIDA: storage é por-CLÍNICA (não por-dentista)

**Contexto:** hoje o storage é clínica-escopado (path `clinicId/pacienteId/…`, não codifica `dentista_id`). A spec-hierarquia §3 pede silo **por dentista**. Surge a pergunta: o storage deve seguir?

**Decisão: fica por-CLÍNICA (opção a).** Não é só "mais barato" — é a **única opção consistente** com a regra de encaminhamento da própria spec-hierarquia ("a ficha é individual de quem criou, **não acompanha** o paciente").

**Por quê — o que se descartou:**
- **(b) Por-dentista via join no paciente** (barato de escrever): a policy leria o `pacienteId` do path e juntaria com `pacientes.dentista_id` (dono **atual**). No encaminhamento A→B, o paciente vira do Dr. B → o Dr. B passaria a ver **todas as radiografias/assinaturas que o Dr. A criou**, e o Dr. A **perderia o arquivo** — mas continuaria vendo a **linha** da ficha no banco (`fichas.dentista_id` fica congelado nele). Estado quebrado: Dr. A vê a ficha e **não abre a própria radiografia**. **Contradiz** "a ficha não acompanha o paciente". ❌
- **(c) Por-dentista via criador no path** (`clinicId/dentistaCriador/pacienteId/…`): fiel, mas exige **repath + migração de todos os objetos existentes** + reescrita de todo upload/download + exceção da secretária. Caro demais para o ganho. ❌

**Por que (a) é segura mesmo sendo por-clínica:** o controle **primário** é o banco. Para alcançar o arquivo de outro dentista, o Dr. B precisaria do **`fichaId` exato** (UUID não-adivinhável), que o silo de banco **esconde** dele (não vê a linha da ficha de A → não obtém o `fichaId`). O storage por-clínica é **defesa-em-profundidade**, não o controle principal. "Cada dentista carrega as suas fichas" continua garantido — **pelo banco**, não pelo storage.

**Ação:** nenhuma mudança de storage além da Frente 1. **Registrar o desvio** na spec-hierarquia (§3: silo total no banco; storage = exceção consciente clínica-escopada, justificada pela regra de encaminhamento). Revisitar só se um cliente exigir isolamento de arquivo entre dentistas da mesma clínica.

---

### 🟢 Frente 6 — Menores

| Item | Achado | Ação | Custo |
|---|---|---|---|
| `avatars` listável | E | Trocar `avatars_public_read` por leitura por-objeto (sem `list`) **ou** aceitar (foto de perfil, baixa sensibilidade) — decisão barata | baixo |
| Senha vazada | F | Ligar HaveIBeenPwned no painel Auth do Supabase | 1 clique |
| `search_path` mutável | G | `alter function public.fn_clean_procs_on_ficha_delete() set search_path = public, pg_temp;` | 1 linha |
| `relforcerowsecurity` | H | **Nada** — registrar como INFO | — |

---

### 🟢 Frente 7 — Versionar migrations aplicadas via MCP

**Problema:** a `089_hierarquia_silo_rls` foi aplicada só via MCP, sem arquivo em `supabase/migrations/` (o repo espera histórico versionado — última em disco é a `087`).

**Solução:** ao criar as 090/091 desta spec, **materializar a 089 em arquivo** (dump das policies/funções atuais da hierarquia) para o histórico ficar íntegro. Nome: `supabase/migrations/2026070400000X_089_hierarquia_silo_rls.sql`.

**Verificação:** `list_migrations` (MCP) vs `ls supabase/migrations` — sem lacunas.

---

## 5. Invariantes (verdadeiras ao fim)

1. Nenhum objeto de `fichas`/`radiografias`/`audios` é acessível por usuário de **outra clínica** (Frente 1).
2. Todo caminho service-role sob sessão de dentista filtra clínico por `dentista_id` do dono (Frente 2).
3. A simulação SQL (Frente 3) mostra **dentista = só o próprio**, **secretária = tudo**, em todas as tabelas clínicas — e é repetível.
4. Nenhum helper de RLS é chamável por `anon` (Frente 4).
5. Storage é clínica-escopado por decisão consciente; o silo por-dentista vive no banco (Frente 5).
6. Migrations 089/090/091 existem em `supabase/migrations/` (Frente 7).

---

## 6. Gates de aceite (checklist)

- [x] **F1** — 3 policies amplas dropadas (migration 090); query de verificação retornou 0 linhas p/ fichas/radiografias/audios; uploads não afetados (nenhum código atual escreve nesses buckets com `upsert:true` — confirmado via grep).
- [x] **F2** — `salvarAssinaturaConsulta` filtra por `dentista_id` (via `requireClinicContext().dentistaId`, sem query redundante); tabela de classificação dos 31 arquivos entregue; `tsc`+`eslint` limpos.
- [x] **F3** — `silo_dois_dentistas.sql` passou 63/63 no baseline e 5/5 na confirmação pós-F1+F2 (todos "vê do outro" = 0; secretária = total; update cross-dentista = 0 linhas). Script salvo em `supabase/tests/`.
- [x] **F4** — helpers revogados de `anon` (migration 091 + correção 093 — o 091 sozinho não bastou: `EXECUTE` vinha de `PUBLIC`, não de um grant específico a `anon`; `REVOKE ... FROM anon` foi no-op até revogar de `PUBLIC` também). Nenhum caller anônimo quebrado (grep confirmou zero `.rpc()` client-side pra esses 10 helpers).
- [x] **F6** — `search_path` fixado (migration 092); avatars aceito como está (baixa sensibilidade, SELECT e LIST usam o mesmo predicado no RLS de storage — não dá pra separar sem repensar a arquitetura do bucket); senha vazada — **ação manual pendente** (painel Auth do Supabase, sem endpoint via MCP/SQL).
- [x] **F7** — 089/090/091/092/093 versionadas em `supabase/migrations/`; `list_migrations` vs `ls` sem lacuna.
- [x] `get_advisors(security)` re-rodado: sem os WARNs de storage amplo (fichas/radiografias/audios) e sem os 10 helpers de RLS na lista anon-executável. Restam: `avatars_public_read` (aceito, F6), `complete_onboarding`/`provision_secretaria`/`handle_new_auth_user`/`fn_clean_procs_on_ficha_delete` anon-executáveis (checados individualmente — `complete_onboarding` deriva `auth.uid()` e lança `UNAUTHENTICATED` se nulo, benigno; os demais são trigger/service-role only, fora do escopo desta spec), e a senha vazada (pendente, manual).

---

## 7. Ordem de execução

1. **F3 (baseline)** — rodar o harness ANTES de mexer, pra ter o retrato do que já funciona (e pegar regressão).
2. **F1** — crítico e vivo; aplicar (com o gate do `upsert`).
3. **F2** — fix do over-fetch + classificação.
4. **F3 (confirmação)** — re-rodar; incluir a assertiva do caso B.
5. **F4 + F6 + F7** — baratos, agrupáveis num PR.
6. **F5** — sem código; só registrar o desvio na spec-hierarquia.

> ⚠️ **prod = dev** (projeto Supabase único). Toda migration/DDL desta spec escreve em produção — **exige confirmação explícita do fundador antes de aplicar** (ver memória `feedback_prod_db_writes`). Aplicar via MCP `apply_migration` **e** versionar o arquivo.

---

## 8. Fora de escopo

- Escopo de storage do **bot** (nível-clínica) — semana-WhatsApp / spec-hierarquia Fase C.
- Silo por-dentista **no storage** (Frente 5 opção b/c) — descartado, só reabre se cliente exigir.
- Reescrever `documentos`/`avatars` para dentista-escopo — não é vazamento hoje.
- Qualquer feature nova. Esta spec é **blindagem**, não produto.

---

## 9. Decisões registradas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Storage fica **por-clínica** | Por-dentista via join no paciente | O join no dono-atual faz o arquivo **acompanhar** o paciente no encaminhamento, contradizendo "a ficha não acompanha" e quebrando o acesso do criador |
| Storage por-clínica é **suficiente** | Por-dentista via criador no path | Controle primário é o banco; `fichaId` é UUID que a RLS esconde → storage é defesa-em-profundidade. Repath + migração de objetos não compensa |
| **Dropar** as policies amplas (não reescrever) | Reescrever as amplas com checagem de clínica | As por-clínica já existem e cobrem tudo; a ampla é pura sobra. Dropar é mais simples e sem risco |
| Simulação SQL é o **gate de segurança** | Esperar o teste com clínica real | Determinístico, sem clínica, repetível como regressão; o teste ao vivo valida UX, não segurança |
| `anon` perde os helpers de RLS; `authenticated` mantém | Revogar de ambos | A RLS **precisa** dos helpers para `authenticated`; só `anon` não tem razão de chamá-los |
