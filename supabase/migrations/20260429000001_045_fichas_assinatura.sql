-- Adiciona suporte a assinatura digital do paciente na ficha clínica
ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT,
  ADD COLUMN IF NOT EXISTS assinado_em TIMESTAMPTZ;
