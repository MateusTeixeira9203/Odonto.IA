-- R-159h: configuração inicial idempotente da modalidade e do proprietário.
-- Não converte clínicas legadas por efeito colateral.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create or replace function public.configurar_governanca_inicial(
  p_clinica_id uuid,
  p_modalidade text,
  p_proprietario_membro_id uuid,
  p_versao_esperada integer,
  p_chave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ator_id uuid := auth.uid();
  v_ator_membro_id uuid;
  v_ator_papel text;
  v_clinica_id uuid;
  v_governanca public.clinica_governanca%rowtype;
  v_governanca_encontrada boolean := false;
  v_replay jsonb;
  v_solicitacao jsonb;
  v_depois jsonb;
  v_agora timestamptz := now();
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para configurar esta clínica.');
  end if;
  if p_clinica_id is null or p_proprietario_membro_id is null or p_chave_idempotencia is null
    or p_modalidade is null or p_modalidade not in ('colaborativa', 'gerida') or p_versao_esperada is null
    or p_versao_esperada < 0 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Dados de configuração inválidos.');
  end if;

  select u.active_clinica_id into v_clinica_id
  from public.users u
  where u.id = v_ator_id;

  if v_clinica_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para configurar esta clínica.');
  end if;
  if v_clinica_id <> p_clinica_id then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id, cu.role into v_ator_membro_id, v_ator_papel
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id
    and cu.clinica_id = p_clinica_id
    and cu.status = 'ativo'
  limit 1;

  if v_ator_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para configurar esta clínica.');
  end if;
  if v_ator_papel not in ('admin', 'dentista', 'gestor') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para configurar esta clínica.');
  end if;

  -- No onboarding inicial, o próprio criador aceita a primeira propriedade.
  if p_proprietario_membro_id <> v_ator_membro_id then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'O primeiro proprietário deve aceitar a configuração com a própria conta.');
  end if;

  v_solicitacao := jsonb_build_object(
    'modalidade', p_modalidade,
    'proprietarioMembroId', p_proprietario_membro_id::text,
    'versaoEsperada', p_versao_esperada
  );

  select a.depois into v_replay
  from public.clinica_governanca_auditoria a
  where a.clinica_id = p_clinica_id
    and a.ator_usuario_id = v_ator_id
    and a.chave_idempotencia = p_chave_idempotencia;

  if found then
    if v_replay -> 'solicitacao' = v_solicitacao then
      return jsonb_build_object('ok', true, 'data', v_replay -> 'resultado');
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A chave de confirmação já foi usada com outra configuração.');
  end if;

  -- A linha da clínica é o lock de serialização, inclusive quando ainda não há governança.
  perform 1 from public.clinicas c where c.id = p_clinica_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Clínica não encontrada.');
  end if;

  -- Reconsulta dentro do lock: retry concorrente retorna o mesmo resultado.
  select a.depois into v_replay
  from public.clinica_governanca_auditoria a
  where a.clinica_id = p_clinica_id
    and a.ator_usuario_id = v_ator_id
    and a.chave_idempotencia = p_chave_idempotencia;
  if found then
    if v_replay -> 'solicitacao' = v_solicitacao then
      return jsonb_build_object('ok', true, 'data', v_replay -> 'resultado');
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A chave de confirmação já foi usada com outra configuração.');
  end if;

  select * into v_governanca
  from public.clinica_governanca g
  where g.clinica_id = p_clinica_id
  for update;
  v_governanca_encontrada := found;

  if v_governanca_encontrada and v_governanca.modalidade is not null then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A modalidade desta clínica já foi configurada.');
  end if;

  if p_versao_esperada <> 0 then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração mudou. Atualize antes de continuar.');
  end if;

  if exists (
    select 1
    from public.clinica_vinculos_governanca v
    where v.clinica_id = p_clinica_id
      and v.papel = 'proprietario'
      and v.estado in ('pendente_aceite', 'ativo')
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Já existe uma nomeação de proprietário em andamento.');
  end if;

  if not v_governanca_encontrada then
    insert into public.clinica_governanca (
      clinica_id, responsavel_usuario_id, modalidade, vigencia_modalidade_em, versao
    ) values (
      p_clinica_id, v_ator_id, p_modalidade, v_agora, 1
    ) returning * into v_governanca;
  else
    update public.clinica_governanca
       set responsavel_usuario_id = v_ator_id,
           modalidade = p_modalidade,
           vigencia_modalidade_em = v_agora,
           versao = v_governanca.versao + 1,
           updated_at = v_agora
     where clinica_id = p_clinica_id
     returning * into v_governanca;
  end if;

  insert into public.clinica_vinculos_governanca (
    clinica_id, membro_id, papel, estado, criado_por_usuario_id, aceito_em, iniciado_em
  ) values (
    p_clinica_id, v_ator_membro_id, 'proprietario', 'ativo', v_ator_id, v_agora, v_agora
  );

  v_depois := jsonb_build_object(
    'solicitacao', v_solicitacao,
    'resultado', jsonb_build_object(
      'clinicaId', p_clinica_id::text,
      'modalidade', p_modalidade,
      'versao', v_governanca.versao,
      'proprietarioMembroId', v_ator_membro_id::text
    )
  );

  insert into public.clinica_governanca_auditoria (
    clinica_id, ator_usuario_id, acao, antes, depois, chave_idempotencia
  ) values (
    p_clinica_id,
    v_ator_id,
    'configurar_modalidade',
    jsonb_build_object('modalidade', null, 'versao', 0),
    v_depois,
    p_chave_idempotencia
  );

  return jsonb_build_object('ok', true, 'data', v_depois -> 'resultado');
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível configurar a clínica agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível configurar a clínica agora.');
end;
$$;

revoke all on function public.configurar_governanca_inicial(uuid, text, uuid, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.configurar_governanca_inicial(uuid, text, uuid, integer, uuid)
  to authenticated;
