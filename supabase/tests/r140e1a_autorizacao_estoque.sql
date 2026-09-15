-- R-140e1a — autorização operacional de estoque.
--
-- Executar somente depois de R-159b/c, R-140e1 e R-140e1a, em conexão
-- administrativa do projeto de teste. Cria uma clínica descartável e vincula A,
-- B e a recepção QA apenas nesta transação; o ROLLBACK final remove tudo.
--
-- `request.jwt.claims`/`request.jwt.claim.sub` simulam a identidade que as
-- RPCs recebem. Isto não substitui o gate posterior de duas sessões reais.

begin;

do $$
declare
  v_clinica_a uuid := gen_random_uuid();
  v_clinica_externa uuid := 'c4f5b5f7-12a6-4b1d-a7d2-7d71565ca987';
  v_usuario_a uuid := '65875816-02d9-4b21-bf9c-29626de20a31';
  v_usuario_b uuid := 'e5f2bc67-bd38-40f8-ba3f-0a4400251281';
  v_usuario_recepcao uuid := '06ed58fe-aec6-4eec-ad3d-b55102f02f12';
  v_dentista_b uuid := gen_random_uuid();
  v_dentista_a uuid := gen_random_uuid();
  v_membro_a uuid;
  v_membro_b uuid;
  v_membro_recepcao uuid;
  v_email_a text;
  v_email_b text;
  v_email_recepcao text;
  v_preparados_b jsonb := jsonb_build_array(jsonb_build_object(
    'permissao', 'agenda.ler', 'escopo', jsonb_build_object('tipo', 'clinica')
  ));
  v_acessos_preparados jsonb;
  v_versao_geral integer;
  v_versao_estoque integer;
  v_resultado jsonb;
  v_seis jsonb := '["estoque.ler","estoque.gerir","estoque.receber","estoque.consumir","estoque.descartar","estoque.ajustar"]'::jsonb;
  v_ler jsonb := '[{"permissao":"estoque.ler","escopo":{"tipo":"clinica"}}]'::jsonb;
  v_ler_receber jsonb := '[{"permissao":"estoque.ler","escopo":{"tipo":"clinica"}},{"permissao":"estoque.receber","escopo":{"tipo":"clinica"}}]'::jsonb;
  v_ler_gerir jsonb := '[{"permissao":"estoque.ler","escopo":{"tipo":"clinica"}},{"permissao":"estoque.gerir","escopo":{"tipo":"clinica"}}]'::jsonb;
  v_chave_colaborativa uuid := '11111111-1111-4111-8111-111111111111';
  v_chave_gerida uuid := '22222222-2222-4222-8222-222222222222';
  v_chave_conflito uuid := '33333333-3333-4333-8333-333333333333';
  v_chave_revogacao uuid := '44444444-4444-4444-8444-444444444444';
