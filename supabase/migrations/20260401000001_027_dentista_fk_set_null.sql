-- Migration 027: Alterar FKs de dentista_id para ON DELETE SET NULL
-- nas tabelas de dados clínicos/financeiros, para que a exclusão de um
-- dentista não apague fichas, orçamentos, agendamentos e pagamentos.
-- horarios_disponiveis e google_tokens mantêm CASCADE (são dados do próprio dentista).

-- ============================================================
-- fichas
-- ============================================================
ALTER TABLE fichas
  DROP CONSTRAINT IF EXISTS fichas_dentista_id_fkey;

ALTER TABLE fichas
  ALTER COLUMN dentista_id DROP NOT NULL;

ALTER TABLE fichas
  ADD CONSTRAINT fichas_dentista_id_fkey
  FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL;

-- ============================================================
-- orcamentos
-- ============================================================
ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_dentista_id_fkey;

ALTER TABLE orcamentos
  ALTER COLUMN dentista_id DROP NOT NULL;

ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_dentista_id_fkey
  FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL;

-- ============================================================
-- agendamentos
-- ============================================================
ALTER TABLE agendamentos
  DROP CONSTRAINT IF EXISTS agendamentos_dentista_id_fkey;

ALTER TABLE agendamentos
  ALTER COLUMN dentista_id DROP NOT NULL;

ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_dentista_id_fkey
  FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL;

-- ============================================================
-- pagamentos
-- ============================================================
ALTER TABLE pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_dentista_id_fkey;

ALTER TABLE pagamentos
  ALTER COLUMN dentista_id DROP NOT NULL;

ALTER TABLE pagamentos
  ADD CONSTRAINT pagamentos_dentista_id_fkey
  FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL;
