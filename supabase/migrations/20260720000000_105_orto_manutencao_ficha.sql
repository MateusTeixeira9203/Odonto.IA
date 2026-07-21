-- 105 · Persistência da manutenção ortodôntica na ficha (Roadmap A — Fatia A0).
-- Spec: plans/specs/spec-a0-fundacao-plugins-especialidade.md §2.5.
--
-- orto_manutencao é dado POR-FICHA (uma manutenção por consulta/arcada), não um
-- evento de odontograma (não pinta dente). Hoje o pass 1 (formatar-evolucao) já o
-- extrai e o consulta-client o mostra no draft — mas ele NÃO é persistido (nem coluna,
-- nem insert). Esta coluna fecha o furo. Herda RLS e assinatura de `fichas` de graça
-- (registro clínico do autor, lido pela clínica — coerente com o núcleo clínico 099).
--
-- Aditiva e reversível: coluna nullable, zero backfill, não toca dado existente.

alter table public.fichas
  add column if not exists orto_manutencao jsonb;

comment on column public.fichas.orto_manutencao is
  'Manutenção ortodôntica da consulta (arco/ativação/elástico corrente/intermaxilar — '
  'OrtoManutencaoInfo/OrtoManutencaoDetalhe). Registro clínico por-ficha: herda a RLS e a '
  'assinatura de fichas. null quando a consulta não foi de manutenção de orto. Roadmap A / A0.';
