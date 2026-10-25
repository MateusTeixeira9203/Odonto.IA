
-- Função: verifica se um paciente pertence ao dentista logado (qualquer clínica)
CREATE OR REPLACE FUNCTION public.is_my_patient(patient_dentista_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dentistas d
    WHERE d.user_id = auth.uid()
      AND d.id = patient_dentista_id
  );
$$;

-- Atualiza RLS de pacientes: dentista vê seus pacientes em QUALQUER clínica
DROP POLICY IF EXISTS "pacientes_all_clinic_members" ON public.pacientes;

CREATE POLICY "pacientes_access" ON public.pacientes
  FOR ALL
  USING (
    public.belongs_to_active_clinic(clinica_id)
    OR public.is_my_patient(dentista_id)
  )
  WITH CHECK (
    public.belongs_to_active_clinic(clinica_id)
    OR public.is_my_patient(dentista_id)
  );
