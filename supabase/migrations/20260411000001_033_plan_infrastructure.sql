-- Migration 033: Plan infrastructure
-- Adds plano + status_assinatura to clinicas, dentista_id to despesas.

-- ── clinicas: plan columns ────────────────────────────────────────────────────

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'CLINICA'
    CHECK (plano IN ('SOLO', 'BASICO', 'CLINICA')),
  ADD COLUMN IF NOT EXISTS status_assinatura text NOT NULL DEFAULT 'trial'
    CHECK (status_assinatura IN ('trial', 'ativo', 'inativo'));

-- Align limite_dentistas defaults with plan rules (for rows already in DB)
-- SOLO → 1, BASICO → 2, CLINICA → keep current
UPDATE clinicas SET limite_dentistas = 1 WHERE plano = 'SOLO' AND limite_dentistas > 1;
UPDATE clinicas SET limite_dentistas = 2 WHERE plano = 'BASICO' AND limite_dentistas > 2;

-- ── despesas: dentista_id for financial privacy silos ─────────────────────────

ALTER TABLE despesas
  ADD COLUMN IF NOT EXISTS dentista_id uuid
    REFERENCES dentistas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_dentista_id ON despesas(dentista_id);
