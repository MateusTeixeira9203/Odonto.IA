-- Migration: 016_paciente_documentos.sql
-- Cria tabela de documentos e fotos vinculados a um paciente

CREATE TABLE IF NOT EXISTS paciente_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  url text NOT NULL,
  thumbnail text,
  categoria text NOT NULL DEFAULT 'Documentos',
  origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paciente_documentos_paciente ON paciente_documentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_paciente_documentos_clinica ON paciente_documentos(clinica_id);

ALTER TABLE paciente_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY paciente_documentos_policy ON paciente_documentos
  FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS paciente_documentos_updated_at ON paciente_documentos;
CREATE TRIGGER paciente_documentos_updated_at
  BEFORE UPDATE ON paciente_documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
