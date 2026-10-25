-- R-181: proprietário conserva autoridade; convites e acessos podem ser delegados
-- por capabilities explícitas de clínica, sem promoção implícita pelo cargo gestor.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function private.r181_pode_gerir_equipe(
  p_clinica_id uuid,
  p_usuario_id uuid,
  p_permissao text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinica_usuarios cu
    where cu.clinica_id = p_clinica_id
      and cu.usuario_id = p_usuario_id
      and cu.status = 'ativo'
      and (
        exists (
          select 1
          from public.clinica_vinculos_governanca vg
          where vg.clinica_id = cu.clinica_id
            and vg.membro_id = cu.id
            and vg.estado = 'ativo'
            and vg.papel = 'proprietario'
        )
        or exists (
          select 1
          from public.clinica_acessos ca
          cross join lateral jsonb_array_elements(ca.acessos) acesso
          where ca.clinica_id = cu.clinica_id
            and ca.membro_id = cu.id
            and acesso ->> 'permissao' = p_permissao
            and acesso -> 'escopo' ->> 'tipo' = 'clinica'
        )
      )
  );
$$;

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

  if not exists (
    select 1 from public.users u
    where u.id = v_usuario_id and u.active_clinica_id = p_clinica_id
  ) then
    raise exception 'CONTEXT_CHANGED' using errcode = 'P0409';
  end if;

  select g.modalidade into v_modalidade
  from public.clinica_governanca g where g.clinica_id = p_clinica_id;

  if v_modalidade = 'gerida' then
    v_autorizado := private.r181_pode_gerir_equipe(
      p_clinica_id,
      v_usuario_id,
      'equipe.convidar'
    );
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

