-- 085 — Multi-especialidade: dentistas.especialidade vira array (text[]).
-- Dados existentes: string única migra pra array de 1 elemento; null/vazio vira array vazio.

alter table dentistas add column especialidade_v2 text[] not null default '{}';

update dentistas
set especialidade_v2 = case
  when especialidade is null or trim(especialidade) = '' then '{}'::text[]
  else array[especialidade]
end;

alter table dentistas drop column especialidade;
alter table dentistas rename column especialidade_v2 to especialidade;

comment on column dentistas.especialidade is
  'Lista de especialidades do dentista (multi-select). Array vazio = nenhuma definida ainda.';