begin
  select u.email into v_email_a from public.users u where u.id = v_usuario_a;
  select u.email into v_email_b from public.users u where u.id = v_usuario_b;
  select u.email into v_email_recepcao from public.users u where u.id = v_usuario_recepcao;
  if v_email_a is null
    or v_email_b is null
    or v_email_recepcao is null
    or v_email_a not like 'qa%@odontoia.example'
    or v_email_b not like 'qa%@odontoia.example'
    or v_email_recepcao is distinct from 'qa-r164-recepcao@odontoia.example' then
    raise exception 'r140e1a_fixture_qa_invalida';
  end if;

  insert into public.clinicas (id, nome)
  values (v_clinica_a, '__R140E1A_AUTORIZACAO_DESCARTAVEL__');
  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status)
  values (v_usuario_a, v_clinica_a, 'admin', 'ativo')
  returning id into v_membro_a;
  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status)
  values (v_usuario_b, v_clinica_a, 'dentista', 'ativo')
  returning id into v_membro_b;
  insert into public.clinica_usuarios (usuario_id, clinica_id, role, status)
  values (v_usuario_recepcao, v_clinica_a, 'secretaria', 'ativo')
  returning id into v_membro_recepcao;
  insert into public.dentistas (id, clinica_id, user_id, nome, role, ativo)
  values (v_dentista_a, v_clinica_a, v_usuario_a, '__R140E1A_DENTISTA_A__', 'admin', true);
  insert into public.dentistas (id, clinica_id, user_id, nome, role, ativo)
  values (v_dentista_b, v_clinica_a, v_usuario_b, '__R140E1A_DENTISTA_B__', 'dentista', true);
  insert into public.clinica_acessos (clinica_id, membro_id, acessos)
  values (v_clinica_a, v_membro_recepcao, v_preparados_b);

  select ca.acessos, ca.versao into v_acessos_preparados, v_versao_geral
  from public.clinica_acessos ca
  where ca.clinica_id = v_clinica_a and ca.membro_id = v_membro_recepcao;
  select ca.versao_estoque into v_versao_estoque
  from public.clinica_acessos ca
  where ca.clinica_id = v_clinica_a and ca.membro_id = v_membro_recepcao;
  if v_acessos_preparados is null or v_versao_geral is null or v_versao_estoque is null then
    raise exception 'r140e1a_preparacao_inicial_invalida';
  end if;

  update public.users set active_clinica_id = v_clinica_a
  where id in (v_usuario_a, v_usuario_b, v_usuario_recepcao);
  insert into public.clinica_governanca (
    clinica_id, responsavel_usuario_id, modelo_estoque, estoque_ativo
  ) values (v_clinica_a, v_usuario_a, 'colaborativa', false);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_a::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_a::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then
    raise exception 'r140e1a_inativo_nao_negou: %', v_resultado;
  end if;

  -- Colaborativa: A e B clínicos são iguais no compartilhado e têm privados distintos.
  update public.clinica_governanca set estoque_ativo = true where clinica_id = v_clinica_a;
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'ok' is distinct from 'true'
    or v_resultado#>>'{data,modelo}' is distinct from 'colaborativa'
    or v_resultado#>>'{data,dentistaId}' is distinct from v_dentista_a::text
    or (v_resultado#>'{data,permissoesPessoais}' @> v_seis) is not true
    or (v_resultado#>'{data,permissoesCompartilhadas}' @> v_seis) is not true
    or (v_resultado#>>'{data,podeGerenciarCompartilhado}')::boolean is not true then
    raise exception 'r140e1a_colaborativa_a_invalida: %', v_resultado;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_b::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_b::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'ok' is distinct from 'true'
    or v_resultado#>>'{data,dentistaId}' is distinct from v_dentista_b::text
    or (v_resultado#>'{data,permissoesPessoais}' @> v_seis) is not true
    or (v_resultado#>'{data,permissoesCompartilhadas}' @> v_seis) is not true
    or v_resultado#>>'{data,dentistaId}' is not distinct from v_dentista_a::text then
    raise exception 'r140e1a_colaborativa_b_invalida: %', v_resultado;
  end if;

  -- B não pode editar a base igualitária de A; a clínica externa não é consultável.
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_a, 1, v_ler, 'Tentativa contra dentista igual', gen_random_uuid()
  );
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then
    raise exception 'r140e1a_colaborador_editou_dentista: %', v_resultado;
  end if;
  v_resultado := public.obter_contexto_estoque(v_clinica_externa);
  if v_resultado->>'codigo' is distinct from 'CONTEXTO_ALTERADO' then
    raise exception 'r140e1a_contexto_externo_nao_negou: %', v_resultado;
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_a::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_a::text, true);

  -- Na colaborativa, dentista pode conceder ao membro operacional existente, não a si.
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque, v_ler,
    'Leitura comum para recepção', v_chave_colaborativa
  );
  if (v_resultado#>>'{data,versao}')::integer is distinct from v_versao_estoque + 1 then
    raise exception 'r140e1a_concessao_colaborativa_recepcao_falhou: %', v_resultado;
  end if;
  v_versao_estoque := v_versao_estoque + 1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_recepcao::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_recepcao::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'ok' is distinct from 'true'
    or ((v_resultado#>'{data}') ? 'dentistaId') is not true
    or v_resultado#>>'{data,dentistaId}' is not null
    or v_resultado#>'{data,permissoesPessoais}' is distinct from '[]'::jsonb
    or v_resultado#>'{data,permissoesCompartilhadas}' is distinct from '["estoque.ler"]'::jsonb
    or (v_resultado#>>'{data,podeGerenciarCompartilhado}')::boolean is not false then
    raise exception 'r140e1a_recepcao_colaborativa_invalida: %', v_resultado;
  end if;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque, v_ler_gerir,
    'Autoelevação da recepção', gen_random_uuid()
  );
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then
    raise exception 'r140e1a_recepcao_se_auto_elevou: %', v_resultado;
  end if;

  -- Gerida: só o responsável explícito obtém as seis no comum e delega ações independentes.
  update public.clinica_governanca set modelo_estoque = 'gerida' where clinica_id = v_clinica_a;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_a::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_a::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'ok' is distinct from 'true'
    or (v_resultado#>'{data,permissoesCompartilhadas}' @> v_seis) is not true
    or (v_resultado#>>'{data,podeGerenciarCompartilhado}')::boolean is not true then
    raise exception 'r140e1a_owner_gerida_invalido: %', v_resultado;
  end if;

  -- Coleção sem leitura, escopo não-clínica e campo injetado falham antes da escrita.
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque,
    '[{"permissao":"estoque.gerir","escopo":{"tipo":"clinica"}}]'::jsonb,
    'Sem leitura', gen_random_uuid()
  );
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then
    raise exception 'r140e1a_dependencia_leitura_aceita: %', v_resultado;
  end if;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque,
    '[{"permissao":"estoque.ler","escopo":{"tipo":"proprio"}}]'::jsonb,
    'Escopo próprio indevido', gen_random_uuid()
  );
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then
    raise exception 'r140e1a_escopo_injetado_aceito: %', v_resultado;
  end if;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque,
    '[{"permissao":"estoque.ler","escopo":{"tipo":"clinica"},"atorId":"00000000-0000-4000-8000-000000000000"}]'::jsonb,
    'Campo injetado', gen_random_uuid()
  );
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then
    raise exception 'r140e1a_payload_injetado_aceito: %', v_resultado;
  end if;

  -- CAS, replay e conflito usam somente versao_estoque/auditoria de origem estoque.
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque, v_ler_receber,
    'Recebimento para recepção', v_chave_gerida
  );
  if (v_resultado#>>'{data,versao}')::integer is distinct from v_versao_estoque + 1 then
    raise exception 'r140e1a_concessao_gerida_falhou: %', v_resultado;
  end if;
  v_versao_estoque := v_versao_estoque + 1;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque - 1, v_ler_receber,
    'Recebimento para recepção', v_chave_gerida
  );
  if (v_resultado#>>'{data,versao}')::integer is distinct from v_versao_estoque
    or (select count(*) from public.clinica_acessos_auditoria aa
        where aa.clinica_id = v_clinica_a and aa.ator_usuario_id = v_usuario_a
          and aa.chave_idempotencia = v_chave_gerida and aa.origem = 'estoque') is distinct from 1 then
    raise exception 'r140e1a_replay_nao_foi_idempotente: %', v_resultado;
  end if;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque - 1, v_ler_gerir,
    'Mesmo idempotency key, payload novo', v_chave_gerida
  );
  if v_resultado->>'codigo' is distinct from 'CONFLITO' then
    raise exception 'r140e1a_replay_payload_diferente_aceito: %', v_resultado;
  end if;
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque - 1, v_ler_gerir,
    'Versão antiga', v_chave_conflito
  );
  if v_resultado->>'codigo' is distinct from 'CONFLITO' then
    raise exception 'r140e1a_cas_antigo_aceito: %', v_resultado;
  end if;
  if (select ca.acessos from public.clinica_acessos ca
      where ca.clinica_id = v_clinica_a and ca.membro_id = v_membro_recepcao) is distinct from v_acessos_preparados
    or (select ca.versao from public.clinica_acessos ca
        where ca.clinica_id = v_clinica_a and ca.membro_id = v_membro_recepcao) is distinct from v_versao_geral then
    raise exception 'r140e1a_configuracao_preparada_foi_alterada';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_recepcao::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_recepcao::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado#>'{data,permissoesCompartilhadas}' is distinct from '["estoque.ler","estoque.receber"]'::jsonb
    or v_resultado#>'{data,permissoesPessoais}' is distinct from '[]'::jsonb then
    raise exception 'r140e1a_recepcao_gerida_nao_independente: %', v_resultado;
  end if;

  -- Revogação e suspensão são reavaliadas em chamadas seguintes, sem renovar JWT.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_a::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_a::text, true);
  v_resultado := public.configurar_acessos_estoque(
    v_clinica_a, v_membro_recepcao, v_versao_estoque, '[]'::jsonb,
    'Revogação integral', v_chave_revogacao
  );
  if (v_resultado#>>'{data,versao}')::integer is distinct from v_versao_estoque + 1 then
    raise exception 'r140e1a_revogacao_falhou: %', v_resultado;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_recepcao::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_recepcao::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado#>'{data,permissoesCompartilhadas}' is distinct from '[]'::jsonb then
    raise exception 'r140e1a_revogacao_nao_refletiu: %', v_resultado;
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario_b::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario_b::text, true);
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'ok' is distinct from 'true'
    or (v_resultado#>'{data,permissoesPessoais}' @> v_seis) is not true
    or v_resultado#>'{data,permissoesCompartilhadas}' is distinct from '[]'::jsonb then
    raise exception 'r140e1a_dentista_gerida_invalido: %', v_resultado;
  end if;
  update public.clinica_usuarios set status = 'suspenso' where id = v_membro_b;
  v_resultado := public.obter_contexto_estoque(v_clinica_a);
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then
    raise exception 'r140e1a_suspensao_nao_negou: %', v_resultado;
  end if;

  raise notice 'R-140e1a autorização: 22 gates SQL passaram; rollback obrigatório a seguir.';
end;
$$;

select 22::integer as gates_passaram;

rollback;
