-- Migration 062: complete_onboarding() — transação atômica de onboarding
--
-- Problema resolvido:
--   O onboarding anterior fazia 4-5 inserts sequenciais sem transação.
--   Qualquer falha intermediária deixava dados zumbis (clínica sem usuário,
--   usuário sem membership, etc.), impedindo login e exigindo correção manual.
--
-- Solução:
--   Uma única função PL/pgSQL executa todos os passos dentro de uma transação
--   implícita do Postgres. Se qualquer etapa falhar (exceto o step 9, que usa
--   SAVEPOINT), a transação inteira é revertida automaticamente.
--
-- Passos transacionados:
--   1. Validação de auth e inputs
--   2. Guard de idempotência (já existe membership ativa?)
--   3. INSERT clinicas
--   4. INSERT dentistas
--   5. UPDATE users.active_clinica_id
--   6. INSERT clinica_usuarios (role = admin)
--   7. COPY procedimentos_padrao → procedimentos (best-effort, SAVEPOINT)
--
-- Segurança:
--   - SECURITY DEFINER para escrever em users sem RLS
--   - Valida auth.uid() como primeira linha do corpo
--   - GRANT restrito a authenticated
--   - Inputs normalizados internamente (trim, nullif)

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_plano         text,
  p_nome_clinica  text,
  p_nome_usuario  text,
  p_cro           text    DEFAULT NULL,
  p_especialidade text    DEFAULT NULL,
  p_telefone      text    DEFAULT NULL,
  p_cidade        text    DEFAULT NULL,
  p_estado        text    DEFAULT NULL,
  p_email         text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_clinica_id  uuid;
  v_dentista_id uuid;
  v_limite      int;
BEGIN

  -- ── 1. Auth ─────────────────────────────────────────────────────────────────
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: usuário não autenticado'
      USING ERRCODE = 'P0401';
  END IF;

  -- ── 2. Validação de inputs ───────────────────────────────────────────────────
  IF p_plano NOT IN ('SOLO', 'BASICO', 'CLINICA') THEN
    RAISE EXCEPTION 'INVALID_PLAN: plano inválido: %', p_plano
      USING ERRCODE = 'P0400';
  END IF;

  IF trim(coalesce(p_nome_clinica, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT: nome da clínica é obrigatório'
      USING ERRCODE = 'P0400';
  END IF;

  IF trim(coalesce(p_nome_usuario, '')) = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT: nome do usuário é obrigatório'
      USING ERRCODE = 'P0400';
  END IF;

  -- ── 3. Idempotency guard ─────────────────────────────────────────────────────
  -- Um usuário não pode criar múltiplas clínicas via onboarding.
  -- Multi-clínica é gerenciado via convites, não via onboarding repetido.
  IF EXISTS (
    SELECT 1 FROM clinica_usuarios
    WHERE usuario_id = v_user_id
      AND status     = 'ativo'
  ) THEN
    RAISE EXCEPTION 'ALREADY_ONBOARDED: usuário já possui uma clínica ativa'
      USING ERRCODE = 'P0409';
  END IF;

  -- ── 4. Limite de dentistas por plano ─────────────────────────────────────────
  v_limite := CASE p_plano
    WHEN 'SOLO'    THEN 1
    WHEN 'BASICO'  THEN 1
    WHEN 'CLINICA' THEN 5
    ELSE 1
  END;

  -- ── 5. Criar clínica ─────────────────────────────────────────────────────────
  v_clinica_id := gen_random_uuid();

  INSERT INTO clinicas (
    id, nome, plano, status,
    limite_dentistas, telefone, cidade, estado
  ) VALUES (
    v_clinica_id,
    trim(p_nome_clinica),
    p_plano,
    'ativa',
    v_limite,
    nullif(trim(coalesce(p_telefone, '')), ''),
    nullif(trim(coalesce(p_cidade,   '')), ''),
    nullif(trim(coalesce(p_estado,   '')), '')
  );

  -- ── 6. Criar perfil dentista ─────────────────────────────────────────────────
  v_dentista_id := gen_random_uuid();

  INSERT INTO dentistas (
    id, clinica_id, user_id, nome, cro,
    especialidade, telefone, email, role, ativo
  ) VALUES (
    v_dentista_id,
    v_clinica_id,
    v_user_id,
    trim(p_nome_usuario),
    nullif(trim(coalesce(p_cro,      '')), ''),
    p_especialidade,
    nullif(trim(coalesce(p_telefone, '')), ''),
    p_email,
    'admin',
    true
  );

  -- ── 7. Definir clínica ativa do usuário ──────────────────────────────────────
  -- public.users é criado automaticamente pelo trigger on_auth_user_created (migration 052).
  -- NOT FOUND aqui significa estado inválido: usuário auth sem linha em public.users.
  UPDATE users
  SET active_clinica_id = v_clinica_id
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: registro em public.users ausente para uid=%', v_user_id
      USING ERRCODE = 'P0404';
  END IF;

  -- ── 8. Criar membership (fonte da verdade de acesso) ─────────────────────────
  INSERT INTO clinica_usuarios (
    usuario_id, clinica_id, role, status
  ) VALUES (
    v_user_id, v_clinica_id, 'admin', 'ativo'
  );

  -- ── 9. Copiar procedimentos padrão ───────────────────────────────────────────
  -- Best-effort: usa sub-bloco com SAVEPOINT implícito.
  -- Falha aqui não reverte os 8 passos anteriores — a clínica fica funcional
  -- mas sem procedimentos pré-carregados (dentista adiciona manualmente).
  BEGIN
    INSERT INTO procedimentos (
      clinica_id, nome, descricao, categoria,
      preco_padrao, duracao_minutos, ativo
    )
    SELECT
      v_clinica_id,
      pp.nome,
      pp.descricao,
      pp.categoria,
      pp.preco_sugerido,
      pp.duracao_minutos,
      true
    FROM procedimentos_padrao pp
    WHERE pp.ativo = true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[complete_onboarding] Erro ao copiar procedimentos_padrao: %', SQLERRM;
  END;

  -- ── 10. Retornar IDs criados ─────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'clinica_id',  v_clinica_id,
    'dentista_id', v_dentista_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Re-raise: Postgres reverte a transação automaticamente.
  -- O bloco de exceção externo existe apenas para semântica documentada —
  -- sem ele o comportamento seria idêntico.
  RAISE;

END;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────────────
-- Apenas usuários autenticados podem chamar a função.
-- auth.uid() = NULL para anon → a função rejeitaria de qualquer forma,
-- mas revogar explicitamente é mais seguro e bloqueia antes de entrar no corpo.

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding(text, text, text, text, text, text, text, text, text) TO authenticated;
