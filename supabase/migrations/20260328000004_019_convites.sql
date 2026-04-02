-- Migration: 019_convites.sql
-- Sistema de convite para dentistas e secretárias.
-- O admin envia um email com link tokenizado; o usuário convidado
-- se cadastra e é adicionado à clínica com o papel especificado.

-- ============================================================
-- 1. Limite de dentistas por clínica (padrão MVP: 5)
-- ============================================================
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS limite_dentistas INT NOT NULL DEFAULT 5;

-- ============================================================
-- 2. Tabela de convites
-- ============================================================
CREATE TABLE IF NOT EXISTS convites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  UUID        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('dentista', 'secretaria')),
  token       TEXT        UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_convites_clinica_id ON convites(clinica_id);
CREATE INDEX IF NOT EXISTS idx_convites_token     ON convites(token);
CREATE INDEX IF NOT EXISTS idx_convites_email     ON convites(email);

ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- Admin/dentista da clínica pode gerenciar convites
CREATE POLICY convites_admin_policy ON convites
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  );

-- ============================================================
-- 3. Função auxiliar: valida e retorna dados do convite
-- Chamada durante o cadastro sem exigir autenticação.
-- SECURITY DEFINER para contornar RLS na busca por token.
-- ============================================================
CREATE OR REPLACE FUNCTION get_convite_by_token(p_token TEXT)
RETURNS TABLE (
  id         UUID,
  clinica_id UUID,
  email      TEXT,
  role       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, clinica_id, email, role
  FROM convites
  WHERE token = p_token
    AND expires_at > NOW()
  LIMIT 1;
$$;
