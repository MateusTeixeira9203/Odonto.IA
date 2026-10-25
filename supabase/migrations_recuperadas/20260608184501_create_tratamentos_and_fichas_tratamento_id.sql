
-- 1. Tabela tratamentos
CREATE TABLE IF NOT EXISTS public.tratamentos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id   uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nome         text,
  status       text NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'concluido')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz
);

-- 2. RLS
ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinica_isolamento" ON public.tratamentos
  FOR ALL
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.dentistas WHERE id = auth.uid()
    )
  );

-- 3. FK em fichas
ALTER TABLE public.fichas
  ADD COLUMN IF NOT EXISTS tratamento_id uuid
  REFERENCES public.tratamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fichas_tratamento_id
  ON public.fichas(tratamento_id);
