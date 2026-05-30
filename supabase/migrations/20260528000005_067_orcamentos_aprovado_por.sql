-- Rastreabilidade de aprovação de orçamentos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS aprovado_por_id uuid REFERENCES dentistas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em      timestamptz;

CREATE INDEX IF NOT EXISTS idx_orcamentos_aprovado_por
  ON orcamentos (aprovado_por_id)
  WHERE aprovado_por_id IS NOT NULL;
