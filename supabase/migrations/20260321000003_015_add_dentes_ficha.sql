-- Migration: 015_add_dentes_ficha.sql
-- Adiciona colunas de dentes afetados e observações por dente na tabela fichas

ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS dentes_afetados jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dentes_observacoes jsonb NOT NULL DEFAULT '{}';

-- dentes_afetados: array de números ex: [16, 36, 48]
-- dentes_observacoes: objeto chave-valor ex: {"36": "Extração simples", "16": "Restauração"}
