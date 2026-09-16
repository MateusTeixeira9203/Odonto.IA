-- R165: contrato comercial aditivo para novos cadastros.
-- Não toca em assinaturas_dentista, Checkout legado ou webhook R92.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create unique index if not exists dentistas_id_clinica_unica
  on public.dentistas (id, clinica_id);

-- A modalidade é escolha da unidade. Ela não infere modelo de governança nem
-- cria um pagador clínico fictício quando o responsável não atende.
create table public.configuracoes_comerciais_clinica (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  modalidade text not null check (modalidade in ('individual', 'centralizada')),
  criado_por_usuario_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assinaturas_comerciais (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  modalidade text not null check (modalidade in ('individual', 'centralizada')),
  pagador_usuario_id uuid not null references public.users(id) on delete restrict,
  dentista_id uuid references public.dentistas(id) on delete restrict,
  status text not null default 'aguardando_checkout'
    check (status in ('aguardando_checkout', 'trialing', 'active', 'past_due', 'suspended', 'canceled')),
  preco_centavos integer not null default 20000 check (preco_centavos = 20000),
  ciclo text not null default 'mensal' check (ciclo = 'mensal'),
  quantidade_contratada integer check (quantidade_contratada between 1 and 1000),
  stripe_customer_id text,
  stripe_subscription_id text,
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assinaturas_comerciais_modalidade_consistente check (
    (modalidade = 'individual' and dentista_id is not null and quantidade_contratada = 1)
    or (modalidade = 'centralizada' and dentista_id is null and (
      (status = 'aguardando_checkout' and quantidade_contratada is null)
      or (status <> 'aguardando_checkout' and quantidade_contratada is not null and quantidade_contratada between 1 and 1000)
    ))
  ),
  constraint assinaturas_comerciais_id_clinica_unica unique (id, clinica_id)
);

alter table public.assinaturas_comerciais
  add constraint assinaturas_comerciais_dentista_clinica_fkey
  foreign key (dentista_id, clinica_id)
  references public.dentistas (id, clinica_id) on delete restrict;

create unique index assinaturas_comerciais_individual_aberta_unica
  on public.assinaturas_comerciais (clinica_id, dentista_id)
  where modalidade = 'individual' and status <> 'canceled';
create unique index assinaturas_comerciais_centralizada_aberta_unica
  on public.assinaturas_comerciais (clinica_id)
  where modalidade = 'centralizada' and status <> 'canceled';
create unique index assinaturas_comerciais_stripe_customer_unico
  on public.assinaturas_comerciais (stripe_customer_id) where stripe_customer_id is not null;
create unique index assinaturas_comerciais_stripe_subscription_unica
  on public.assinaturas_comerciais (stripe_subscription_id) where stripe_subscription_id is not null;

create function private.validar_assinatura_comercial()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  -- Serializa a configuração estável da modalidade antes da verificação.
  perform 1 from public.clinicas c where c.id = new.clinica_id for update;
  if not exists (
    select 1 from public.configuracoes_comerciais_clinica c
    where c.clinica_id = new.clinica_id and c.modalidade = new.modalidade
  ) then
    raise exception 'MODALIDADE_COMERCIAL_INVALIDA';
  end if;
  if new.modalidade = 'individual' and not exists (
    select 1 from public.dentistas d
    where d.id = new.dentista_id
      and d.clinica_id = new.clinica_id
      and d.user_id = new.pagador_usuario_id
      and d.ativo
  ) then
    raise exception 'PAGADOR_INDIVIDUAL_INVALIDO';
  end if;
  if new.modalidade = 'centralizada' and not exists (
    select 1 from public.clinica_governanca g
    where g.clinica_id = new.clinica_id
      and g.responsavel_usuario_id = new.pagador_usuario_id
      and g.modelo_clinica = 'gerida'
  ) then
    raise exception 'PAGADOR_CENTRALIZADO_INVALIDO';
  end if;
  if tg_op = 'UPDATE' and new.quantidade_contratada is not null and (select count(*) from public.coberturas_assinatura c where c.clinica_id = new.clinica_id and c.contrato_id = new.id and c.encerrado_em is null) > new.quantidade_contratada then
    raise exception 'COBERTURA_LIMITE_ATINGIDO';
  end if;
  return new;
end;
$$;

create trigger assinaturas_comerciais_validar
before insert or update of clinica_id, modalidade, pagador_usuario_id, dentista_id, status, quantidade_contratada
on public.assinaturas_comerciais
for each row execute function private.validar_assinatura_comercial();

create table public.coberturas_assinatura (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null,
  clinica_id uuid not null,
  dentista_id uuid not null references public.dentistas(id) on delete restrict,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  motivo_encerramento text,
  created_at timestamptz not null default now(),
  constraint coberturas_assinatura_contrato_clinica_fkey
    foreign key (contrato_id, clinica_id)
    references public.assinaturas_comerciais (id, clinica_id) on delete restrict,
  constraint coberturas_assinatura_dentista_clinica_fkey
    foreign key (dentista_id, clinica_id)
    references public.dentistas (id, clinica_id) on delete restrict,
  constraint coberturas_assinatura_periodo_valido check (
    encerrado_em is null or encerrado_em >= iniciado_em
  ),
  constraint coberturas_assinatura_motivo_fechamento check (
    (encerrado_em is null and motivo_encerramento is null)
    or (encerrado_em is not null and char_length(trim(coalesce(motivo_encerramento, ''))) between 1 and 500)
  )
);

create unique index coberturas_assinatura_dentista_atual_unica
  on public.coberturas_assinatura (clinica_id, dentista_id) where encerrado_em is null;
create index coberturas_assinatura_contrato_atual_idx
  on public.coberturas_assinatura (contrato_id, clinica_id) where encerrado_em is null;

create function private.validar_cobertura_assinatura()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_contrato public.assinaturas_comerciais%rowtype;
  v_ocupadas integer;
begin
  if new.encerrado_em is not null then return new; end if;
  select * into v_contrato
  from public.assinaturas_comerciais a
  where a.id = new.contrato_id and a.clinica_id = new.clinica_id
  for update;
  if not found then raise exception 'CONTRATO_INEXISTENTE'; end if;
  perform 1 from public.dentistas d
  where d.id = new.dentista_id and d.clinica_id = new.clinica_id and d.ativo
  for update;
  if not found then raise exception 'DENTISTA_INEXISTENTE'; end if;
  perform 1 from public.clinica_usuarios cu join public.dentistas d on d.user_id=cu.usuario_id and d.clinica_id=cu.clinica_id where cu.clinica_id=new.clinica_id and d.id=new.dentista_id and cu.status='ativo' and cu.role in ('admin','dentista') for share of cu;
  if not found then raise exception 'VINCULO_CLINICO_INATIVO'; end if;
  if v_contrato.status not in ('trialing', 'active', 'past_due') then
    raise exception 'CONTRATO_SEM_COBERTURA';
  end if;
  if v_contrato.modalidade = 'individual' and v_contrato.dentista_id is distinct from new.dentista_id then
    raise exception 'COBERTURA_INDIVIDUAL_INVALIDA';
  end if;
  if v_contrato.modalidade = 'centralizada' then
    select count(*) into v_ocupadas
    from public.coberturas_assinatura c
    where c.contrato_id = new.contrato_id
      and c.clinica_id = new.clinica_id
      and c.encerrado_em is null
      and (tg_op = 'INSERT' or c.id <> new.id);
    if v_ocupadas >= v_contrato.quantidade_contratada then
      raise exception 'COBERTURA_LIMITE_ATINGIDO';
    end if;
  end if;
  return new;
end;
$$;

create trigger coberturas_assinatura_validar_atual
before insert or update of contrato_id, clinica_id, dentista_id, encerrado_em
on public.coberturas_assinatura
for each row execute function private.validar_cobertura_assinatura();

alter table public.assinaturas_comerciais enable row level security;
alter table public.coberturas_assinatura enable row level security;
alter table public.configuracoes_comerciais_clinica enable row level security;
revoke all on table public.assinaturas_comerciais, public.coberturas_assinatura,
  public.configuracoes_comerciais_clinica from public, anon, authenticated;

create trigger configuracoes_comerciais_clinica_updated_at
before update on public.configuracoes_comerciais_clinica
for each row execute function public.update_updated_at();

create trigger assinaturas_comerciais_updated_at
before update on public.assinaturas_comerciais
for each row execute function public.update_updated_at();

create function private.resolver_cobertura_comercial(
  p_clinica_id uuid,
  p_usuario_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_role text;
  v_dentista_id uuid;
  v_existe_r165 boolean;
  v_dentista_coberto boolean;
begin
  if p_clinica_id is null or p_usuario_id is null then return 'sem_cobertura'; end if;

  select cu.role into v_role
  from public.clinica_usuarios cu
  where cu.clinica_id = p_clinica_id
    and cu.usuario_id = p_usuario_id
    and cu.status = 'ativo'
  for share;
  if not found then return 'sem_cobertura'; end if;

  select exists(
    select 1 from public.configuracoes_comerciais_clinica a where a.clinica_id = p_clinica_id
  ) into v_existe_r165;
  if not v_existe_r165 then return 'legado'; end if;

  select d.id into v_dentista_id
  from public.dentistas d
  where d.clinica_id = p_clinica_id
    and d.user_id = p_usuario_id
    and d.ativo
    and d.role in ('admin', 'dentista')
  for share;

  if v_dentista_id is not null then
    return case when exists (
      select 1
      from public.coberturas_assinatura c
      join public.assinaturas_comerciais a
        on a.id = c.contrato_id and a.clinica_id = c.clinica_id
      where c.clinica_id = p_clinica_id
        and c.dentista_id = v_dentista_id
        and c.encerrado_em is null
        and a.status in ('trialing', 'active', 'past_due')
    ) then 'coberto' else 'sem_cobertura' end;
  end if;

  -- Administração não consome vaga, mas só existe enquanto a clínica tem
  -- ao menos uma profissional clinicamente coberta por contrato vigente.
  if v_role not in ('gestor', 'secretaria') then return 'sem_cobertura'; end if;
  select exists (
    select 1
    from public.coberturas_assinatura c
    join public.assinaturas_comerciais a
      on a.id = c.contrato_id and a.clinica_id = c.clinica_id
    join public.dentistas d
      on d.id = c.dentista_id and d.clinica_id = c.clinica_id and d.ativo
    join public.clinica_usuarios cu on cu.usuario_id=d.user_id and cu.clinica_id=d.clinica_id and cu.status='ativo' and cu.role in ('admin','dentista')
    where c.clinica_id = p_clinica_id
      and c.encerrado_em is null
      and a.status in ('trialing', 'active', 'past_due')
  ) into v_dentista_coberto;
  return case when v_dentista_coberto then 'coberto' else 'sem_cobertura' end;
end;
$$;

create function public.obter_cobertura_comercial(p_clinica_id_esperada uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare v_clinica_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sessão autenticada obrigatória.');
  end if;
  select active_clinica_id into v_clinica_id from public.users where id = auth.uid() for share;
  if v_clinica_id is distinct from p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa mudou.');
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'situacao', private.resolver_cobertura_comercial(v_clinica_id, auth.uid())
  ));
end;
$$;

create function public.iniciar_onboarding_r165(
  p_modalidade text,
  p_modelo_clinica text,
  p_atua_clinicamente boolean,
  p_nome_clinica text,
  p_nome_usuario text,
  p_cro text default null,
  p_especialidades text[] default '{}',
  p_telefone text default null,
  p_cidade text default null,
  p_estado text default null,
  p_foco_principal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_clinica_id uuid := gen_random_uuid();
  v_membro_id uuid := gen_random_uuid();
  v_dentista_id uuid;
  v_assinatura_id uuid;
  v_role text;
  v_plano text;
  v_email text;
begin
  if v_usuario_id is null then
    raise exception 'UNAUTHENTICATED: usuário não autenticado' using errcode = 'P0401';
  end if;
  if p_modalidade is null or p_modalidade not in ('individual', 'centralizada') then
    raise exception 'INVALID_INPUT: modalidade inválida' using errcode = 'P0400';
  end if;
  if p_modelo_clinica is null or p_modelo_clinica not in ('colaborativa', 'gerida') then
    raise exception 'INVALID_INPUT: modelo clínico inválido' using errcode = 'P0400';
  end if;
  if p_atua_clinicamente is null then
    raise exception 'INVALID_INPUT: informe se você atende pacientes' using errcode = 'P0400';
  end if;
  if char_length(trim(coalesce(p_nome_clinica, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_nome_usuario, ''))) not between 2 and 120 then
    raise exception 'INVALID_INPUT: nome inválido' using errcode = 'P0400';
  end if;
  if p_foco_principal is not null and p_foco_principal not in ('economizar_tempo', 'crescer') then
    raise exception 'INVALID_INPUT: foco inválido' using errcode = 'P0400';
  end if;
  if p_modalidade = 'centralizada' and p_modelo_clinica <> 'gerida' then
    raise exception 'INVALID_INPUT: cobrança centralizada exige responsável da clínica' using errcode = 'P0400';
  end if;
  if not p_atua_clinicamente and p_modelo_clinica <> 'gerida' then
    raise exception 'INVALID_INPUT: proprietário não clínico exige clínica gerida' using errcode = 'P0400';
  end if;
  if p_atua_clinicamente and (
    char_length(trim(coalesce(p_cro, ''))) not between 1 and 60
    or coalesce(array_length(p_especialidades, 1), 0) not between 1 and 10
    or exists (select 1 from unnest(p_especialidades) as especialidade
               where char_length(trim(coalesce(especialidade, ''))) not between 1 and 80)
  ) then
    raise exception 'INVALID_INPUT: dados clínicos obrigatórios' using errcode = 'P0400';
  end if;
  if char_length(trim(coalesce(p_telefone, ''))) > 40
    or char_length(trim(coalesce(p_cidade, ''))) > 120
    or (p_estado is not null and char_length(trim(p_estado)) <> 2) then
    raise exception 'INVALID_INPUT: contato inválido' using errcode = 'P0400';
  end if;
  select email into v_email from public.users where id = v_usuario_id for update;
  if v_email is null then
    raise exception 'USER_NOT_FOUND: registro em public.users ausente' using errcode = 'P0404';
  end if;
  if exists (select 1 from public.clinica_usuarios where usuario_id = v_usuario_id and status = 'ativo') then
    raise exception 'ALREADY_ONBOARDED: usuário já possui uma clínica ativa' using errcode = 'P0409';
  end if;

  v_role := case when p_atua_clinicamente then 'admin' else 'gestor' end;
  v_plano := 'CLINICA';
  insert into public.clinicas (id, nome, plano, status, limite_dentistas, telefone, cidade, estado)
  values (
    v_clinica_id, trim(p_nome_clinica), v_plano, 'ativa', 8,
    nullif(trim(coalesce(p_telefone, '')), ''), nullif(trim(coalesce(p_cidade, '')), ''),
    nullif(trim(coalesce(p_estado, '')), '')
  );
  update public.users set active_clinica_id = v_clinica_id where id = v_usuario_id;
  insert into public.clinica_usuarios (id, usuario_id, clinica_id, role, status)
  values (v_membro_id, v_usuario_id, v_clinica_id, v_role, 'ativo');

  if p_atua_clinicamente then
    v_dentista_id := gen_random_uuid();
    insert into public.dentistas (
      id, clinica_id, user_id, nome, cro, especialidade, telefone, email, role, ativo, foco_principal
    ) values (
      v_dentista_id, v_clinica_id, v_usuario_id, trim(p_nome_usuario), trim(p_cro), p_especialidades,
      nullif(trim(coalesce(p_telefone, '')), ''), v_email, 'admin', true, p_foco_principal
    );
  end if;
  if p_modelo_clinica = 'gerida' then
    insert into public.clinica_governanca (clinica_id, responsavel_usuario_id, estado, modelo_clinica)
    values (v_clinica_id, v_usuario_id, 'preparacao', 'gerida');
  end if;

  insert into public.configuracoes_comerciais_clinica (clinica_id, modalidade, criado_por_usuario_id)
  values (v_clinica_id, p_modalidade, v_usuario_id);

  if p_modalidade = 'centralizada' then
    insert into public.assinaturas_comerciais (
      clinica_id, modalidade, pagador_usuario_id, dentista_id, status, quantidade_contratada
    ) values (
      v_clinica_id, p_modalidade, v_usuario_id, null, 'aguardando_checkout', null
    ) returning id into v_assinatura_id;
  elsif v_dentista_id is not null then
    insert into public.assinaturas_comerciais (
      clinica_id, modalidade, pagador_usuario_id, dentista_id, status, quantidade_contratada
    ) values (
      v_clinica_id, p_modalidade, v_usuario_id, v_dentista_id, 'aguardando_checkout', 1
    ) returning id into v_assinatura_id;
  end if;

  -- Não há cobertura, Stripe nem liberação neste sublote. O checkout legítimo é
  -- o único fluxo posterior que pode iniciar trial/ativação e inserir cobertura.
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'clinicaId', v_clinica_id,
      'membroId', v_membro_id,
      'dentistaId', v_dentista_id,
      'assinaturaId', v_assinatura_id,
      'modalidade', p_modalidade,
      'checkoutPendente', true
    )
  );
end;
$$;

revoke all on function private.resolver_cobertura_comercial(uuid, uuid) from public, anon, authenticated;
revoke all on function private.validar_assinatura_comercial() from public, anon, authenticated;
revoke all on function private.validar_cobertura_assinatura() from public, anon, authenticated;
revoke all on function public.obter_cobertura_comercial(uuid) from public, anon;
revoke all on function public.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text) from public, anon;
grant execute on function public.obter_cobertura_comercial(uuid) to authenticated;
grant execute on function public.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text) to authenticated;
