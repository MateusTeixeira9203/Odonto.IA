-- Migration 030: Índice para lookup de pacientes por WhatsApp (bot list flow)
-- A coluna pacientes.whatsapp já existe desde migration 001.
-- Este índice acelera o lookup feito pelo webhook a cada mensagem recebida.

CREATE INDEX IF NOT EXISTS idx_pacientes_whatsapp
  ON pacientes(clinica_id, whatsapp)
  WHERE whatsapp IS NOT NULL;
