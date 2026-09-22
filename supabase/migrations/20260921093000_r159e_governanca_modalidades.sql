-- R-159e: modalidades e vínculos de governança.
-- Camada aditiva: clínicas legadas sem governança permanecem colaborativas no código.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

alter table public.clinica_governanca
  add column if not exists modalidade text,
  add column if not exists vigencia_modalidade_em timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinica_governanca_modalidade_check'
      and conrelid = 'public.clinica_governanca'::regclass
  ) then
    alter table public.clinica_governanca
      add constraint clinica_governanca_modalidade_check
      check (modalidade is null or modalidade in ('colaborativa', 'gerida'));
  end if;
end;
$$;

create table if not exists public.clinica_vinculos_governanca (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  membro_id uuid not null,
  papel text not null check (papel in ('proprietario', 'gestor', 'responsavel_tecnico')),
  estado text not null default 'pendente_aceite'
    check (estado in ('pendente_aceite', 'ativo', 'encerrado')),
  criado_por_usuario_id uuid not null references public.users(id) on delete restrict,
  aceito_em timestamptz,
  iniciado_em timestamptz,
  encerrado_em timestamptz,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinica_vinculos_governanca_membro_clinica_fkey
    foreign key (clinica_id, membro_id)
    references public.clinica_usuarios (clinica_id, id) on delete restrict,
  constraint clinica_vinculos_governanca_datas_check
    check (
      (estado = 'pendente_aceite' and aceito_em is null and iniciado_em is null and encerrado_em is null)
      or (estado = 'ativo' and aceito_em is not null and iniciado_em is not null and encerrado_em is null)
      or (estado = 'encerrado' and encerrado_em is not null)
    )
);

create unique index if not exists clinica_vinculos_governanca_aberto_unico
  on public.clinica_vinculos_governanca (clinica_id, membro_id, papel)
  where estado in ('pendente_aceite', 'ativo');

create unique index if not exists clinica_vinculos_governanca_rt_ativo_unico
  on public.clinica_vinculos_governanca (clinica_id)
  where papel = 'responsavel_tecnico' and estado = 'ativo';

create index if not exists clinica_vinculos_governanca_clinica_estado_idx
  on public.clinica_vinculos_governanca (clinica_id, estado, papel);

drop trigger if exists clinica_vinculos_governanca_updated_at
  on public.clinica_vinculos_governanca;

create trigger clinica_vinculos_governanca_updated_at
before update on public.clinica_vinculos_governanca
for each row execute function public.update_updated_at();

create table if not exists public.clinica_governanca_auditoria (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  acao text not null check (acao in (
    'configurar_modalidade', 'nomear_proprietario', 'aceitar_propriedade',
    'nomear_gestor', 'encerrar_gestor', 'nomear_rt', 'aceitar_rt', 'encerrar_rt'
  )),
  antes jsonb not null default '{}'::jsonb check (jsonb_typeof(antes) = 'object'),
  depois jsonb not null default '{}'::jsonb check (jsonb_typeof(depois) = 'object'),
  motivo text check (motivo is null or char_length(motivo) between 1 and 500),
  chave_idempotencia uuid not null,
  created_at timestamptz not null default now(),
  unique (clinica_id, ator_usuario_id, chave_idempotencia)
);

create index if not exists clinica_governanca_auditoria_clinica_data_idx
  on public.clinica_governanca_auditoria (clinica_id, created_at desc);

create or replace function private.validar_vinculo_governanca_r159e()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.estado in ('pendente_aceite', 'ativo') and not exists (
    select 1 from public.clinica_usuarios cu
    where cu.id = new.membro_id and cu.clinica_id = new.clinica_id and cu.status = 'ativo'
  ) then
    raise exception 'vínculo de governança exige membro ativo da clínica';
  end if;

  if new.papel = 'responsavel_tecnico' and new.estado = 'ativo' and not exists (
    select 1
    from public.clinica_usuarios cu
    join public.dentistas d on d.user_id = cu.usuario_id and d.clinica_id = cu.clinica_id
    where cu.id = new.membro_id and cu.clinica_id = new.clinica_id and cu.status = 'ativo'
      and d.ativo and nullif(btrim(d.cro), '') is not null
  ) then
    raise exception 'responsável técnico exige dentista ativo com CRO cadastrado';
  end if;

  return new;
end;
$$;

drop trigger if exists clinica_vinculos_governanca_validar
  on public.clinica_vinculos_governanca;

create trigger clinica_vinculos_governanca_validar
before insert or update on public.clinica_vinculos_governanca
for each row execute function private.validar_vinculo_governanca_r159e();

create or replace function private.bloquear_ultimo_proprietario_r159e()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if old.papel = 'proprietario' and old.estado = 'ativo'
    and (tg_op = 'delete' or new.estado <> 'ativo')
    and not exists (
      select 1 from public.clinica_vinculos_governanca v
      where v.clinica_id = old.clinica_id and v.papel = 'proprietario'
        and v.estado = 'ativo' and v.id <> old.id
    ) then
    raise exception 'a clínica precisa manter ao menos um proprietário ativo';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists clinica_vinculos_governanca_ultimo_proprietario
  on public.clinica_vinculos_governanca;

create trigger clinica_vinculos_governanca_ultimo_proprietario
before update or delete on public.clinica_vinculos_governanca
for each row execute function private.bloquear_ultimo_proprietario_r159e();

alter table public.clinica_vinculos_governanca enable row level security;
alter table public.clinica_governanca_auditoria enable row level security;

revoke all on table public.clinica_vinculos_governanca from public, anon, authenticated;
revoke all on table public.clinica_governanca_auditoria from public, anon, authenticated;
revoke all on function private.validar_vinculo_governanca_r159e() from public, anon, authenticated;
revoke all on function private.bloquear_ultimo_proprietario_r159e() from public, anon, authenticated;

comment on table public.clinica_vinculos_governanca is
  'Papéis acumuláveis de propriedade, gestão e responsabilidade técnica por clínica.';
comment on column public.clinica_governanca.modalidade is
  'NULL é clínica legada; o código a interpreta como colaborativa sem converter fatos existentes.';
