-- R-159d: editor proprietário de concessões já operacionais.
-- Convite, suspensão, remoção e transferência de responsável continuam fora deste contrato.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create function private.acessos_editor_r159d_validos(
  p_acessos jsonb,
  p_papel_alvo text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_acessos jsonb;
begin
  v_acessos := private.normalizar_acessos(p_acessos);
  if v_acessos is null then return false; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value -> 'escopo' ->> 'tipo' <> 'clinica'
       or acesso.value ->> 'permissao' not in (
         'agenda.ler', 'agenda.editar', 'agenda.confirmar',
         'pacientes.ler', 'pacientes.editar',
         'acompanhamentos.ler', 'acompanhamentos.gerir',
         'orcamentos.ler', 'contatos.whatsapp',
         'cobrancas.ler',
         'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar',
         'financeiro.ler', 'financeiro.exportar',
         'despesas.ler', 'despesas.gerir',
         'equipe.ler'
       )
  ) then return false; end if;

  if p_papel_alvo = 'protetico' and exists (
    select 1
    from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' not in ('agenda.ler', 'agenda.confirmar')
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' in ('agenda.editar', 'agenda.confirmar')
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'agenda.ler'
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'pacientes.editar'
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'pacientes.ler'
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'acompanhamentos.gerir'
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'acompanhamentos.ler'
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' in (
      'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar'
    )
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'cobrancas.ler'
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'financeiro.exportar'
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'financeiro.ler'
  ) then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'despesas.gerir'
  ) and not exists (
    select 1 from jsonb_array_elements(v_acessos) acesso(value)
    where acesso.value ->> 'permissao' = 'despesas.ler'
  ) then return false; end if;

  return true;
exception when others then
  return false;
end;
$$;

create function private.obter_acessos_editor_membro(
  p_clinica_id uuid,
  p_membro_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_ator_membro_id uuid;
  v_governanca public.clinica_governanca%rowtype;
  v_alvo public.clinica_usuarios%rowtype;
  v_acesso public.clinica_acessos%rowtype;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null or p_clinica_id is null or p_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para consultar permissões.');
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = v_ator_id and u.active_clinica_id = p_clinica_id
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id into v_ator_membro_id
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id
    and cu.clinica_id = p_clinica_id
    and cu.status = 'ativo'
  limit 1;
  if v_ator_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para consultar permissões.');
  end if;

  select * into v_governanca
  from public.clinica_governanca g
  where g.clinica_id = p_clinica_id
    and g.estado = 'preparacao'
    and g.modelo_clinica = 'gerida'
    and g.responsavel_usuario_id = v_ator_id;
  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Somente o proprietário ativo pode alterar permissões.');
  end if;

  select * into v_alvo
  from public.clinica_usuarios cu
  where cu.id = p_membro_id
    and cu.clinica_id = p_clinica_id
    and cu.status = 'ativo';
  if not found or p_membro_id = v_ator_membro_id or v_alvo.usuario_id = v_governanca.responsavel_usuario_id then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'A configuração desta pessoa não está disponível.');
  end if;

  select * into v_acesso
  from public.clinica_acessos ca
  where ca.clinica_id = p_clinica_id and ca.membro_id = p_membro_id;
  if not found then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'clinicaId', p_clinica_id::text,
      'membroId', p_membro_id::text,
      'versao', 1,
      'acessos', '[]'::jsonb
    ));
  end if;
  if not private.acessos_editor_r159d_validos(v_acesso.acessos, v_alvo.role) then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_SUPORTADO', 'mensagem', 'Esta pessoa tem permissões fora do piloto atual.');
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'clinicaId', p_clinica_id::text,
    'membroId', p_membro_id::text,
    'versao', v_acesso.versao,
    'acessos', v_acesso.acessos
  ));
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar as permissões agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar as permissões agora.');
end;
$$;

