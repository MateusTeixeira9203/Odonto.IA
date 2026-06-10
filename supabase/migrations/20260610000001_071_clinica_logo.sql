-- Adiciona campo de logo à tabela de configurações da clínica
ALTER TABLE configuracoes_clinica ADD COLUMN IF NOT EXISTS logo_url text;
