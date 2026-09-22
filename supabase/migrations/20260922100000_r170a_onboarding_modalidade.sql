-- R-170a: cria a clínica já na modalidade escolhida no cadastro.
-- A RPC legada `complete_onboarding` continua intacta para clínicas existentes.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create table if not exists public.onboarding_clinica_auditoria (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  ator_usuario_id uuid not null references public.users(id) on delete restrict,
  chave_idempotencia uuid not null,
  solicitacao jsonb not null check (jsonb_typeof(solicitacao) = 'object'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  created_at timestamptz not null default now(),
  unique (ator_usuario_id, chave_idempotencia)
);

create index if not exists onboarding_clinica_auditoria_clinica_data_idx
  on public.onboarding_clinica_auditoria (clinica_id, created_at desc);

alter table public.onboarding_clinica_auditoria enable row level security;
revoke all on table public.onboarding_clinica_auditoria from public, anon, authenticated;

create or replace function public.complete_onboarding_modalidade(
  p_nome_clinica text,
  p_modalidade text,
  p_criador_atende boolean,
  p_nome_usuario text,
  p_cro text default null,
  p_especialidade text[] default '{}',
  p_email text default null,
  p_foco_principal text default null,
  p_chave_idempotencia uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_dentista_id uuid;
  v_role_membro text;
  v_solicitacao jsonb;
  v_resultado jsonb;
  v_replay jsonb;
  v_governanca jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_usuario_id is null then
    raise exception 'UNAUTHENTICATED: usuário não autenticado' using errcode = 'P0401';
  end if;

  if p_chave_idempotencia is null
    or p_modalidade is null or p_modalidade not in ('colaborativa', 'gerida')
    or p_criador_atende is null
    or nullif(btrim(coalesce(p_nome_clinica, '')), '') is null
    or nullif(btrim(coalesce(p_nome_usuario, '')), '') is null then
    raise exception 'INVALID_INPUT: dados de cadastro inválidos' using errcode = 'P0400';
  end if;

  if p_modalidade = 'colaborativa' and p_criador_atende is not true then
    raise exception 'INVALID_INPUT: clínica colaborativa exige criador dentista' using errcode = 'P0400';
  end if;

  if p_criador_atende and (
    nullif(btrim(coalesce(p_cro, '')), '') is null
    or p_especialidade is null
    or array_length(p_especialidade, 1) is null
  ) then
    raise exception 'INVALID_INPUT: CRO e especialidade são obrigatórios para quem atende' using errcode = 'P0400';
  end if;

  if p_foco_principal is not null and p_foco_principal not in ('economizar_tempo', 'crescer') then
    raise exception 'INVALID_INPUT: foco_principal inválido' using errcode = 'P0400';
  end if;

  v_solicitacao := jsonb_build_object(
    'nomeClinica', btrim(p_nome_clinica),
    'modalidade', p_modalidade,
    'criadorAtende', p_criador_atende,
    'nomeUsuario', btrim(p_nome_usuario),
    'cro', nullif(btrim(coalesce(p_cro, '')), ''),
    'especialidade', coalesce(to_jsonb(p_especialidade), '[]'::jsonb),
    'focoPrincipal', p_foco_principal
  );

  select a.resultado into v_replay
  from public.onboarding_clinica_auditoria a
  where a.ator_usuario_id = v_usuario_id
    and a.chave_idempotencia = p_chave_idempotencia;

  if found then
    if v_replay -> 'solicitacao' = v_solicitacao then
      return jsonb_build_object('ok', true, 'data', v_replay -> 'resultado');
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: esta tentativa já foi usada com dados diferentes' using errcode = 'P0409';
  end if;

  if exists (
    select 1 from public.clinica_usuarios cu
    where cu.usuario_id = v_usuario_id and cu.status = 'ativo'
  ) then
    raise exception 'ALREADY_ONBOARDED: usuário já possui uma clínica ativa' using errcode = 'P0409';
  end if;

  v_clinica_id := gen_random_uuid();
  insert into public.clinicas (id, nome, plano, status, limite_dentistas, onboarding_completo)
  values (
    v_clinica_id,
    btrim(p_nome_clinica),
    'SOLO',
    'ativa',
    case when p_modalidade = 'colaborativa' then 1 else 5 end,
    not p_criador_atende
  );

  v_role_membro := case
    when p_modalidade = 'colaborativa' then 'admin'
    when p_criador_atende then 'dentista'
    else 'gestor'
  end;

  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status)
  values (v_usuario_id, v_clinica_id, v_role_membro, 'ativo')
  returning id into v_membro_id;

  update public.users
  set active_clinica_id = v_clinica_id
  where id = v_usuario_id;
  if not found then
    raise exception 'USER_NOT_FOUND: registro de usuário ausente' using errcode = 'P0404';
  end if;

  if p_criador_atende then
    v_dentista_id := gen_random_uuid();
    insert into public.dentistas (
      id, clinica_id, user_id, nome, cro, especialidade, email, role, ativo, foco_principal
    ) values (
      v_dentista_id, v_clinica_id, v_usuario_id, btrim(p_nome_usuario),
      nullif(btrim(coalesce(p_cro, '')), ''), p_especialidade, p_email,
      case when p_modalidade = 'colaborativa' then 'admin' else 'dentista' end,
      true, p_foco_principal
    );

    begin
      insert into public.procedimentos (
        clinica_id, dentista_id, nome, descricao, categoria, preco_padrao, duracao_minutos, ativo
      )
      select v_clinica_id, v_dentista_id, pp.nome, pp.descricao, pp.categoria,
        pp.preco_sugerido, pp.duracao_minutos, true
      from public.procedimentos_padrao pp
      where pp.ativo = true;
    exception when others then
      raise warning '[complete_onboarding_modalidade] erro ao copiar procedimentos padrão: %', sqlerrm;
    end;
  end if;

  select public.configurar_governanca_inicial(
    v_clinica_id,
    p_modalidade,
    case when p_modalidade = 'gerida' then v_membro_id else null end,
    0,
    p_chave_idempotencia
  ) into v_governanca;

  if coalesce((v_governanca ->> 'ok')::boolean, false) is not true then
    raise exception 'GOVERNANCE_FAILED: %', coalesce(v_governanca ->> 'mensagem', 'não foi possível configurar a governança')
      using errcode = 'P0400';
  end if;

  v_resultado := jsonb_build_object(
    'clinicaId', v_clinica_id::text,
    'membroId', v_membro_id::text,
    'modalidade', p_modalidade,
    'criadorAtende', p_criador_atende,
    'dentistaId', case when v_dentista_id is null then null else v_dentista_id::text end
  );

  insert into public.onboarding_clinica_auditoria (
    clinica_id, ator_usuario_id, chave_idempotencia, solicitacao, resultado
  ) values (
    v_clinica_id, v_usuario_id, p_chave_idempotencia, v_solicitacao,
    jsonb_build_object('solicitacao', v_solicitacao, 'resultado', v_resultado)
  );

  return jsonb_build_object('ok', true, 'data', v_resultado);
end;
$$;

revoke all on function public.complete_onboarding_modalidade(
  text, text, boolean, text, text, text[], text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.complete_onboarding_modalidade(
  text, text, boolean, text, text, text[], text, text, uuid
) to authenticated;

comment on function public.complete_onboarding_modalidade is
  'R-170a: cria clínica, membership, perfil clínico opcional e governança inicial em uma transação idempotente.';
