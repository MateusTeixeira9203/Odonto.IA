-- 082 — Ficha unificada (#16 D3): renomeia os 3 estados de procedimentos_status
-- planejado → nao_iniciado, agendado → nao_iniciado, concluido mantém.
-- Coluna é jsonb sem constraint de enum (validação só em app) — migração de dados, não de schema.

update fichas
set procedimentos_status = (
  select coalesce(
    jsonb_object_agg(
      key,
      case value #>> '{}'
        when 'planejado' then to_jsonb('nao_iniciado'::text)
        when 'agendado'  then to_jsonb('nao_iniciado'::text)
        else value
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(procedimentos_status)
)
where procedimentos_status is not null and procedimentos_status != '{}'::jsonb;

comment on column fichas.procedimentos_status is
  'Mapa { "${tooth}_${idx}": "nao_iniciado" | "em_andamento" | "concluido" } para cada procedimento da ficha.';
