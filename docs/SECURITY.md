# Segurança — DentAI

## Arquitetura Multi-tenant via RLS

O DentAI usa **Row Level Security (RLS) do PostgreSQL** como camada principal de isolamento entre clínicas. Cada tabela de negócio possui a coluna `clinica_id` (FK para `clinicas.id`) e políticas RLS que garantem que um usuário autenticado acesse apenas dados da sua própria clínica.

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

---

## Detalhamento das Políticas

### `clinicas`
```sql
-- Cada dentista vê apenas sua clínica
SELECT: id = get_my_clinica_id()
-- Qualquer autenticado pode criar clínica (onboarding)
INSERT: true (WITH CHECK)
-- Dentista atualiza apenas sua própria clínica
UPDATE: id = get_my_clinica_id()
```

### `dentistas`
```sql
-- Acesso completo a membros da mesma clínica
ALL: clinica_id = get_my_clinica_id()
-- No INSERT, user_id deve ser o próprio usuário
INSERT (adicional): user_id = auth.uid()
```

### `fichas` e `configuracoes_clinica`
```sql
-- Restrito a roles admin e dentista (secretaria não escreve fichas clínicas)
ALL: clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista')
```

### `convites`
```sql
-- Apenas admin e dentista podem gerenciar convites
ALL: clinica_id = get_my_clinica_id() AND get_my_role() IN ('admin','dentista')
```

### Demais tabelas de negócio
```sql
-- Padrão: qualquer membro da clínica tem acesso total
ALL: clinica_id IN (
  SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()
)
```

### `procedimentos_padrao`
```sql
-- Leitura pública para autenticados (catálogo de referência)
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
| `NEXT_PUBLIC_GEMINI_API_KEY` | Somente servidor* | Transcrição e IA |
| `OPENAI_API_KEY` | **Somente servidor** | Processamento de documentos |

> *`NEXT_PUBLIC_` é exposta ao bundle do cliente — revisar se essa chave deve ser apenas server-side.

---

## Rate Limiting

O arquivo `src/lib/rate-limit.ts` implementa rate limiting nas API routes sensíveis.

### Endpoints protegidos

| Endpoint | Limite sugerido | Motivo |
|---|---|---|
| `/api/transcrever` | 10 req/min por IP | Custo de IA |
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
- [x] Testes de isolamento executados em 2026-03-28 — todos passaram (ver seção abaixo)

### Autenticação
- [x] Rotas protegidas por middleware Supabase Auth
- [x] Refresh de sessão automático via middleware
- [x] Fluxo de recuperação de senha com PKCE

### Secrets e exposição
- [x] `SUPABASE_SERVICE_ROLE_KEY` nunca usada no cliente
- [x] Chaves de IA usadas apenas em Route Handlers (server-side)
- [ ] Auditar se `NEXT_PUBLIC_GEMINI_API_KEY` pode ser movida para server-only

### Dados sensíveis
- [ ] CPF de pacientes: avaliar criptografia em repouso
- [ ] Logs de IA não persistem dados de pacientes além do necessário

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
6. **Testar isolamento** antes de fazer deploy: criar dois usuários em clínicas diferentes e verificar que cada um vê apenas seus dados.

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
**Método:** SQL via Supabase SQL Editor com `SET LOCAL role = 'authenticated'` e `SET LOCAL "request.jwt.claims"` para simular usuários reais.
**Script reutilizável:** `scripts/test-isolation.sql`

### Clínicas usadas nos testes

| | Clínica A | Clínica B |
|---|---|---|
| Nome | Mateus Teixeira | Clindent |
| `clinica_id` | `60fdd3b1-...` | `615a1c53-...` |
| `user_id` | `5f16b64a-...` | `dac2587e-...` |

### Resultados

| # | Cenário | Operação | Resultado |
|---|---|---|---|
| T01 | User A lê `pacientes` | SELECT | ✅ PASS — retornou 1 row, apenas da clínica A |
| T02 | User A lê paciente específico da clínica B | SELECT por ID | ✅ PASS — 0 rows (bloqueado) |
| T03 | User A lê `fichas` | SELECT | ✅ PASS — retornou 1 row, apenas da clínica A |
| T04 | User B lê `fichas` | SELECT | ✅ PASS — retornou 2 rows, apenas da clínica B |
| T05 | User B lê ficha específica da clínica A | SELECT por ID | ✅ PASS — 0 rows (bloqueado) |
| T06 | User A insere paciente com `clinica_id` da clínica B | INSERT | ✅ PASS — erro `42501` (RLS violation) |
| T07 | User A atualiza orçamento da clínica B | UPDATE | ✅ PASS — 0 rows afetados (silencioso) |
| T08 | User A lê `orcamentos` | SELECT | ✅ PASS — retornou 1 row, apenas da clínica A |
| T09 | Usuário anônimo (`anon`) lê `pacientes` | SELECT | ✅ PASS — 0 rows (sem política para anon) |
| T10 | User A deleta ficha da clínica B | DELETE | ✅ PASS — 0 rows afetados, ficha intacta |
| T11 | Qualquer autenticado lê `procedimentos_padrao` | SELECT | ✅ PASS — 23 rows (catálogo compartilhado) |
| T12 | User A insere em `procedimentos_padrao` | INSERT | ✅ PASS — erro `42501` (RLS violation) |

### Comportamentos confirmados

- **SELECT cross-clinic** → retorna 0 rows silenciosamente (sem erro, sem vazar dados)
- **INSERT cross-clinic** → lança `ERROR 42501: new row violates row-level security policy` — impede inserção com `clinica_id` errado
- **UPDATE/DELETE cross-clinic** → afeta 0 rows silenciosamente — a query executa mas não encontra nada visível
- **Usuário anônimo** → sem políticas para `anon`, todas as queries retornam vazio
- **`procedimentos_padrao`** → leitura liberada para autenticados; escrita bloqueada por RLS

### Como re-executar

1. Abrir o Supabase SQL Editor do projeto DentAI
2. Copiar o conteúdo de `scripts/test-isolation.sql`
3. Substituir os placeholders (`CLINICA_A_USER_ID`, etc.) pelos UUIDs reais
4. Executar cada bloco e verificar se `resultado = 'PASS'`

---

## Histórico de Correções

| Data | Migração | Descrição |
|---|---|---|
| 2026-03-28 | `020_security_rls_fixes` | Habilitou RLS em `procedimentos_padrao`; removeu escrita aberta; removeu políticas `{public}` redundantes em `planejamentos` e `planejamento_etapas`; adicionou UPDATE policy em `clinicas` |
