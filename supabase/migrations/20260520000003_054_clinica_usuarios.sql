-- Migration 054: clinica_usuarios — fonte da verdade de membership
--
-- Esta tabela substitui o uso de dentistas.role / dentistas.ativo
-- como controle de membership. A migração do código da aplicação
-- para usar esta tabela ocorre em bloco futuro.
--
-- Invariantes:
--   * Um usuário tem no máximo um membership ATIVO por clínica.
--   * Histórico de memberships removidos é preservado (soft delete).
--   * O último admin de uma clínica não pode ser removido ou despromovido.

-- =============================================================================
-- TABELA: clinica_usuarios
-- =============================================================================
CREATE TABLE IF NOT EXISTS clinica_usuarios (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  clinica_id  uuid        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('admin', 'dentista', 'secretaria')),
  status      text        NOT NULL DEFAULT 'ativo'
                          CHECK (status IN ('ativo', 'removido', 'pendente')),
  invited_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Garante um único membership ativo por usuário por clínica
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinica_usuarios_ativo
  ON clinica_usuarios(usuario_id, clinica_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_clinica_usuarios_clinica   ON clinica_usuarios(clinica_id);
CREATE INDEX IF NOT EXISTS idx_clinica_usuarios_usuario   ON clinica_usuarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clinica_usuarios_status    ON clinica_usuarios(clinica_id, status);

ALTER TABLE clinica_usuarios ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS clinica_usuarios_updated_at ON clinica_usuarios;
CREATE TRIGGER clinica_usuarios_updated_at
  BEFORE UPDATE ON clinica_usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- TRIGGER: proteção do último admin
-- Impede remover ou despromover o único admin ativo de uma clínica.
-- =============================================================================
CREATE OR REPLACE FUNCTION check_last_admin_clinica_usuarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_remaining_admins int;
BEGIN
  -- Disparar apenas quando o registro afetado é um admin ativo que
  -- está sendo despromovido ou removido.
  IF (TG_OP = 'UPDATE'
      AND OLD.role    = 'admin'
      AND OLD.status  = 'ativo'
      AND (NEW.role != 'admin' OR NEW.status = 'removido'))
  OR (TG_OP = 'DELETE'
      AND OLD.role   = 'admin'
      AND OLD.status = 'ativo')
  THEN
    SELECT COUNT(*) INTO v_remaining_admins
    FROM clinica_usuarios
    WHERE clinica_id = OLD.clinica_id
      AND role       = 'admin'
      AND status     = 'ativo'
      AND id        != OLD.id;   -- excluir o próprio registro sendo alterado

    IF v_remaining_admins = 0 THEN
      RAISE EXCEPTION
        'Operação bloqueada: não é possível remover o último administrador da clínica (id: %)',
        OLD.clinica_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_removal ON clinica_usuarios;
CREATE TRIGGER prevent_last_admin_removal
  BEFORE UPDATE OR DELETE ON clinica_usuarios
  FOR EACH ROW EXECUTE FUNCTION check_last_admin_clinica_usuarios();

-- =============================================================================
-- BACKFILL: sincronizar memberships existentes a partir de dentistas
-- Apenas para usuários que existem em public.users (migration 052 rodou antes).
-- =============================================================================
INSERT INTO clinica_usuarios (
  usuario_id, clinica_id, role, status,
  joined_at, created_at, updated_at
)
SELECT
  d.user_id,
  d.clinica_id,
  d.role,
  CASE WHEN d.ativo THEN 'ativo' ELSE 'removido' END,
  d.created_at,
  d.created_at,
  d.updated_at
FROM dentistas d
INNER JOIN public.users u ON u.id = d.user_id
ON CONFLICT DO NOTHING;
