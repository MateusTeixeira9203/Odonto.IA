-- R-140e1b: prova o constraint trigger diferido sob o papel real da API.
-- Executar após R-140e1, R-140e1a, R-140e1b e a corretiva de trigger. Não persiste fixtures.
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_clinica uuid := gen_random_uuid();
  v_dentista uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_membro uuid;
  v_ator uuid := '65875816-02d9-4b21-bf9c-29626de20a31';
begin
  if not exists (select 1 from public.users where id = v_ator and email like 'qa%@odontoia.example') then
    raise exception 'r140e1b_fixture_qa_invalida';
  end if;

  insert into public.clinicas(id,nome) values(v_clinica,'__R140E1B_TRIGGER_DESCARTAVEL__');
  insert into public.clinica_usuarios(usuario_id,clinica_id,role,status)
    values(v_ator,v_clinica,'admin','ativo') returning id into v_membro;
  insert into public.dentistas(id,clinica_id,user_id,nome,role,ativo)
    values(v_dentista,v_clinica,v_ator,'__R140E1B_TRIGGER_A__','admin',true);
  insert into public.clinica_governanca(clinica_id,responsavel_usuario_id,modelo_estoque,estoque_ativo)
    values(v_clinica,v_ator,'gerida',true);
  insert into public.estoque_itens(
    id,clinica_id,titular_tipo,titular_dentista_id,nome,unidade_base,comportamento,controle_lote,minimo
  ) values(v_item,v_clinica,'clinica',null,'__R140E1B_TRIGGER_ITEM__','unidade','consumivel',true,0);
  update public.users set active_clinica_id=v_clinica where id=v_ator;

  perform set_config('r140e1b.trigger_clinica',v_clinica::text,true);
  perform set_config('r140e1b.trigger_item',v_item::text,true);
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"65875816-02d9-4b21-bf9c-29626de20a31","role":"authenticated"}';

do $$
declare
  v_resultado jsonb;
  v_clinica uuid := current_setting('r140e1b.trigger_clinica')::uuid;
  v_item uuid := current_setting('r140e1b.trigger_item')::uuid;
  v_lote uuid;
  v_lote_vencido uuid;
  v_consumo uuid;
  v_entrada_vencida uuid;
  v_versao integer;
begin
  v_resultado := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000001',
    'itemId',v_item::text,
    'versaoEsperada',1,
    'quantidadeBase','100',
    'novoLote',jsonb_build_object('codigoFabricante','__R140E1B_TRIGGER_LOTE__','validadeISO','2099-12-31')
  ));
  if v_resultado->>'ok' is distinct from 'true' then
    raise exception 'r140e1b_recebimento_authenticated_falhou:%',v_resultado;
  end if;
  v_lote := (v_resultado#>>'{data,loteId}')::uuid;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('consumir',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000002',
    'itemId',v_item::text,
    'loteId',v_lote::text,
    'versaoEsperada',v_versao,
    'quantidade','2',
    'motivo','Consumo autenticado QA'
  ));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '98' then
    raise exception 'r140e1b_consumo_authenticated_falhou:%',v_resultado;
  end if;
  v_consumo := (v_resultado#>>'{data,movimentoId}')::uuid;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('descartar',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000003',
    'itemId',v_item::text,
    'loteId',v_lote::text,
    'versaoEsperada',v_versao,
    'quantidade','3',
    'motivo','Descarte autenticado QA'
  ));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '95' then
    raise exception 'r140e1b_descarte_authenticated_falhou:%',v_resultado;
  end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('corrigir',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000004',
    'itemId',v_item::text,
    'movimentoId',v_consumo::text,
    'versaoEsperada',v_versao,
    'motivo','Correção autenticada QA',
    'substituicao',jsonb_build_object('tipo','consumo','quantidade','4')
  ));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '93' then
    raise exception 'r140e1b_correcao_authenticated_falhou:%',v_resultado;
  end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('ajustar',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000005',
    'itemId',v_item::text,
    'loteId',v_lote::text,
    'versaoEsperada',v_versao,
    'quantidadeContada','93',
    'motivo','Contagem autenticada QA'
  ));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,movimentoId}' is not null
    or v_resultado#>>'{data,saldo}' is distinct from '93' then
    raise exception 'r140e1b_contagem_authenticated_falhou:%',v_resultado;
  end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000006',
    'itemId',v_item::text,
    'versaoEsperada',v_versao,
    'quantidadeBase','1',
    'novoLote',jsonb_build_object('codigoFabricante','__R140E1B_TRIGGER_VENCIDO__','validadeISO','2000-01-01'),
    'aceitarVencido',true,
    'motivoVencido','Registro vencido autenticado QA'
  ));
  if v_resultado->>'ok' is distinct from 'true' then
    raise exception 'r140e1b_entrada_vencida_authenticated_falhou:%',v_resultado;
  end if;
  v_lote_vencido := (v_resultado#>>'{data,loteId}')::uuid;
  v_entrada_vencida := (v_resultado#>>'{data,movimentoId}')::uuid;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('consumir',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000007',
    'itemId',v_item::text,
    'loteId',v_lote_vencido::text,
    'versaoEsperada',v_versao,
    'quantidade','1',
    'motivo','Consumo vencido autenticado QA'
  ));
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then
    raise exception 'r140e1b_consumo_vencido_nao_invalido:%',v_resultado;
  end if;
  v_resultado := public.operar_estoque('corrigir',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,
    'chaveIdempotencia','40000000-0000-4000-8000-000000000008',
    'itemId',v_item::text,
    'movimentoId',v_entrada_vencida::text,
    'versaoEsperada',v_versao,
    'motivo','Correção vencida autenticada QA',
    'substituicao',jsonb_build_object('tipo','consumo','quantidade','1')
  ));
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then
    raise exception 'r140e1b_correcao_consumo_vencido_nao_invalida:%',v_resultado;
  end if;
end;
$$;

-- Força o trigger DEFERRABLE dentro desta sessão authenticated; antes da corretiva isso falha com 42501.
set constraints estoque_saldo_final_nao_negativo immediate;
rollback;
