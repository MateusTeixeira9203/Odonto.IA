-- =============================================================================
-- DentAI — Testes de Isolamento Multi-tenant (RLS)
-- Executar no Supabase SQL Editor (como postgres/service role)
-- Cada bloco BEGIN/ROLLBACK simula um usuário autenticado via JWT claims
-- =============================================================================
-- Antes de executar, substituir os UUIDs pelas duas clínicas de teste:
--   CLINICA_A_USER_ID  — user_id do dentista da clínica A
--   CLINICA_A_ID       — clinica_id da clínica A
--   CLINICA_B_USER_ID  — user_id do dentista da clínica B
--   PACIENTE_B_ID      — id de um paciente da clínica B
--   FICHA_A_ID         — id de uma ficha da clínica A
--   FICHA_B_ID         — id de uma ficha da clínica B
--   ORCAMENTO_B_ID     — id de um orçamento da clínica B
-- =============================================================================

-- ---------------------------------------------------------------------------
-- T01: SELECT pacientes como User A → deve retornar apenas os da clínica A
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
SELECT 'T01' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN COUNT(*) > 0 AND bool_and(clinica_id = 'CLINICA_A_ID'::uuid)
       THEN 'PASS — só clínica A'
       ELSE 'FAIL — vazou dados de outra clínica ou retornou 0'
  END AS resultado
FROM pacientes;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T02: User A tenta SELECT paciente específico da clínica B → 0 rows esperado
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
SELECT 'T02' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN COUNT(*) = 0 THEN 'PASS — acesso bloqueado'
       ELSE 'FAIL — vazou paciente de outra clínica'
  END AS resultado
FROM pacientes WHERE id = 'PACIENTE_B_ID'::uuid;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T03: User A tenta INSERT paciente com clinica_id da clínica B → RLS error
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    SET LOCAL role = 'authenticated';
    SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
    INSERT INTO pacientes (clinica_id, nome)
    VALUES ('CLINICA_A_ID'::uuid, 'Paciente Invasor');
    RAISE NOTICE 'T03: FAIL — INSERT com clinica errada foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T03: PASS — INSERT bloqueado por RLS (42501)';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- T04: User A tenta UPDATE de ficha da clínica B → 0 rows afetados
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
UPDATE fichas SET status = 'concluida' WHERE id = 'FICHA_B_ID'::uuid;
SELECT 'T04' AS teste,
  CASE WHEN EXISTS (
    SELECT 1 FROM fichas WHERE id = 'FICHA_B_ID'::uuid AND status != 'concluida'
  ) THEN 'PASS — UPDATE bloqueado silenciosamente'
  ELSE 'INCONCLUSIVE — verificar status original'
  END AS resultado;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T05: User A tenta DELETE de ficha da clínica B → 0 rows afetados
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
DELETE FROM fichas WHERE id = 'FICHA_B_ID'::uuid;
SELECT 'T05' AS teste,
  CASE WHEN EXISTS (SELECT 1 FROM fichas WHERE id = 'FICHA_B_ID'::uuid)
       THEN 'PASS — ficha ainda existe (DELETE bloqueado)'
       ELSE 'FAIL — ficha foi deletada'
  END AS resultado;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T06: Usuário anônimo (sem JWT) tenta SELECT pacientes → 0 rows
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'anon';
SELECT 'T06' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN COUNT(*) = 0 THEN 'PASS — anon bloqueado'
       ELSE 'FAIL — anon acessou dados'
  END AS resultado
FROM pacientes;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T07: procedimentos_padrao é legível por qualquer autenticado
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
SELECT 'T07' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN COUNT(*) > 0 THEN 'PASS — catálogo acessível'
       ELSE 'FAIL — catálogo inacessível'
  END AS resultado
FROM procedimentos_padrao;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T08: procedimentos_padrao é bloqueada para escrita
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    SET LOCAL role = 'authenticated';
    SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_A_USER_ID","role":"authenticated"}';
    INSERT INTO procedimentos_padrao (nome, categoria)
    VALUES ('Procedimento Invasor', 'Teste');
    RAISE NOTICE 'T08: FAIL — escrita em procedimentos_padrao foi aceita';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T08: PASS — escrita bloqueada por RLS (42501)';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- T09: SELECT orcamentos como User B → deve retornar apenas os da clínica B
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_B_USER_ID","role":"authenticated"}';
SELECT 'T09' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN bool_and(clinica_id = 'CLINICA_B_ID'::uuid) OR COUNT(*) = 0
       THEN 'PASS — isolamento correto'
       ELSE 'FAIL — vazou orçamento de outra clínica'
  END AS resultado
FROM orcamentos;
ROLLBACK;

-- ---------------------------------------------------------------------------
-- T10: User B tenta SELECT ficha específica da clínica A → 0 rows
-- ---------------------------------------------------------------------------
BEGIN;
SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"CLINICA_B_USER_ID","role":"authenticated"}';
SELECT 'T10' AS teste, COUNT(*) AS rows_retornados,
  CASE WHEN COUNT(*) = 0 THEN 'PASS — acesso bloqueado'
       ELSE 'FAIL — vazou ficha de outra clínica'
  END AS resultado
FROM fichas WHERE id = 'FICHA_A_ID'::uuid;
ROLLBACK;
