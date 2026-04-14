-- 1. Adicionar a coluna de relacionamento na tabela pacientes
ALTER TABLE pacientes 
ADD COLUMN dentista_id UUID REFERENCES dentistas(id) ON DELETE SET NULL;

-- 2. Atualizar as políticas (RLS) da tabela pacientes
-- Remove a política antiga genérica
DROP POLICY IF EXISTS "pacientes_all_policy" ON pacientes;

-- Cria a nova política rigorosa com isolamento
CREATE POLICY "pacientes_strict_policy" ON pacientes
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id() AND
    (
      get_my_role() IN ('admin', 'secretaria') OR 
      (get_my_role() = 'dentista' AND dentista_id = (SELECT id FROM dentistas WHERE user_id = auth.uid() LIMIT 1))
    )
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id() AND
    (
      get_my_role() IN ('admin', 'secretaria') OR 
      (get_my_role() = 'dentista' AND dentista_id = (SELECT id FROM dentistas WHERE user_id = auth.uid() LIMIT 1))
    )
  );