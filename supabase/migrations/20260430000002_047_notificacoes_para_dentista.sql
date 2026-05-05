-- Permite direcionar notificações para um dentista específico (além de para_role)
ALTER TABLE notificacoes
  ADD COLUMN IF NOT EXISTS para_dentista_id uuid REFERENCES dentistas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notificacoes_para_dentista ON notificacoes(para_dentista_id);
