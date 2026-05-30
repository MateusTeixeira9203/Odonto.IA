-- Central audit log table — append-only
CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  uuid        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES dentistas(id) ON DELETE SET NULL,
  actor_nome  text,
  paciente_id uuid        REFERENCES pacientes(id) ON DELETE SET NULL,
  entity_type text        NOT NULL,
  entity_id   text,
  action      text        NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_clinica_recent
  ON activity_logs (clinica_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs (entity_type, entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_paciente
  ON activity_logs (paciente_id, created_at DESC)
  WHERE paciente_id IS NOT NULL;

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select"
  ON activity_logs FOR SELECT
  USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT
  WITH CHECK (public.belongs_to_active_clinic(clinica_id));
