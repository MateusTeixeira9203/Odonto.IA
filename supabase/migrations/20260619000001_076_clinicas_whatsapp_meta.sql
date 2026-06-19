-- 076 — Suporte multi-tenant à Meta WhatsApp Cloud API
--
-- Adiciona o phone_number_id da Meta na tabela clinicas para
-- roteamento de webhook por clínica sem depender de variáveis de ambiente.

alter table clinicas
  add column if not exists whatsapp_phone_number_id text;

-- Índice único: cada number_id pertence a uma única clínica
create unique index if not exists clinicas_whatsapp_phone_number_id_unique
  on clinicas (whatsapp_phone_number_id)
  where whatsapp_phone_number_id is not null;

comment on column clinicas.whatsapp_phone_number_id is
  'Meta WhatsApp Business "Phone Number ID" — usado para rotear webhooks por clínica.';
