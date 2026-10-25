-- Permite direcionar notificações para um dentista específico.
-- Quando preenchido, apenas aquele dentista vê a notificação (privacy total).
-- Quando NULL, a notificação é visível a todos do para_role na clínica.

ALTER TABLE notificacoes
  ADD COLUMN IF NOT EXISTS para_dentista_id UUID REFERENCES dentistas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notificacoes_para_dentista_idx
  ON notificacoes (para_dentista_id)
  WHERE para_dentista_id IS NOT NULL;