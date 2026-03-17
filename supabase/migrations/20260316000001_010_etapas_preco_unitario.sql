-- Adiciona preco_unitario às etapas do planejamento
-- para permitir cálculo automático no orçamento

ALTER TABLE planejamento_etapas
  ADD COLUMN IF NOT EXISTS preco_unitario numeric(10,2) DEFAULT NULL;
