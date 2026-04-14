-- Migration 031: Campos de mensagens personalizáveis no bot_config
-- Permite que o dono da clínica customize as saudações enviadas pelo bot.

ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS msg_novo_paciente     TEXT NOT NULL DEFAULT 'Sou a assistente virtual da clínica. Como posso te ajudar?',
  ADD COLUMN IF NOT EXISTS msg_paciente_antigo   TEXT NOT NULL DEFAULT 'Que bom te ver de volta, {{nome}}! Como posso te ajudar hoje?',
  ADD COLUMN IF NOT EXISTS titulo_menu_principal TEXT NOT NULL DEFAULT 'Agendar Consulta';

-- Permite INSERT sem whatsapp_number quando criado apenas pela tela de mensagens
ALTER TABLE bot_config ALTER COLUMN whatsapp_number SET DEFAULT '';
