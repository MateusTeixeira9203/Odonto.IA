-- Adiciona coluna origem para rastrear como a ficha foi criada
-- Usado para medir taxa de ativação do Modo Consulta (fichas_com_dex / total_consultas)

ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual'
  CHECK (origem IN ('modo_consulta', 'manual'));

COMMENT ON COLUMN fichas.origem IS 'Origem da ficha: modo_consulta (DEX) ou manual';
