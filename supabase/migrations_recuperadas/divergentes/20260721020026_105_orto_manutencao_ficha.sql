-- 105 · Persistência da manutenção ortodôntica na ficha (Roadmap A — Fatia A0).
-- orto_manutencao é dado POR-FICHA (não evento de odontograma). Herda RLS e assinatura
-- de `fichas`. Aditiva e reversível: coluna nullable, zero backfill.

alter table public.fichas
  add column if not exists orto_manutencao jsonb;

comment on column public.fichas.orto_manutencao is
  'Manutenção ortodôntica da consulta (arco/ativação/elástico corrente/intermaxilar — OrtoManutencaoInfo/OrtoManutencaoDetalhe). Registro clínico por-ficha: herda a RLS e a assinatura de fichas. null quando a consulta não foi de manutenção de orto. Roadmap A / A0.';