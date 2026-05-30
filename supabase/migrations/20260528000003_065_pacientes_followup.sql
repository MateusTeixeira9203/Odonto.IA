-- Follow-up operacional por paciente
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS followup_pendente boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS followup_nota     text,
  ADD COLUMN IF NOT EXISTS followup_em       timestamptz;

CREATE INDEX IF NOT EXISTS idx_pacientes_followup_clinica
  ON pacientes (clinica_id, followup_pendente)
  WHERE followup_pendente = true;
