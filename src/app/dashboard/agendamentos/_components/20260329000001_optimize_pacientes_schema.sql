-- 1. Copiar dados de whatsapp para telefone caso telefone esteja vazio
UPDATE pacientes 
SET telefone = whatsapp 
WHERE telefone IS NULL AND whatsapp IS NOT NULL;

-- 2. Remover a coluna antiga e adicionar a do avatar
ALTER TABLE pacientes 
DROP COLUMN whatsapp,
ADD COLUMN avatar_url TEXT;