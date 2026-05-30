ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS followup_snooze_ate timestamptz;
