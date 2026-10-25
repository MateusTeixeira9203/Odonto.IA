
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS responsavel_nome       TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_telefone   TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_parentesco TEXT;

COMMENT ON COLUMN pacientes.responsavel_nome       IS 'Nome do responsável legal (obrigatório para menores de 18 anos)';
COMMENT ON COLUMN pacientes.responsavel_telefone   IS 'Telefone/WhatsApp do responsável';
COMMENT ON COLUMN pacientes.responsavel_parentesco IS 'Parentesco: mae, pai, avo, tutor, outro';
