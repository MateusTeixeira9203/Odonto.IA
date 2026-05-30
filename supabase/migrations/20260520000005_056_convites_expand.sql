-- Migration 056: convites — expansão para conformidade com spec multi-tenant
--
-- Mudanças:
--   1. Status 'cancelado' adicionado (além de pendente/aceito/expirado)
--   2. invited_by: nova coluna referenciando users(id) — substituição futura
--      de convidado_por (que referencia dentistas.id e fica preservado)
--   3. accepted_by: rastreia qual usuário aceitou o convite
--
-- Compatibilidade: convidado_por (FK dentistas) mantida intacta.
-- O código da aplicação ainda usa convidado_por; a migração para
-- invited_by ocorre em bloco futuro.

-- =============================================================================
-- 1. Expandir status para incluir 'cancelado'
-- =============================================================================
ALTER TABLE convites DROP CONSTRAINT IF EXISTS convites_status_check;

ALTER TABLE convites
  ADD CONSTRAINT convites_status_check
  CHECK (status IN ('pendente', 'aceito', 'expirado', 'cancelado'));

-- =============================================================================
-- 2. Novos campos de rastreabilidade referenciando users(id)
-- =============================================================================
ALTER TABLE convites
  ADD COLUMN IF NOT EXISTS invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_convites_invited_by  ON convites(invited_by);
CREATE INDEX IF NOT EXISTS idx_convites_accepted_by ON convites(accepted_by);

-- =============================================================================
-- 3. Backfill: popular invited_by a partir de convidado_por existente
-- Resolve via dentistas.user_id → users.id.
-- =============================================================================
UPDATE convites c
SET invited_by = u.id
FROM dentistas d
INNER JOIN public.users u ON u.id = d.user_id
WHERE d.id = c.convidado_por
  AND c.invited_by IS NULL;
