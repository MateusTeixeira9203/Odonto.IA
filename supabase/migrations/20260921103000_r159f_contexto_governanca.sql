-- R-159f: leitura autenticada da modalidade e dos vínculos de governança.
-- Não cria, altera ou converte clínica alguma.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create or replace function public.obter_contexto_governanca(
  p_clinica_id_esperada uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_modalidade text;
  v_versao integer;
  v_vigencia timestamptz;
  v_papeis jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à governança desta clínica.');
  end if;

  select u.active_clinica_id
    into v_clinica_id
  from public.users u
  where u.id = v_ator_id;

  if v_clinica_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à governança desta clínica.');
  end if;

  if p_clinica_id_esperada is null or p_clinica_id_esperada <> v_clinica_id then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id
    into v_membro_id
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id
    and cu.clinica_id = v_clinica_id
    and cu.status = 'ativo'
  limit 1;

  if v_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à governança desta clínica.');
  end if;

  select g.modalidade, g.versao, g.vigencia_modalidade_em
    into v_modalidade, v_versao, v_vigencia
  from public.clinica_governanca g
  where g.clinica_id = v_clinica_id;

  if not found or v_modalidade is null then
    return jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'clinicaId', v_clinica_id::text,
        'modalidade', 'colaborativa',
        'versao', 0,
        'vigenciaModalidadeEm', null,
        'configurada', false,
        'papeis', '[]'::jsonb
      )
    );
  end if;

  select coalesce(jsonb_agg(v.papel order by v.papel), '[]'::jsonb)
    into v_papeis
  from public.clinica_vinculos_governanca v
  where v.clinica_id = v_clinica_id
    and v.membro_id = v_membro_id
    and v.estado = 'ativo';

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'clinicaId', v_clinica_id::text,
      'modalidade', v_modalidade,
      'versao', v_versao,
      'vigenciaModalidadeEm', v_vigencia,
      'configurada', true,
      'papeis', v_papeis
    )
  );
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a governança agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a governança agora.');
end;
$$;

revoke all on function public.obter_contexto_governanca(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_contexto_governanca(uuid) to authenticated;
