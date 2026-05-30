-- Migration 055: secretarias — perfil de domínio operacional
--
-- Separação de responsabilidades:
--   * dentistas  → dados clínicos (CRO, especialidade, agenda)
--   * secretarias → dados operacionais (nome, telefone, must_change_password)
--   * clinica_usuarios → membership e role (fonte da verdade)
--
-- Fluxo de criação de secretária (futuro):
--   1. Admin cria secretaria + usuário com senha temporária
--   2. must_change_password = true → primeiro login exige troca
--   3. Após troca: must_change_password = false

-- =============================================================================
-- TABELA: secretarias
-- =============================================================================
CREATE TABLE IF NOT EXISTS secretarias (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  clinica_id           uuid        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  nome                 text        NOT NULL,
  telefone             text,
  must_change_password boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Uma secretária tem no máximo um perfil por clínica
CREATE UNIQUE INDEX IF NOT EXISTS uq_secretarias_usuario_clinica
  ON secretarias(usuario_id, clinica_id);

CREATE INDEX IF NOT EXISTS idx_secretarias_clinica_id ON secretarias(clinica_id);
CREATE INDEX IF NOT EXISTS idx_secretarias_usuario_id ON secretarias(usuario_id);

ALTER TABLE secretarias ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS secretarias_updated_at ON secretarias;
CREATE TRIGGER secretarias_updated_at
  BEFORE UPDATE ON secretarias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- BACKFILL: sincronizar secretárias existentes a partir de dentistas
-- must_change_password = false para usuárias já ativas no sistema.
-- =============================================================================
INSERT INTO secretarias (
  usuario_id, clinica_id, nome, must_change_password, created_at, updated_at
)
SELECT
  d.user_id,
  d.clinica_id,
  d.nome,
  false,   -- já estão usando o sistema, não precisam trocar senha
  d.created_at,
  d.updated_at
FROM dentistas d
INNER JOIN public.users u ON u.id = d.user_id
WHERE d.role = 'secretaria'
ON CONFLICT DO NOTHING;
