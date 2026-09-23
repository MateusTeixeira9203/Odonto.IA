-- R-170b: previsão comercial sem efeito operacional e convites pessoais de equipe.
-- Não altera contratos, limite_dentistas ou convites legados de clínicas existentes.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

alter table public.clinicas
  add column if not exists quantidade_dentistas_prevista integer;

alter table public.convites
  add column if not exists nome_convidado text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinicas_quantidade_dentistas_prevista_check'
      and conrelid = 'public.clinicas'::regclass
  ) then
    alter table public.clinicas add constraint clinicas_quantidade_dentistas_prevista_check
      check (quantidade_dentistas_prevista is null or quantidade_dentistas_prevista >= 0);
  end if;
end;
$$;

create table if not exists public.convites_governanca (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  email text not null check (email = lower(btrim(email))),
  papel text not null check (papel in ('gestor', 'responsavel_tecnico')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado', 'expirado')),
  expires_at timestamptz not null,
  convidado_por_usuario_id uuid not null references public.users(id) on delete restrict,
  accepted_by uuid references public.users(id) on delete set null,
  email_enviado_em timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint convites_governanca_aceite_check check (
    (status = 'aceito' and accepted_by is not null and accepted_at is not null)
    or (status <> 'aceito' and accepted_at is null)
  )
);

create unique index if not exists convites_governanca_pendente_unico
  on public.convites_governanca (clinica_id, email, papel)
  where status = 'pendente';
create index if not exists convites_governanca_clinica_status_idx
  on public.convites_governanca (clinica_id, status, expires_at);

alter table public.convites_governanca enable row level security;
revoke all on public.convites_governanca from public, anon, authenticated;

create or replace function public.criar_convite_equipe(
  p_clinica_id uuid,
  p_nome text,
  p_email text,
  p_tipo text,
  p_chave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_modalidade text;
  v_autorizado boolean := false;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_token uuid := gen_random_uuid();
  v_convite_id uuid;
  v_expira_em timestamptz := now() + interval '7 days';
begin
  if v_usuario_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0401';
  end if;
  if p_clinica_id is null or p_chave_idempotencia is null
    or p_tipo not in ('dentista', 'gestor', 'responsavel_tecnico')
    or char_length(v_nome) < 2 or char_length(v_nome) > 120
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_INPUT' using errcode = 'P0400';
  end if;

  select g.modalidade into v_modalidade
  from public.clinica_governanca g where g.clinica_id = p_clinica_id;

  if v_modalidade = 'gerida' then
    select exists (
      select 1
      from public.clinica_vinculos_governanca v
      join public.clinica_usuarios cu on cu.id = v.membro_id and cu.clinica_id = v.clinica_id
      where v.clinica_id = p_clinica_id and v.papel = 'proprietario' and v.estado = 'ativo'
        and cu.usuario_id = v_usuario_id and cu.status = 'ativo'
    ) into v_autorizado;
  else
    select exists (
      select 1 from public.clinica_usuarios cu
      where cu.clinica_id = p_clinica_id and cu.usuario_id = v_usuario_id
        and cu.status = 'ativo' and cu.role = 'admin'
    ) into v_autorizado;
  end if;
  if not v_autorizado then
    raise exception 'FORBIDDEN' using errcode = 'P0403';
  end if;

  if p_tipo = 'dentista' then
    if exists (
      select 1 from public.clinica_usuarios cu join public.users u on u.id = cu.usuario_id
      where cu.clinica_id = p_clinica_id and lower(u.email) = v_email and cu.status = 'ativo'
    ) then
      raise exception 'ALREADY_MEMBER' using errcode = 'P0409';
    end if;
    if exists (
      select 1 from public.convites c
      where c.clinica_id = p_clinica_id and lower(c.email) = v_email
        and c.role = 'dentista' and c.status = 'pendente' and c.expires_at > now()
    ) then
      raise exception 'PENDING_INVITE' using errcode = 'P0409';
    end if;
    insert into public.convites (clinica_id, email, role, token, expires_at, status, convidado_por, nome_convidado)
    values (p_clinica_id, v_email, 'dentista', v_token, v_expira_em, 'pendente', null, v_nome)
    returning id into v_convite_id;
  else
    if exists (
      select 1 from public.convites_governanca c
      where c.clinica_id = p_clinica_id and c.email = v_email and c.papel = p_tipo
        and c.status = 'pendente' and c.expires_at > now()
    ) then
      raise exception 'PENDING_INVITE' using errcode = 'P0409';
    end if;
    insert into public.convites_governanca (
      clinica_id, nome, email, papel, token, expires_at, convidado_por_usuario_id
    ) values (p_clinica_id, v_nome, v_email, p_tipo, v_token, v_expira_em, v_usuario_id)
    returning id into v_convite_id;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', v_convite_id::text, 'token', v_token::text, 'email', v_email,
    'tipo', p_tipo, 'expiresAt', v_expira_em
  ));