create function private.configurar_acessos_editor_membro(
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
  v_governanca public.clinica_governanca%rowtype;
  v_alvo public.clinica_usuarios%rowtype;
  v_acessos_normalizados jsonb;
  v_acesso_id uuid;
  v_bootstrap boolean := false;
  v_resultado jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '10s', true);

  if v_ator_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar permissões.');
  end if;
  if p_clinica_id is null or p_membro_id is null or p_chave_idempotencia is null
    or p_versao_esperada is null or p_versao_esperada <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Dados de configuração inválidos.');
  end if;
  v_acessos_normalizados := private.normalizar_acessos(p_acessos);
  if v_acessos_normalizados is null then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Configuração de acessos inválida.');
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = v_ator_id and u.active_clinica_id = p_clinica_id
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id into v_ator_membro_id
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id and cu.clinica_id = p_clinica_id and cu.status = 'ativo'
  limit 1;
  if v_ator_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso para alterar permissões.');
  end if;

  select * into v_governanca
  from public.clinica_governanca g
  where g.clinica_id = p_clinica_id
  for update;
  if not found or v_governanca.estado <> 'preparacao'
    or v_governanca.modelo_clinica <> 'gerida'
    or v_governanca.responsavel_usuario_id <> v_ator_id then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Somente o proprietário ativo pode alterar permissões.');
  end if;

  select * into v_alvo
  from public.clinica_usuarios cu
  where cu.id = p_membro_id and cu.clinica_id = p_clinica_id
  for update;
  if not found or v_alvo.status <> 'ativo'
    or p_membro_id = v_ator_membro_id
    or v_alvo.usuario_id = v_governanca.responsavel_usuario_id then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'A configuração desta pessoa não está disponível.');
  end if;
  if not private.acessos_editor_r159d_validos(v_acessos_normalizados, v_alvo.role) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'As permissões escolhidas não são compatíveis com este piloto.');
  end if;

  select ca.id into v_acesso_id
  from public.clinica_acessos ca
  where ca.clinica_id = p_clinica_id and ca.membro_id = p_membro_id
  for update;
  if not found then
    if p_versao_esperada <> 1 then
      return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'A configuração foi alterada. Atualize os dados e tente novamente.');
    end if;
    insert into public.clinica_acessos (clinica_id, membro_id, acessos)
    values (p_clinica_id, p_membro_id, '[]'::jsonb);
    v_bootstrap := true;
  end if;

  v_resultado := private.preparar_acessos_membro(
    p_clinica_id,
    p_membro_id,
    p_versao_esperada,
    v_acessos_normalizados,
    p_motivo,
    p_chave_idempotencia
  );
  if coalesce((v_resultado ->> 'ok')::boolean, false) is not true and v_bootstrap then
    delete from public.clinica_acessos
    where clinica_id = p_clinica_id and membro_id = p_membro_id and versao = 1;
  end if;
  return v_resultado;
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível salvar as permissões agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível salvar as permissões agora.');
end;
$$;

create function public.obter_acessos_editor_membro(
  p_clinica_id uuid,
  p_membro_id uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$ select private.obter_acessos_editor_membro(p_clinica_id, p_membro_id); $$;

create function public.configurar_acessos_editor_membro(
  p_clinica_id uuid,
  p_membro_id uuid,
  p_versao_esperada integer,
  p_acessos jsonb,
  p_motivo text,
  p_chave_idempotencia uuid
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.configurar_acessos_editor_membro(
    p_clinica_id, p_membro_id, p_versao_esperada, p_acessos, p_motivo, p_chave_idempotencia
  );
$$;

-- Fecha o caminho anterior, que aceitava catálogo de preparação e não conhecia clínica
-- gerida, bootstrap, matriz efetiva ou a restrição do protético.
revoke all on function public.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function private.preparar_acessos_membro(uuid, uuid, integer, jsonb, text, uuid)
  from public, anon, authenticated;

revoke all on function private.acessos_editor_r159d_validos(jsonb, text) from public, anon, authenticated;
revoke all on function private.obter_acessos_editor_membro(uuid, uuid) from public, anon, authenticated;
revoke all on function private.configurar_acessos_editor_membro(uuid, uuid, integer, jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.obter_acessos_editor_membro(uuid, uuid) from public, anon;
revoke all on function public.configurar_acessos_editor_membro(uuid, uuid, integer, jsonb, text, uuid) from public, anon;
grant execute on function public.obter_acessos_editor_membro(uuid, uuid) to authenticated;
grant execute on function public.configurar_acessos_editor_membro(uuid, uuid, integer, jsonb, text, uuid) to authenticated;

-- Mesmo que haja configuração antiga, protético não pode abrir a leitura de equipe por grant.
create or replace function public.listar_equipe_gestao(
  p_clinica_id uuid,
  p_apos uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_papel text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;
  select cu.role into v_papel
  from public.users u
  join public.clinica_usuarios cu
    on cu.usuario_id = u.id
   and cu.clinica_id = p_clinica_id
   and cu.status = 'ativo'
  where u.id = auth.uid()
    and u.active_clinica_id = p_clinica_id
  limit 1;
  if v_papel = 'protetico' then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à equipe desta clínica.');
  end if;
  return private.listar_equipe_gestao(p_clinica_id, p_apos);
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a equipe agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar a equipe agora.');
end;
$$;

revoke all on function private.listar_equipe_gestao(uuid, uuid) from public, anon, authenticated;
revoke all on function public.listar_equipe_gestao(uuid, uuid) from public, anon;
grant execute on function public.listar_equipe_gestao(uuid, uuid) to authenticated;
