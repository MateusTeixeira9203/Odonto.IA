-- Tabela de auditoria de uso de IA
-- Escrita via service role (fire-and-forget), sem RLS necessário
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature     TEXT        NOT NULL,
  provider    TEXT        NOT NULL DEFAULT 'gemini',
  model       TEXT        NOT NULL,
  latency_ms  INTEGER     NOT NULL,
  success     BOOLEAN     NOT NULL DEFAULT true,
  dentista_id UUID        REFERENCES dentistas(id) ON DELETE SET NULL,
  clinica_id  UUID        REFERENCES clinicas(id)  ON DELETE SET NULL,
  paciente_id UUID        REFERENCES pacientes(id) ON DELETE SET NULL,
  error       TEXT
);

-- Índices para consultas de observability por clínica e por feature
CREATE INDEX IF NOT EXISTS ai_usage_logs_clinica_created
  ON ai_usage_logs(clinica_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_logs_feature_created
  ON ai_usage_logs(feature, created_at DESC);

-- Apenas service role pode ler/escrever
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON ai_usage_logs
  USING (false)
  WITH CHECK (false);