end;
$$;

create or replace function public.aceitar_convite_governanca(
  p_token uuid,
  p_cro text default null,
  p_especialidade text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_convite public.convites_governanca%rowtype;
  v_membro_id uuid;
  v_nome text;
  v_papel_membro text;
begin
  if v_usuario_id is null or p_token is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0401'; end if;
  select * into v_convite from public.convites_governanca
  where token = p_token and status = 'pendente' and expires_at > now() for update;
  if not found then raise exception 'INVALID_INVITE' using errcode = 'P0404'; end if;
  if v_convite.email <> v_email then raise exception 'EMAIL_MISMATCH' using errcode = 'P0403'; end if;
  if v_convite.papel = 'responsavel_tecnico' and (
    nullif(btrim(coalesce(p_cro, '')), '') is null or coalesce(array_length(p_especialidade, 1), 0) = 0
  ) then raise exception 'RT_PROFILE_REQUIRED' using errcode = 'P0400'; end if;

  v_nome := coalesce(nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'nome'), ''), v_convite.nome, v_convite.email);
  v_papel_membro := case when v_convite.papel = 'responsavel_tecnico' then 'dentista' else 'gestor' end;
  insert into public.users (id, email, active_clinica_id)
  values (v_usuario_id, v_email, v_convite.clinica_id)
  on conflict (id) do update set active_clinica_id = excluded.active_clinica_id;
  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status, joined_at)
  values (v_usuario_id, v_convite.clinica_id, v_papel_membro, 'ativo', now())
  on conflict (clinica_id, usuario_id) do update set role = excluded.role, status = 'ativo', joined_at = excluded.joined_at
  returning id into v_membro_id;

  if v_convite.papel = 'responsavel_tecnico' then
    insert into public.dentistas (clinica_id, user_id, nome, cro, especialidade, email, role, ativo)
    values (v_convite.clinica_id, v_usuario_id, v_nome, btrim(p_cro), p_especialidade, v_email, 'dentista', true)
    on conflict (clinica_id, user_id) do update set nome = excluded.nome, cro = excluded.cro,
      especialidade = excluded.especialidade, email = excluded.email, ativo = true;
  end if;

  insert into public.clinica_vinculos_governanca (
    clinica_id, membro_id, papel, estado, criado_por_usuario_id, aceito_em, iniciado_em
  ) values (v_convite.clinica_id, v_membro_id, v_convite.papel, 'ativo',
    v_convite.convidado_por_usuario_id, now(), now());
  update public.convites_governanca set status = 'aceito', accepted_by = v_usuario_id, accepted_at = now()
    where id = v_convite.id;
  insert into public.clinica_governanca_auditoria (
    clinica_id, ator_usuario_id, acao, depois, chave_idempotencia
  ) values (v_convite.clinica_id, v_usuario_id,
    case when v_convite.papel = 'responsavel_tecnico' then 'aceitar_rt' else 'nomear_gestor' end,
    jsonb_build_object('conviteId', v_convite.id::text, 'papel', v_convite.papel), p_token);
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'clinicaId', v_convite.clinica_id::text, 'papel', v_convite.papel
  ));
