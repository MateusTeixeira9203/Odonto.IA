-- 048: tabela de procedimentos do planejamento (sincronizados das fichas)
create table if not exists planejamento_procedimentos (
  id           uuid        primary key default gen_random_uuid(),
  clinica_id   uuid        not null references clinicas(id)  on delete cascade,
  paciente_id  uuid        not null references pacientes(id) on delete cascade,
  descricao    text        not null,
  dente        integer,
  status       text        not null default 'pendente'
                           check (status in ('pendente', 'agendado', 'concluido')),
  ficha_ref    text,       -- formato fichaId::dente, apenas referência, sem FK
  ordem        integer     not null default 0,
  created_at   timestamptz not null default now()
);

alter table planejamento_procedimentos enable row level security;

create policy "clinica_isolamento_pp" on planejamento_procedimentos
  for all using (
    clinica_id = (select clinica_id from dentistas where id = auth.uid())
  );

create index idx_pp_paciente on planejamento_procedimentos(paciente_id);
create index idx_pp_clinica  on planejamento_procedimentos(clinica_id);
