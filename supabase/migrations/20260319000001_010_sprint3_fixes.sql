-- Migration: 010_sprint3_fixes.sql
-- Sprint 3: colunas faltantes em fichas, procedimento_id em planejamento_etapas

-- 1. Adicionar colunas faltantes na tabela fichas
ALTER TABLE fichas
  ADD COLUMN IF NOT EXISTS queixa_principal text,
  ADD COLUMN IF NOT EXISTS anamnese text,
  ADD COLUMN IF NOT EXISTS pressao_arterial text,
  ADD COLUMN IF NOT EXISTS diabetes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergias text;

-- 2. Adicionar coluna procedimento_id em planejamento_etapas
ALTER TABLE planejamento_etapas
  ADD COLUMN IF NOT EXISTS procedimento_id uuid REFERENCES procedimentos(id) ON DELETE SET NULL;

-- 3. Adicionar índice para busca por procedimento
CREATE INDEX IF NOT EXISTS idx_planejamento_etapas_procedimento_id
  ON planejamento_etapas(procedimento_id);
