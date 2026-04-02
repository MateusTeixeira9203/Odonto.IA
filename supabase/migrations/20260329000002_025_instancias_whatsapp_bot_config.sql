-- Migration 025: Cria tabela instancias_whatsapp e adiciona colunas de lembrete em bot_config

-- ─── instancias_whatsapp ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instancias_whatsapp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id      UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  instance_name   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'inactive',
  qrcode          TEXT,
  last_qrcode_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT instancias_whatsapp_clinica_id_key UNIQUE (clinica_id)
);

ALTER TABLE instancias_whatsapp ENABLE ROW LEVEL SECURITY;

-- Apenas admins da clínica podem ver/alterar instâncias (leitura via service role na prática)
CREATE POLICY "instancias_select" ON instancias_whatsapp
  FOR SELECT
  USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

CREATE POLICY "instancias_update" ON instancias_whatsapp
  FOR UPDATE
  USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_instancias_whatsapp_clinica ON instancias_whatsapp(clinica_id);

-- ─── bot_config: colunas de lembrete ─────────────────────────────────────────

ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS reminder_enabled  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_hours    INT     NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS reminder_message  TEXT    NOT NULL DEFAULT '🔔 Lembrete: Sua consulta está agendada para {data} às {hora}. Confirme sua presença respondendo CONFIRMO.';
