-- Tabela de seções do planejamento de tratamento por paciente
CREATE TABLE IF NOT EXISTS planejamento_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  conteudo text,
  imagem_ids jsonb NOT NULL DEFAULT '[]',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE planejamento_secoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY planejamento_secoes_policy ON planejamento_secoes
  FOR ALL TO authenticated
  USING (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()))
  WITH CHECK (clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid()));
