-- Migration: 026_fix_planejamentos_dentista_fk.sql
-- Corrige FK planejamentos.dentista_id de NO ACTION para SET NULL.
-- Com NO ACTION, deletar um dentista bloqueava quando havia planejamentos
-- vinculados, causando erro 500 no auth.admin.deleteUser() e no cleanup.

ALTER TABLE planejamentos
  DROP CONSTRAINT IF EXISTS planejamentos_dentista_id_fkey;

ALTER TABLE planejamentos
  ADD CONSTRAINT planejamentos_dentista_id_fkey
  FOREIGN KEY (dentista_id) REFERENCES dentistas(id) ON DELETE SET NULL;
