
ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS procedimentos   text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conduta         text,
  ADD COLUMN IF NOT EXISTS retorno_sugerido text,
  ADD COLUMN IF NOT EXISTS alerta_novo     text;
