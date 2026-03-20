-- Migration: 012_clinicas_contato.sql
-- Adiciona campos de contato/localização à tabela clinicas
-- Os dados são coletados no onboarding mas não eram persistidos

ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text;
