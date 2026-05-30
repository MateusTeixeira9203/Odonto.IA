-- Migration 052: public.users — identidade global por usuário auth
--
-- Responsabilidade:
--   * auth / identidade única
--   * active_clinica_id = contexto de tenant atual
--
-- Não substitui dentistas nem clinica_usuarios.
-- Dentistas continuam sendo a fonte de membership enquanto clinica_usuarios
-- não é adotado pelo código da aplicação (migração futura).

-- =============================================================================
-- TABELA: users
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text        UNIQUE NOT NULL,
  active_clinica_id uuid        REFERENCES clinicas(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_active_clinica_id ON users(active_clinica_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- TRIGGER: auto-criar registro em public.users ao inserir em auth.users
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Usuários sem e-mail (phone-only) são ignorados
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- =============================================================================
-- BACKFILL: sincronizar usuários auth já existentes
-- =============================================================================
INSERT INTO public.users (id, email)
SELECT id, email
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Definir active_clinica_id para usuários com dentista ativo,
-- priorizando o registro mais recente quando houver múltiplas clínicas.
UPDATE public.users u
SET active_clinica_id = subq.clinica_id
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    clinica_id
  FROM dentistas
  WHERE ativo = true
  ORDER BY user_id, created_at DESC
) subq
WHERE u.id = subq.user_id
  AND u.active_clinica_id IS NULL;
