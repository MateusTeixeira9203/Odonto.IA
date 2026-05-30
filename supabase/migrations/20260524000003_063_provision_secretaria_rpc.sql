-- Migration 063: provision_secretaria — RPC transacional para criação de secretária
--
-- Consolida em uma única transação Postgres:
--   1. public.users      (upsert — garante registro; set active_clinica_id)
--   2. dentistas         (upsert — compatibilidade legada com código existente)
--   3. clinica_usuarios  (insert — membership canônica, fonte da verdade)
--   4. secretarias       (upsert — perfil operacional com must_change_password)
--
-- Fluxo de uso no TypeScript:
--   1. Caller cria auth user via auth.admin.createUser() (fora de qualquer transação SQL)
--   2. Caller chama esta RPC com o uid retornado
--   3. Se a RPC falhar → Postgres reverte automaticamente os 4 passos acima
--   4. Caller é responsável pelo rollback compensatório: auth.admin.deleteUser(uid)
--
-- Por que SECURITY DEFINER:
--   Chamada via service_role que já bypassa RLS, mas a função precisa
--   rodar como owner (postgres) para escrever em tabelas com policies restritivas.
--
-- Permissão: service_role apenas (nunca chamada por authenticated diretamente).

CREATE OR REPLACE FUNCTION provision_secretaria(
  p_uid         uuid,
  p_email       text,
  p_nome        text,
  p_clinica_id  uuid,
  p_telefone    text  DEFAULT NULL,
  p_invited_by  uuid  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validação de inputs
  IF p_uid IS NULL OR p_email IS NULL OR p_nome IS NULL OR p_clinica_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: campos obrigatórios ausentes';
  END IF;

  -- Membership duplicada.
  -- clinica_usuarios usa partial unique index (WHERE status = 'ativo'), então
  -- não podemos depender do ON CONFLICT — verificação explícita é necessária.
  IF EXISTS (
    SELECT 1
    FROM   clinica_usuarios
    WHERE  usuario_id = p_uid
      AND  clinica_id = p_clinica_id
      AND  status     = 'ativo'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_MEMBERSHIP: usuário já é membro ativo desta clínica';
  END IF;

  -- ── 1. public.users ───────────────────────────────────────────────────────────
  -- Garante existência do registro e define a nova clínica como ativa.
  INSERT INTO public.users (id, email, active_clinica_id)
  VALUES (p_uid, p_email, p_clinica_id)
  ON CONFLICT (id) DO UPDATE
    SET email             = EXCLUDED.email,
        active_clinica_id = EXCLUDED.active_clinica_id;

  -- ── 2. dentistas (legado) ─────────────────────────────────────────────────────
  -- Código existente que lê de dentistas para resolver perfil/role.
  -- Mantido em sincronia para não quebrar código legado antes da migração completa.
  INSERT INTO dentistas (clinica_id, user_id, nome, email, telefone, role, ativo)
  VALUES (p_clinica_id, p_uid, p_nome, p_email, p_telefone, 'secretaria', true)
  ON CONFLICT (clinica_id, user_id) DO UPDATE
    SET nome     = EXCLUDED.nome,
        email    = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        role     = 'secretaria',
        ativo    = true;

  -- ── 3. clinica_usuarios (canônico) ────────────────────────────────────────────
  -- Membership real; duplicata seria capturada pelo check acima ou pela partial index.
  INSERT INTO clinica_usuarios (usuario_id, clinica_id, role, status, invited_by, joined_at)
  VALUES (p_uid, p_clinica_id, 'secretaria', 'ativo', p_invited_by, now());

  -- ── 4. secretarias (perfil operacional) ───────────────────────────────────────
  -- must_change_password = true garante troca de senha no primeiro login.
  -- uq_secretarias_usuario_clinica permite ON CONFLICT seguro.
  INSERT INTO secretarias (usuario_id, clinica_id, nome, telefone, must_change_password)
  VALUES (p_uid, p_clinica_id, p_nome, p_telefone, true)
  ON CONFLICT (usuario_id, clinica_id) DO UPDATE
    SET nome                 = EXCLUDED.nome,
        telefone             = EXCLUDED.telefone,
        must_change_password = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION provision_secretaria FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION provision_secretaria TO  service_role;
