begin;

create table public.apresentacao_modelos (
  id          uuid primary key default gen_random_uuid(),
  clinica_id  uuid not null references public.clinicas(id) on delete cascade,
  dentista_id uuid not null references public.dentistas(id) on delete cascade,
  tipo        text not null default 'texto' check (tipo in ('texto', 'imagem', 'odontograma')),
  titulo      text not null default '',
  conteudo    text,
  ordem       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.apresentacao_modelos is
  'Molde da sequência de blocos do Apresentar, por dentista — nunca dado de
   paciente (sem imagem_ids, sem paciente_id). Sobrescrito inteiro a cada save
   (DELETE+INSERT), nunca acumula versão. Ver R-98b, spec §4.2.';

create index idx_apresentacao_modelos_dentista on public.apresentacao_modelos (dentista_id, clinica_id);

alter table public.apresentacao_modelos enable row level security;

create policy apresentacao_modelos_select on public.apresentacao_modelos
  for select
  using (belongs_to_active_clinic(clinica_id) and is_clinic_staff());

create policy apresentacao_modelos_write_own on public.apresentacao_modelos
  for all
  using      (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

commit;
