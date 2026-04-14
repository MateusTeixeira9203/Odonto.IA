-- Migration 032: Tabela de despesas da clínica
-- Permite controle financeiro: receitas (pagamentos) - despesas = lucro líquido.

CREATE TABLE IF NOT EXISTS despesas (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id  uuid         NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  valor       numeric(10,2) NOT NULL CHECK (valor > 0),
  categoria   text         NOT NULL DEFAULT 'outro',
  tipo        text         NOT NULL DEFAULT 'variavel' CHECK (tipo IN ('fixo', 'variavel')),
  data        date         NOT NULL DEFAULT CURRENT_DATE,
  descricao   text,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_despesas_clinica_id ON despesas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_despesas_clinica_data ON despesas(clinica_id, data);

ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS despesas_all_policy ON despesas;
CREATE POLICY despesas_all_policy ON despesas
  FOR ALL TO authenticated
  USING  (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS despesas_updated_at ON despesas;
CREATE TRIGGER despesas_updated_at
  BEFORE UPDATE ON despesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
