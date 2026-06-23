# Segurança — Odonto.IA

## Arquitetura Multi-tenant via RLS

O Odonto.IA usa **Row Level Security (RLS) do PostgreSQL** como camada principal de isolamento entre clínicas. Cada tabela de negócio possui a coluna `clinica_id` (FK para `clinicas.id`) e políticas RLS que garantem que um usuário autenticado acesse apenas dados da sua própria clínica.

### Fluxo de autenticação e autorização

```
Usuário autenticado (Supabase Auth)
        │
        ▼
auth.uid()  →  tabela dentistas  →  clinica_id
                                          │
                                          ▼
                              RLS filtra todas as queries
```

1. O usuário faz login via Supabase Auth e recebe um JWT.
2. O JWT contém `auth.uid()` (UUID do usuário).
3. As políticas RLS consultam `dentistas.clinica_id WHERE user_id = auth.uid()` para obter a clínica do usuário.
4. Toda query é automaticamente filtrada por `clinica_id` — sem intervenção do código da aplicação.

Funções SQL auxiliares usadas nas políticas:
- `get_my_clinica_id()` — retorna o `clinica_id` do dentista autenticado (cacheada via `STABLE`)
- `get_my_role()` — retorna o `role` do dentista autenticado (`admin`, `dentista`, `secretaria`)

---

## Status RLS por Tabela

### Tabelas de negócio (multi-tenant)

| Tabela | `clinica_id` | RLS | Políticas | Restrição de Role |
|---|---|---|---|---|
| `clinicas` | próprio `id` | ✅ | SELECT (própria), INSERT (auth), UPDATE (própria) | — |
| `dentistas` | ✅ | ✅ | ALL (mesma clínica), INSERT (próprio user_id) | — |
| `clinica_usuarios` | ✅ | ✅ | ALL (mesma clínica) | — |
| `users` | — | ✅ | SELECT/UPDATE (próprio auth.uid()) | — |
| `pacientes` | ✅ | ✅ | ALL | — |
| `fichas` | ✅ | ✅ | ALL | admin, dentista |
| `ficha_arquivos` | ✅ | ✅ | ALL | — |
| `orcamentos` | ✅ | ✅ | ALL | — |
| `orcamento_itens` | ✅ | ✅ | ALL | — |
| `pagamentos` | ✅ | ✅ | ALL | — |
| `planejamentos` | ✅ | ✅ | ALL | — |
| `planejamento_etapas` | ✅ | ✅ | ALL | — |
| `planejamento_secoes` | ✅ | ✅ | ALL | — |
| `agendamentos` | ✅ | ✅ | ALL | — |
| `horarios_disponiveis` | ✅ | ✅ | ALL | — |
| `configuracoes_clinica` | ✅ | ✅ | SELECT, ALL (write) | admin, dentista (escrita) |
| `conversas_bot` | ✅ | ✅ | ALL | — |
| `mensagens_bot` | ✅ | ✅ | ALL | — |
| `paciente_documentos` | ✅ | ✅ | ALL | — |
| `convites` | ✅ | ✅ | ALL | admin, dentista |

### Tabelas de referência (compartilhadas)

| Tabela | `clinica_id` | RLS | Políticas | Observação |
|---|---|---|---|---|
| `procedimentos_padrao` | ❌ | ✅ | SELECT (authenticated) | Catálogo público de referência; apenas service role escreve |
| `procedimentos` | ✅ | ✅ | ALL | Cópia por clínica durante onboarding |

> **Nota sobre `clinica_usuarios`:** tabela de membership muitos-para-muitos criada/ajustada durante o refactor do fluxo de convite (Jun/2026). Garante que convidados sejam corretamente associados à clínica em todos os caminhos de aceite (link de e-mail, callback OAuth, botão in-app).

> **Nota sobre `users`:** tabela custom que armazena `active_clinica_id` do usuário. Cada usuário lê/atualiza apenas o próprio registro (`WHERE auth.uid() = id`). Não tem `clinica_id` pois é por usuário, não por clínica.

---

## Detalhamento das Políticas

