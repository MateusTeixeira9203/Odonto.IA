-- Migration 053: status de ciclo de vida para clínicas
--
-- Status válidos:
--   ativa     — operando normalmente
--   cancelada — encerrada (soft delete)
--   suspensa  — acesso bloqueado temporariamente
--
-- Quando uma clínica é cancelada ou suspensa, os usuários
-- com active_clinica_id apontando para ela são limpos automaticamente.

-- =============================================================================
-- 1. Coluna status em clinicas
-- =============================================================================
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa'
  CHECK (status IN ('ativa', 'cancelada', 'suspensa'));

-- =============================================================================
-- 2. Trigger: limpar active_clinica_id quando clínica é desativada
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_clinica_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Clínica saiu de 'ativa' → limpar contexto dos usuários vinculados
  IF OLD.status = 'ativa' AND NEW.status IN ('cancelada', 'suspensa') THEN
    UPDATE public.users
    SET active_clinica_id = NULL
    WHERE active_clinica_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_clinica_status_change ON clinicas;
CREATE TRIGGER on_clinica_status_change
  AFTER UPDATE OF status ON clinicas
  FOR EACH ROW EXECUTE FUNCTION handle_clinica_status_change();
