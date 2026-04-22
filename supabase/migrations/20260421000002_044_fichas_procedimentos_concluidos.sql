ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS procedimentos_concluidos jsonb NOT NULL DEFAULT '[]';