### `clinicas`
```sql
SELECT: id = get_my_clinica_id()
INSERT: true (WITH CHECK)
UPDATE: id = get_my_clinica_id()
```

### `dentistas`
```sql
ALL: clinica_id = get_my_clinica_id()
INSERT (adicional): user_id = auth.uid()
```

### `fichas` e `configuracoes_clinica`
```sql
ALL: clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista')
```

### `convites`
```sql
ALL: clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista')
```

### `users`
```sql
SELECT: id = auth.uid()
UPDATE: id = auth.uid()
```

### Demais tabelas de negócio
```sql
ALL: clinica_id IN (
  SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()
)
```

### `procedimentos_padrao`
```sql
SELECT TO authenticated: true
-- Escrita: bloqueada para usuários regulares (apenas service role)
```

---

## Variáveis de Ambiente Sensíveis

| Variável | Exposição | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública (cliente) | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública (cliente) | Chave anônima — opera sob RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Somente servidor** | Bypassa RLS — nunca expor no cliente |
| `GEMINI_API_KEY` | **Somente servidor** | Transcrição e IA (sem prefixo NEXT_PUBLIC_) |
| `GROQ_API_KEY` | **Somente servidor** | Transcrição via Whisper (migrado Jun/2026) |
| `RESEND_API_KEY` | **Somente servidor** | Envio de e-mails de convite |

> ⚠️ **ATENÇÃO:** Se houver qualquer variável com prefixo `NEXT_PUBLIC_GEMINI_API_KEY` no projeto, ela está exposta ao bundle do cliente. Deve ser renomeada para `GEMINI_API_KEY` (somente servidor).

---

## Rate Limiting

O arquivo `src/lib/rate-limit.ts` implementa rate limiting nas API routes sensíveis.

