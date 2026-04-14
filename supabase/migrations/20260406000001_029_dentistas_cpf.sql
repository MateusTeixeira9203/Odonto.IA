-- Migration: 029_dentistas_cpf.sql
-- Adiciona coluna cpf ao perfil do dentista (preenchida em /completar-perfil-dentista)

ALTER TABLE dentistas ADD COLUMN IF NOT EXISTS cpf TEXT;
