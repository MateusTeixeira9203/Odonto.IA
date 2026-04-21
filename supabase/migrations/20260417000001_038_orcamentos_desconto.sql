-- Adiciona campo de desconto na tabela de orçamentos.
-- O desconto é subtraído do total dos itens para compor o valor final.

ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orcamentos.desconto IS 'Valor de desconto aplicado ao total dos itens (R$)';
