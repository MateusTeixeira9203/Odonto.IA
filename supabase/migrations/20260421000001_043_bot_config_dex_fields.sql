-- Adiciona campos de personalização do DEX na tabela bot_config
ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS nome_assistente  text DEFAULT 'DEX',
  ADD COLUMN IF NOT EXISTS msg_confirmacao  text,
  ADD COLUMN IF NOT EXISTS msg_sem_horario  text;
