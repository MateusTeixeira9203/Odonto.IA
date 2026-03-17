-- Adiciona coluna preco_unitario à tabela planejamento_etapas
-- para permitir cálculo automático do orçamento

ALTER TABLE planejamento_etapas
ADD COLUMN IF NOT EXISTS preco_unitario DECIMAL(10,2) DEFAULT NULL;