end;
$$;

revoke all on function public.criar_convite_equipe(uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.criar_convite_equipe(uuid, text, text, text, uuid) to authenticated;
revoke all on function public.aceitar_convite_governanca(uuid, text, text[]) from public, anon, authenticated, service_role;
grant execute on function public.aceitar_convite_governanca(uuid, text, text[]) to authenticated;

comment on column public.clinicas.quantidade_dentistas_prevista is
  'Intenção comercial no cadastro; não é contrato, cobrança, reserva de vaga ou limite operacional.';

-- Mantém a assinatura R-170a intacta e expõe uma sobrecarga para o fluxo novo.
-- A quantidade é incorporada à auditoria antes que uma repetição idempotente possa retornar.
create function public.complete_onboarding_modalidade(
  p_nome_clinica text,
  p_modalidade text,
  p_criador_atende boolean,
  p_nome_usuario text,
  p_cro text,
  p_especialidade text[],
  p_email text,
  p_foco_principal text,
  p_chave_idempotencia uuid,
  p_quantidade_dentistas_prevista integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_replay public.onboarding_clinica_auditoria%rowtype;
  v_resultado jsonb;
  v_clinica_id uuid;
begin
  if v_usuario_id is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0401'; end if;
  if p_quantidade_dentistas_prevista is null or p_quantidade_dentistas_prevista < 0
    or (p_modalidade = 'colaborativa' and p_quantidade_dentistas_prevista < 1)
    or (p_criador_atende and p_quantidade_dentistas_prevista < 1) then
    raise exception 'INVALID_INPUT: quantidade de dentistas prevista inválida' using errcode = 'P0400';
  end if;
  select * into v_replay from public.onboarding_clinica_auditoria
    where ator_usuario_id = v_usuario_id and chave_idempotencia = p_chave_idempotencia;
  if found and v_replay.solicitacao -> 'quantidadeDentistasPrevista' is distinct from to_jsonb(p_quantidade_dentistas_prevista) then
    raise exception 'IDEMPOTENCY_CONFLICT: esta tentativa já foi usada com dados diferentes' using errcode = 'P0409';
  end if;

  select public.complete_onboarding_modalidade(
    p_nome_clinica, p_modalidade, p_criador_atende, p_nome_usuario, p_cro, p_especialidade,
    p_email, p_foco_principal, p_chave_idempotencia
  ) into v_resultado;
  if coalesce((v_resultado ->> 'ok')::boolean, false) is not true then return v_resultado; end if;
  v_clinica_id := (v_resultado -> 'data' ->> 'clinicaId')::uuid;
  update public.clinicas set quantidade_dentistas_prevista = p_quantidade_dentistas_prevista,
    onboarding_completo = true
    where id = v_clinica_id;
  update public.onboarding_clinica_auditoria
  set solicitacao = jsonb_set(solicitacao, '{quantidadeDentistasPrevista}', to_jsonb(p_quantidade_dentistas_prevista), true),
      resultado = jsonb_set(resultado, '{resultado,quantidadeDentistasPrevista}', to_jsonb(p_quantidade_dentistas_prevista), true)
  where ator_usuario_id = v_usuario_id and chave_idempotencia = p_chave_idempotencia;
  return jsonb_set(v_resultado, '{data,quantidadeDentistasPrevista}', to_jsonb(p_quantidade_dentistas_prevista), true);
end;
$$;

revoke all on function public.complete_onboarding_modalidade(text, text, boolean, text, text, text[], text, text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_onboarding_modalidade(text, text, boolean, text, text, text[], text, text, uuid, integer)
  to authenticated;
