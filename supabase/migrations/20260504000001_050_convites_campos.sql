-- Migration: 050_convites_campos.sql
-- Adiciona rastreabilidade e histórico de status na tabela convites.

ALTER TABLE convites
  ADD COLUMN IF NOT EXISTS convidado_por uuid REFERENCES dentistas(id) ON DELETE SET NULL;

ALTER TABLE convites
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceito', 'expirado'));

CREATE INDEX IF NOT EXISTS idx_convites_status ON convites(status);
