-- R-159c: vínculo gestor isolado e consulta protegida da equipe.
-- Não cria perfil clínico, não altera policies legadas e não ativa a governança.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

alter table public.clinica_usuarios
  drop constraint clinica_usuarios_role_check,
  add constraint clinica_usuarios_role_check
    check (role in ('admin', 'dentista', 'secretaria', 'protetico', 'gestor'));

-- Preserva os dois ramos legados, mas não devolve uma clínica ativa apenas porque
-- ela ainda está apontada em users para um gestor sem vínculo clínico legítimo.
create or replace function public.get_my_clinica_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when exists (select 1 from public.users u where u.id = auth.uid()) then
      (
        select case
          when u.active_clinica_id is null then
            (select d.clinica_id
             from public.dentistas d
             where d.user_id = auth.uid() and d.ativo = true
             limit 1)
          when exists (
            select 1
            from public.clinica_usuarios cu
            where cu.usuario_id = auth.uid()
              and cu.clinica_id = u.active_clinica_id
              and cu.role = 'gestor'
              and cu.status = 'ativo'
          ) then null
          when exists (
            select 1
            from public.clinica_usuarios cu
            where cu.usuario_id = auth.uid()
              and cu.clinica_id = u.active_clinica_id
              and cu.role = 'gestor'
              and cu.status in ('pendente', 'removido', 'suspenso')
          ) and not exists (
            select 1
            from public.dentistas d
            join public.clinica_usuarios cu
              on cu.usuario_id = d.user_id
             and cu.clinica_id = d.clinica_id
             and cu.status = 'ativo'
             and cu.role in ('admin', 'dentista')
            where d.user_id = auth.uid()
              and d.clinica_id = u.active_clinica_id
              and d.ativo = true
              and d.role in ('admin', 'dentista')
          ) then null
          else u.active_clinica_id
        end
        from public.users u
        where u.id = auth.uid()
      )
    else
      (select d.clinica_id
       from public.dentistas d
       where d.user_id = auth.uid() and d.ativo = true
       limit 1)
  end
$$;

create function private.listar_equipe_gestao(
  p_clinica_id uuid,
  p_apos uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_membro_id uuid;
  v_clinica_nome text;
  v_autorizado boolean := false;
  v_cursor_valido boolean := false;
  v_membros jsonb;
  v_proximo text;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;
  if p_clinica_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Dados de consulta inválidos.');
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = v_ator_id
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;
  if not exists (
    select 1
    from public.users u
    where u.id = v_ator_id
      and u.active_clinica_id = p_clinica_id
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id into v_membro_id
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id
    and cu.clinica_id = p_clinica_id
    and cu.status = 'ativo'
  limit 1;
  if v_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;

  if not exists (
    select 1
    from public.clinica_governanca g
    where g.clinica_id = p_clinica_id
      and g.estado = 'preparacao'
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;

  select exists (
    select 1
    from public.clinica_governanca g
    where g.clinica_id = p_clinica_id
      and g.estado = 'preparacao'
      and g.responsavel_usuario_id = v_ator_id
  ) or exists (
    select 1
    from public.clinica_acessos ca
    where ca.clinica_id = p_clinica_id
      and ca.membro_id = v_membro_id
      and exists (
        select 1
        from jsonb_array_elements(ca.acessos) acesso(value)
        where acesso.value ->> 'permissao' = 'equipe.ler'
          and acesso.value -> 'escopo' ->> 'tipo' = 'clinica'
      )
  ) into v_autorizado;
  if v_autorizado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;

  -- Só depois de autenticar e autorizar o ator o cursor é resolvido.
  if p_apos is not null then
    select exists (
      select 1
      from public.clinica_usuarios cu
      where cu.id = p_apos
        and cu.clinica_id = p_clinica_id
    ) into v_cursor_valido;
    if v_cursor_valido is not true then
      return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Cursor de paginação inválido.');
    end if;
  end if;

  select c.nome into v_clinica_nome
  from public.clinicas c
  where c.id = p_clinica_id;
  if v_clinica_nome is null then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a equipe agora.');
  end if;

  with pagina as (
    select
      cu.id,
      cu.usuario_id,
      cu.role,
      cu.status,
      left(coalesce(
        nullif(btrim(d.nome), ''),
        nullif(btrim(s.nome), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'nome'), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(u.email), ''),
        'Pessoa da equipe'
      ), 200) as nome,
      left(u.email, 320) as email,
      (g.responsavel_usuario_id = cu.usuario_id) as proprietario,
      (
        cu.status = 'ativo'
        and cu.role in ('admin', 'dentista')
        and d.id is not null
        and d.ativo = true
        and d.role in ('admin', 'dentista')
      ) as atua_clinicamente,
      row_number() over (order by cu.id) as posicao
    from public.clinica_usuarios cu
    join public.users u on u.id = cu.usuario_id
    left join auth.users au on au.id = cu.usuario_id
    left join public.dentistas d
      on d.user_id = cu.usuario_id
     and d.clinica_id = cu.clinica_id
    left join public.secretarias s
      on s.usuario_id = cu.usuario_id
     and s.clinica_id = cu.clinica_id
    join public.clinica_governanca g on g.clinica_id = cu.clinica_id
    where cu.clinica_id = p_clinica_id
      and (p_apos is null or cu.id > p_apos)
    order by cu.id
    limit 51
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'membroId', id::text,
          'nome', nome,
          'email', email,
          'papel', role,
          'status', status,
          'proprietario', proprietario,
          'atuaClinicamente', atua_clinicamente
        ) order by id
      ) filter (where posicao <= 50),
      '[]'::jsonb
    ),
    case when count(*) filter (where posicao = 51) = 1 then
      ((array_agg(id order by posicao) filter (where posicao <= 50))[50])::text
    else null end
  into v_membros, v_proximo
  from pagina;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'clinicaId', p_clinica_id::text,
      'clinicaNome', v_clinica_nome,
      'membros', v_membros,
      'proximo', v_proximo
    )
  );
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a equipe agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a equipe agora.');
end;
$$;

-- O endpoint exposto não eleva privilégios; a leitura protegida fica na rotina privada.
create function public.listar_equipe_gestao(
  p_clinica_id uuid,
  p_apos uuid default null
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.listar_equipe_gestao(p_clinica_id, p_apos);
$$;

revoke all on function private.listar_equipe_gestao(uuid, uuid) from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.listar_equipe_gestao(uuid, uuid) to authenticated;
revoke all on function public.listar_equipe_gestao(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.listar_equipe_gestao(uuid, uuid) to authenticated;
