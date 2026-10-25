
-- Permite que secretária também gerencie convites (ler e inserir)
DROP POLICY IF EXISTS convites_admin_policy ON convites;

CREATE POLICY convites_all_policy ON convites
  FOR ALL
  USING (
    clinica_id = get_my_clinica_id()
    AND get_my_role() = ANY (ARRAY['admin', 'dentista', 'secretaria'])
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
    AND get_my_role() = ANY (ARRAY['admin', 'dentista', 'secretaria'])
  );
