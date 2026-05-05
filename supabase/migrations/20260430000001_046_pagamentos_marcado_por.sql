-- Conciliação básica: rastreia quem marcou o pagamento como pago
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS marcado_por_id uuid REFERENCES dentistas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pagamentos_marcado_por ON pagamentos(marcado_por_id);
