-- Migration 041: Tabela de entradas manuais da clínica
-- Complementa pagamentos (vinculados a orçamentos) com lançamentos avulsos:
-- repasses de convênio, dinheiro físico, PIX direto, transferências.

CREATE TABLE IF NOT EXISTS receitas_manuais (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id   uuid          NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  dentista_id  uuid          REFERENCES dentistas(id) ON DELETE SET NULL,
  valor        numeric(10,2) NOT NULL CHECK (valor > 0),
  forma        text          NOT NULL DEFAULT 'pix'
                             CHECK (forma IN ('pix', 'dinheiro', 'transferencia', 'outro')),
  data         date          NOT NULL DEFAULT CURRENT_DATE,
  descricao    text,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receitas_manuais_clinica_id   ON receitas_manuais(clinica_id);
CREATE INDEX IF NOT EXISTS idx_receitas_manuais_clinica_data ON receitas_manuais(clinica_id, data);

ALTER TABLE receitas_manuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receitas_manuais_all_policy ON receitas_manuais;
CREATE POLICY receitas_manuais_all_policy ON receitas_manuais
  FOR ALL TO authenticated
  USING  (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS receitas_manuais_updated_at ON receitas_manuais;
CREATE TRIGGER receitas_manuais_updated_at
  BEFORE UPDATE ON receitas_manuais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
