-- Migration 034: ical_uid para deduplicação na importação do Google Calendar
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS ical_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_ical_uid
  ON agendamentos(clinica_id, ical_uid) WHERE ical_uid IS NOT NULL;