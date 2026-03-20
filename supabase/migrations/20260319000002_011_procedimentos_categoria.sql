-- Migration: 011_procedimentos_categoria.sql
-- Adiciona coluna categoria à tabela procedimentos (por clínica)
-- para espelhar o campo equivalente de procedimentos_padrao

ALTER TABLE procedimentos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Geral';