create or replace function private.preparar_acessos_membro(
  p_clinica_id uuid,
  p_membro_id uuid,
  p_versao_esperada integer,
  p_acessos jsonb,
  p_motivo text,
  p_chave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_ator_membro_id uuid;
  v_contexto_alterado boolean := false;
  v_ator_revalidado boolean := false;
  v_governanca public.clinica_governanca%rowtype;
  v_membro public.clinica_usuarios%rowtype;
  v_membro_bloqueado public.clinica_usuarios%rowtype;
  v_acesso public.clinica_acessos%rowtype;
  v_acessos_normalizados jsonb;
  v_payload jsonb;
  v_hash text;
  v_resultado jsonb;
  v_replay jsonb;
  v_motivo_normalizado text;
  v_alvos uuid[];
  v_quantidade_alvos integer;
  v_quantidade_validos integer;
  v_perfil_clinico boolean := false;
  v_item jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if p_clinica_id is null or p_membro_id is null or p_chave_idempotencia is null
    or p_versao_esperada is null or p_versao_esperada <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Dados de configuração inválidos.');
  end if;

  v_motivo_normalizado := btrim(coalesce(p_motivo, ''));
  if char_length(v_motivo_normalizado) not between 1 and 500 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Informe um motivo entre 1 e 500 caracteres.');
  end if;

  v_acessos_normalizados := private.normalizar_acessos(p_acessos);
  if v_acessos_normalizados is null then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Configuração de acessos inválida.');
  end if;

  select cu.id into v_ator_membro_id
  from public.users u
  join public.clinica_usuarios cu
    on cu.usuario_id = u.id and cu.clinica_id = p_clinica_id and cu.status = 'ativo'
  where u.id = v_ator_id and u.active_clinica_id = p_clinica_id
  limit 1;

  if v_ator_membro_id is null then
    select exists(
      select 1 from public.users u
      where u.id = v_ator_id and u.active_clinica_id is distinct from p_clinica_id
    ) into v_contexto_alterado;
    if v_contexto_alterado then
      return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;

  select * into v_governanca
  from public.clinica_governanca
  where clinica_id = p_clinica_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Configuração da clínica não encontrada.');
  end if;

  for v_membro_bloqueado in
    select * from public.clinica_usuarios
    where clinica_id = p_clinica_id and id in (v_ator_membro_id, p_membro_id)
    order by id for update
  loop
    if v_membro_bloqueado.id = v_ator_membro_id then
      if v_membro_bloqueado.status <> 'ativo' or v_membro_bloqueado.usuario_id <> v_ator_id then
        return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
      end if;
      v_ator_revalidado := true;
    end if;
    if v_membro_bloqueado.id = p_membro_id then
      v_membro := v_membro_bloqueado;
    end if;
  end loop;

  if not v_ator_revalidado then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  select u.active_clinica_id = p_clinica_id into v_contexto_alterado
  from public.users u where u.id = v_ator_id for share;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if v_contexto_alterado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not private.r181_pode_gerir_equipe(p_clinica_id, v_ator_id, 'permissoes.gerir') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar configurações.');
  end if;
  if v_membro.id is null or v_membro.status <> 'ativo' then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Membro não encontrado na clínica ativa.');
  end if;
  if p_membro_id = v_ator_membro_id or v_membro.usuario_id = v_governanca.responsavel_usuario_id then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'O responsável não pode editar a própria configuração neste recorte.');
  end if;

  select * into v_acesso
  from public.clinica_acessos
  where clinica_id = p_clinica_id and membro_id = p_membro_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Configuração do membro não encontrada.');
  end if;

  for v_item in select value from jsonb_array_elements(v_acessos_normalizados)
  loop
    if v_item -> 'escopo' ->> 'tipo' = 'selecionados' then
      select array_agg(value::uuid), count(*) into v_alvos, v_quantidade_alvos
      from jsonb_array_elements_text(v_item -> 'escopo' -> 'dentistaIds');
      select count(*) into v_quantidade_validos
      from public.dentistas d
      join public.clinica_usuarios cu
        on cu.usuario_id = d.user_id and cu.clinica_id = d.clinica_id
        and cu.status = 'ativo' and cu.role in ('admin', 'dentista')
      where d.id = any(v_alvos) and d.clinica_id = p_clinica_id
        and d.ativo and d.role in ('admin', 'dentista');
      if v_quantidade_alvos <> v_quantidade_validos then
        return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Os profissionais selecionados não são válidos para esta clínica.');
      end if;
    end if;
  end loop;

  select exists(
    select 1 from public.dentistas d
    join public.clinica_usuarios cu
      on cu.usuario_id = d.user_id and cu.clinica_id = d.clinica_id
      and cu.status = 'ativo' and cu.role in ('admin', 'dentista')
    where d.user_id = v_membro.usuario_id and d.clinica_id = p_clinica_id
      and d.ativo and d.role in ('admin', 'dentista')
  ) into v_perfil_clinico;

  if exists (
    select 1 from jsonb_array_elements(v_acessos_normalizados) as acesso(value)
    where (
      acesso.value ->> 'permissao' in ('clinico.ler', 'clinico.registrar')
      and acesso.value -> 'escopo' ->> 'tipo' <> 'nenhum'
    ) or (
      acesso.value -> 'escopo' ->> 'tipo' = 'proprio'
      and acesso.value ->> 'permissao' not in ('acompanhamentos.ler', 'acompanhamentos.gerir')
    )
  ) and not v_perfil_clinico then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'O escopo próprio exige perfil profissional ativo para este recurso.');
  end if;

  v_payload := jsonb_build_object(
    'acessos', v_acessos_normalizados,
    'clinicaId', p_clinica_id::text,
    'membroId', p_membro_id::text,
    'motivo', v_motivo_normalizado,
    'versaoEsperada', p_versao_esperada
  );
  v_hash := encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');

  select resultado into v_replay
  from public.clinica_acessos_auditoria
  where clinica_id = p_clinica_id and ator_usuario_id = v_ator_id
    and chave_idempotencia = p_chave_idempotencia;
  if found then
    if exists (
      select 1 from public.clinica_acessos_auditoria
      where clinica_id = p_clinica_id and ator_usuario_id = v_ator_id
        and chave_idempotencia = p_chave_idempotencia and payload_hash = v_hash
    ) then
      return v_replay;
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A chave de idempotência já foi usada com outra configuração.');
  end if;

  if v_acesso.versao <> p_versao_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração foi alterada por outra pessoa.');
  end if;
  if v_acesso.versao = 2147483647 then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração precisa ser revisada antes de nova alteração.');
  end if;

  update public.clinica_acessos
  set acessos = v_acessos_normalizados, versao = versao + 1, updated_at = now()
  where id = v_acesso.id and clinica_id = p_clinica_id
  returning versao into v_acesso.versao;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
  end if;

  v_resultado := jsonb_build_object('ok', true, 'data', jsonb_build_object('versao', v_acesso.versao));
  insert into public.clinica_acessos_auditoria (
    clinica_id, ator_usuario_id, membro_id, versao_anterior, versao_nova,
    acessos_antes, acessos_depois, motivo, chave_idempotencia, payload_hash, resultado
  ) values (
    p_clinica_id, v_ator_id, p_membro_id, p_versao_esperada, v_acesso.versao,
    v_acesso.acessos, v_acessos_normalizados, v_motivo_normalizado,
    p_chave_idempotencia, v_hash, v_resultado
  );
  return v_resultado;
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível concluir a alteração agora.');
end;
$$;

revoke all on function private.r181_pode_gerir_equipe(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid)
  to authenticated;
revoke all on function public.criar_convite_equipe(uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.criar_convite_equipe(uuid, text, text, text, uuid)
  to authenticated;
