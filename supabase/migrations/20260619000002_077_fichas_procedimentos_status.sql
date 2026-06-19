-- 077 — Status de procedimentos por ficha (3 estados: planejado, agendado, concluido)
--
-- Substitui o modelo binário anterior (procedimentos_concluidos text[])
-- por um mapa JSONB que suporta aguardando → agendado → concluído por procedimento.

alter table fichas
  add column if not exists procedimentos_status jsonb not null default '{}'::jsonb;

comment on column fichas.procedimentos_status is
  'Mapa { "${tooth}_${idx}": "planejado" | "agendado" | "concluido" } para cada procedimento da ficha.';
