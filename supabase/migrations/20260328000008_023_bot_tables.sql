-- ─────────────────────────────────────────────────────────────────────────────
-- 023 — Bot WhatsApp: bot_config, conversas_bot, mensagens_bot
-- ─────────────────────────────────────────────────────────────────────────────

-- Configurações por clínica
CREATE TABLE IF NOT EXISTS bot_config (
  clinica_id              UUID PRIMARY KEY REFERENCES clinicas(id) ON DELETE CASCADE,
  whatsapp_number         TEXT NOT NULL,
  welcome_message         TEXT DEFAULT 'Olá! Sou a assistente virtual da clínica. Como posso ajudar?',
  working_hours_start     TIME DEFAULT '08:00',
  working_hours_end       TIME DEFAULT '18:00',
  transfer_to_human_enabled BOOLEAN DEFAULT true,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_config_manage" ON bot_config
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM dentistas
      WHERE clinica_id = bot_config.clinica_id
        AND role IN ('admin', 'secretaria')
    )
  );

-- Conversas ativas com pacientes via WhatsApp
CREATE TABLE IF NOT EXISTS conversas_bot (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id                UUID NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  numero_whatsapp           TEXT NOT NULL,
  estado                    TEXT DEFAULT 'inicio',
  contexto                  JSONB DEFAULT '{}',
  paciente_id               UUID REFERENCES pacientes(id) ON DELETE SET NULL,
  transferido_para_humano   BOOLEAN DEFAULT false,
  ultima_interacao          TIMESTAMPTZ DEFAULT NOW(),
  criado_em                 TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversas_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_select" ON conversas_bot
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM dentistas WHERE clinica_id = conversas_bot.clinica_id
    )
  );

-- INSERT sem check de auth — webhook da Evolution API não tem JWT
CREATE POLICY "conversas_insert" ON conversas_bot
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "conversas_update" ON conversas_bot
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM dentistas WHERE clinica_id = conversas_bot.clinica_id
    )
  );

-- Histórico de mensagens
CREATE TABLE IF NOT EXISTS mensagens_bot (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id  UUID NOT NULL REFERENCES conversas_bot(id) ON DELETE CASCADE,
  origem       TEXT NOT NULL CHECK (origem IN ('bot', 'paciente')),
  texto        TEXT NOT NULL,
  tipo         TEXT DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'documento')),
  arquivo_url  TEXT,
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mensagens_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_select" ON mensagens_bot
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM dentistas
      WHERE clinica_id = (
        SELECT clinica_id FROM conversas_bot WHERE id = mensagens_bot.conversa_id
      )
    )
  );

-- INSERT sem check de auth — webhook da Evolution API não tem JWT
CREATE POLICY "mensagens_insert" ON mensagens_bot
  FOR INSERT
  WITH CHECK (true);

-- Campo opcional para vincular WhatsApp ao paciente
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS numero_whatsapp TEXT;
