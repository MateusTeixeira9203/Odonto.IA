-- Migration 034: Trial expiry tracking
-- Adds trial_ends_at to clinicas for 7-day trial enforcement.

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Índice para queries de expiração (cron/middleware checks)
CREATE INDEX IF NOT EXISTS idx_clinicas_trial_ends_at
  ON clinicas(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
