-- =====================================================================
-- 108 — odontograma_eventos: FK de ficha_id vira CASCADE (bug real, 23/07)
--
-- A FK nascia (migration 101) com ON DELETE SET NULL: apagar uma ficha não
-- apagava os eventos do odontograma que ela criou — eles viravam ÓRFÃOS
-- (ficha_id = NULL), soltos do prontuário, e continuavam pintando o dente
-- pra sempre. Achado ao vivo em 23/07: editar uma ficha e o registro antigo
-- persistir no odontograma, verde, sem explicação — era um órfão.
--
-- Confirmado em produção antes desta migration: 9 de 25 eventos órfãos
-- (36%), um deles com `detalhe` de endo. A RPC de salvar (migration 107)
-- só apaga `WHERE ficha_id = p_ficha_id` — um órfão (ficha_id NULL) nunca
-- é alcançado por nenhum save futuro. Uma vez órfão, permanente.
--
-- Contrato correto: ficha é a unidade de salvamento (R-01) — apagar a
-- ficha desfaz TUDO que ela registrou, inclusive o que marcou no dente.
-- CASCADE, não SET NULL.
-- =====================================================================

begin;

alter table public.odontograma_eventos
  drop constraint odontograma_eventos_ficha_id_fkey;

alter table public.odontograma_eventos
  add constraint odontograma_eventos_ficha_id_fkey
  foreign key (ficha_id) references public.fichas(id) on delete cascade;

commit;
