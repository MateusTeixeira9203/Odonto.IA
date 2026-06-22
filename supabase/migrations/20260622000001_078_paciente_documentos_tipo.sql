-- Migration: 078_paciente_documentos_tipo.sql
-- Distingue documentos emitidos pelo sistema (receita/atestado/pedido) de uploads comuns.

ALTER TABLE paciente_documentos
  ADD COLUMN IF NOT EXISTS tipo_documento text;

COMMENT ON COLUMN paciente_documentos.tipo_documento IS
  'Tipo do documento emitido: receita | atestado | pedido_exame. NULL = upload comum.';