> ⚠️ **Estado atual (Jun/2026):** o Upstash Redis do plano gratuito expirou (`frank-sponge-87179.upstash.io` retorna `ENOTFOUND`). O código caiu no **fallback em memória** — rate-limit funciona mas é por-instância (não persiste entre restarts nem entre instâncias paralelas da Vercel). Não é urgente, mas reduz a eficácia do rate-limit em produção com múltiplas instâncias.
>
> **Ação pendente:** criar novo Redis no Upstash e atualizar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` nas env vars da Vercel e no `.env.local`.

### Endpoints protegidos

| Endpoint | Limite sugerido | Motivo |
|---|---|---|
| `/api/transcrever` | 10 req/min por IP | Custo de IA (Groq Whisper) |
| `/api/processar-documento` | 5 req/min por IP | Custo de IA |
| `/api/extrair-imagem` | 10 req/min por IP | Custo de IA |
| `/api/convite` | 5 req/min por usuário | Prevenção de spam |

---

## Checklist de Verificação

### Isolamento multi-tenant
- [x] Todas as tabelas de negócio têm `clinica_id` com FK para `clinicas(id)`
- [x] RLS habilitada em todas as tabelas de negócio
- [x] Nenhuma query no código usa `clinica_id` vindo do cliente — sempre via `getDentistaCached()`
- [x] `procedimentos_padrao` (tabela compartilhada) tem RLS com SELECT-only para usuários regulares
- [x] `clinica_usuarios` e `users` com RLS — fluxo de convite refatorado (Jun/2026)
- [x] Testes de isolamento executados em 2026-03-28 — todos passaram

### Autenticação
- [x] Rotas protegidas por middleware Supabase Auth
- [x] Refresh de sessão automático via middleware
- [x] Fluxo de recuperação de senha com PKCE
- [x] Callback `/auth/callback` cria estado canônico completo ao aceitar convite (Jun/2026)

### Secrets e exposição
- [x] `SUPABASE_SERVICE_ROLE_KEY` nunca usada no cliente
- [x] `GEMINI_API_KEY` sem prefixo `NEXT_PUBLIC_` — somente servidor
- [x] `GROQ_API_KEY` sem prefixo `NEXT_PUBLIC_` — somente servidor
- [ ] Auditar se há alguma chave de IA remanescente com prefixo `NEXT_PUBLIC_` no codebase
- [ ] CPF de pacientes: avaliar criptografia em repouso
- [ ] Logs de IA não persistem dados de pacientes além do necessário

### Funções SQL
- [x] `get_my_clinica_id`, `get_my_role`, `get_my_dentista_id` — REVOKE EXECUTE para `anon` (Mai/2026)
- [x] `get_convite_by_token` — mantido acessível para `anon` (necessário para validar links)
- [x] `update_updated_at` com `SET search_path = public` (migration 051)

---

## Orientações para Manutenção

### Ao criar nova tabela

1. **Sempre incluir `clinica_id`** como coluna NOT NULL com FK para `clinicas(id) ON DELETE CASCADE`.
2. **Habilitar RLS imediatamente:**
   ```sql
   ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;
   ```
3. **Criar política padrão:**
   ```sql
   CREATE POLICY "nova_tabela_all_policy" ON nova_tabela
     FOR ALL TO authenticated
     USING (clinica_id = get_my_clinica_id())
     WITH CHECK (clinica_id = get_my_clinica_id());
   ```
4. **Se a tabela exige role específica** (ex: só dentistas escrevem):
   ```sql
   CREATE POLICY "nova_tabela_write_policy" ON nova_tabela
     FOR ALL TO authenticated
     USING (clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista'))
     WITH CHECK (clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista'));
   ```
5. **Nunca usar role `{public}`** nas políticas — sempre `TO authenticated`.
6. **Testar isolamento** antes de fazer deploy.

### Ao adicionar query no código

- Sempre buscar `clinica_id` via `getDentistaCached()` (server-side), nunca via parâmetro do cliente.
- Em Route Handlers, validar que o usuário autenticado pertence à clínica dos dados que está manipulando.
- Nunca usar `supabaseServiceRole` para queries que deveriam ser filtradas por RLS.

### Ao criar Storage bucket

- Configurar políticas de Storage análogas ao RLS: verificar `clinica_id` no path ou no metadata do arquivo.
- Padrão de path recomendado: `{clinica_id}/{entidade_id}/{arquivo}`.

---

## Testes de Isolamento Executados

**Data:** 2026-03-28  
**Script reutilizável:** `scripts/test-isolation.sql`

| # | Cenário | Resultado |
|---|---|---|
| T01 | User A lê `pacientes` | ✅ PASS — retornou apenas da clínica A |
| T02 | User A lê paciente específico da clínica B | ✅ PASS — 0 rows |
| T03–T05 | Cross-clinic em `fichas` | ✅ PASS |
| T06 | User A insere paciente com `clinica_id` da clínica B | ✅ PASS — erro 42501 |
| T07 | User A atualiza orçamento da clínica B | ✅ PASS — 0 rows |
| T08 | User A lê `orcamentos` | ✅ PASS — apenas clínica A |
| T09 | Usuário anônimo lê `pacientes` | ✅ PASS — 0 rows |
| T10 | User A deleta ficha da clínica B | ✅ PASS — 0 rows |
| T11 | Qualquer autenticado lê `procedimentos_padrao` | ✅ PASS — catálogo completo |
| T12 | User A insere em `procedimentos_padrao` | ✅ PASS — erro 42501 |

> Testes cobrem tabelas do estado de Mar/2026. Tabelas adicionadas depois (`clinica_usuarios`, `paciente_documentos`) devem ser re-testadas.

---

## Histórico de Correções

| Data | Migração / Commit | Descrição |
|---|---|---|
| 2026-03-28 | `020_security_rls_fixes` | Habilitou RLS em `procedimentos_padrao`; removeu políticas `{public}` redundantes; adicionou UPDATE policy em `clinicas` |
| 2026-05-04 | migrations 050, 051 | REVOKE EXECUTE anon em funções auxiliares; `clinicas_insert_policy` com check de dentista existente; `update_updated_at` search_path |
| 2026-06-22 | commits `444cb09`, `f11d7d8` | Fluxo de convite: callback cria estado canônico completo (`clinica_usuarios` + `users.active_clinica_id`); notificação in-app usa PK correta de `dentistas`; `emailEnviado` deixou de ser falso-positivo |
