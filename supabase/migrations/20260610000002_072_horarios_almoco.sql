ALTER TABLE horarios_disponiveis
  ADD COLUMN IF NOT EXISTS almoco_inicio time NULL,
  ADD COLUMN IF NOT EXISTS almoco_fim    time NULL;
