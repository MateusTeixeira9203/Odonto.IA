
-- 1. Remove constraint antiga
ALTER TABLE tratamentos DROP CONSTRAINT tratamentos_status_check;

-- 2. Migra 'ativo' → 'principal'
UPDATE tratamentos SET status = 'principal' WHERE status = 'ativo';

-- 3. Recria constraint aceitando os três valores
ALTER TABLE tratamentos ADD CONSTRAINT tratamentos_status_check
  CHECK (status IN ('principal', 'pendente', 'concluido'));
