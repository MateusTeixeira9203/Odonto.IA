-- Flag de pendência de configuração de procedimentos.
-- Setada como true quando o dentista escolhe "Configurar depois" no onboarding.
-- Mostra alerta âmbar pulsante na aba Procedimentos das Configurações até configurar.

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS procedimentos_pendente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clinicas.procedimentos_pendente IS
  'true quando o dentista escolheu "Configurar depois" no onboarding; mostra alerta âmbar nas configurações até configurar.';
