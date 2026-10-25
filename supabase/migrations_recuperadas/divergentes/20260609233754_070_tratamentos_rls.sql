CREATE TABLE IF NOT EXISTS public.tratamentos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id   uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nome         text,
  status       text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tratamentos_clinica_paciente_idx
  ON public.tratamentos (clinica_id, paciente_id);

CREATE INDEX IF NOT EXISTS tratamentos_status_idx
  ON public.tratamentos (clinica_id, paciente_id, status);

ALTER TABLE public.fichas
  ADD COLUMN IF NOT EXISTS tratamento_id uuid REFERENCES public.tratamentos(id) ON DELETE SET NULL;

ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tratamentos_select_clinic_members"
ON public.tratamentos FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "tratamentos_insert_dentistas"
ON public.tratamentos FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

CREATE POLICY "tratamentos_update_dentistas"
ON public.tratamentos FOR UPDATE TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

CREATE POLICY "tratamentos_delete_dentistas"
ON public.tratamentos FOR DELETE TO authenticated
USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());