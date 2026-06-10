-- Migration 069: WhatsApp Business Cloud API (Meta Official)
-- Substitui integração via QR code / Evolution API

BEGIN;

-- conversas_bot: estado da máquina de estados + vínculos
ALTER TABLE public.conversas_bot
  ADD COLUMN IF NOT EXISTS estado        text DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS paciente_id   uuid REFERENCES public.pacientes(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dentista_id   uuid REFERENCES public.dentistas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dados_coleta  jsonb DEFAULT '{}';

COMMENT ON COLUMN public.conversas_bot.estado IS
  'Estado atual da FSM: inicio | cadastro | agendamento | orcamento | pagamento | humano | encerrado';

COMMENT ON COLUMN public.conversas_bot.dados_coleta IS
  'Dados coletados parcialmente durante fluxo de cadastro/agendamento';

-- mensagens_bot: suporte a mídia (comprovantes, PDFs)
ALTER TABLE public.mensagens_bot
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text;

COMMENT ON COLUMN public.mensagens_bot.media_type IS
  'Tipo de mídia recebida: image | document | audio';

-- pagamentos: rastreamento de comprovante e verificação automática
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS comprovante_url              text,
  ADD COLUMN IF NOT EXISTS verificado_automaticamente   boolean DEFAULT false;

-- bot_config: campos para WhatsApp Business Cloud API
-- (substitui waba_phone_number_id / qr_code fields anteriores)
ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS waba_id               text,
  ADD COLUMN IF NOT EXISTS phone_number_id        text,
  ADD COLUMN IF NOT EXISTS access_token           text,
  ADD COLUMN IF NOT EXISTS webhook_verify_token   text,
  ADD COLUMN IF NOT EXISTS dentistas_ativos_bot   uuid[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_orcamento     text,
  ADD COLUMN IF NOT EXISTS bot_ativo              boolean DEFAULT false;

COMMENT ON COLUMN public.bot_config.access_token IS
  'Meta App Token — armazenar criptografado na aplicação';

COMMENT ON COLUMN public.bot_config.dentistas_ativos_bot IS
  'IDs dos dentistas disponíveis para seleção pelo paciente no bot';

-- Índices de suporte
CREATE INDEX IF NOT EXISTS idx_conversas_bot_estado       ON public.conversas_bot(estado);
CREATE INDEX IF NOT EXISTS idx_conversas_bot_paciente_id  ON public.conversas_bot(paciente_id);

COMMIT;
