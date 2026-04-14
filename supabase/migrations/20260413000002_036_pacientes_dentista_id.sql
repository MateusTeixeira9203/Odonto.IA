-- Vincula pacientes a dentistas: adiciona dentista_id + atualiza RLS

-- 1. Função helper para obter o ID do dentista atual (evita recursão em RLS)
CREATE OR REPLACE FUNCTION get_my_dentista_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM dentistas WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Coluna dentista_id (nullable) na tabela pacientes
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS dentista_id uuid REFERENCES dentistas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pacientes_dentista_id ON pacientes(dentista_id);

-- 3. Política atualizada:
--    - admin/secretaria → acessa todos os pacientes da clínica
--    - dentista         → acessa os seus + pacientes sem vínculo (dados legados)
DROP POLICY IF EXISTS pacientes_all_policy ON pacientes;

CREATE POLICY pacientes_all_policy ON pacientes
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND (
      get_my_role() IN ('admin', 'secretaria')
      OR dentista_id = get_my_dentista_id()
      OR dentista_id IS NULL
    )
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
  );
