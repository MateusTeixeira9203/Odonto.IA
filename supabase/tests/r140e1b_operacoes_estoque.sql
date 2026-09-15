-- R-140e1b — roteiro transacional de operações e leitura; não persiste fixtures.
-- Executar depois de R-140e1, R-140e1a e R-140e1b em conexão administrativa de teste.
begin;

do $$
declare
  v_clinica uuid := gen_random_uuid();
  v_a uuid := '65875816-02d9-4b21-bf9c-29626de20a31';
  v_b uuid := 'e5f2bc67-bd38-40f8-ba3f-0a4400251281';
  v_recepcao uuid := '06ed58fe-aec6-4eec-ad3d-b55102f02f12';
  v_da uuid := gen_random_uuid(); v_db uuid := gen_random_uuid();
  v_ma uuid; v_mb uuid; v_mr uuid; v_item uuid; v_lote uuid; v_entrada uuid; v_consumo uuid;
  v_resultado jsonb; v_replay jsonb; v_cursor jsonb; v_versao integer; v_saldo text;
  v_email_a text; v_email_b text; v_email_r text;
  v_acessos jsonb := '[{"permissao":"estoque.ler","escopo":{"tipo":"clinica"}},{"permissao":"estoque.gerir","escopo":{"tipo":"clinica"}},{"permissao":"estoque.receber","escopo":{"tipo":"clinica"}},{"permissao":"estoque.consumir","escopo":{"tipo":"clinica"}},{"permissao":"estoque.descartar","escopo":{"tipo":"clinica"}},{"permissao":"estoque.ajustar","escopo":{"tipo":"clinica"}}]'::jsonb;
begin
  if private.estoque_decimal_text(100::numeric) is distinct from '100'
    or private.estoque_decimal_text(10::numeric) is distinct from '10'
    or private.estoque_decimal_text(100.5::numeric) is distinct from '100.5' then
    raise exception 'r140e1b_decimal_text_invalido';
  end if;
  select email into v_email_a from public.users where id=v_a;
  select email into v_email_b from public.users where id=v_b;
  select email into v_email_r from public.users where id=v_recepcao;
  if v_email_a is null or v_email_b is null or v_email_r is null
    or v_email_a not like 'qa%@odontoia.example' or v_email_b not like 'qa%@odontoia.example'
    or v_email_r is distinct from 'qa-r164-recepcao@odontoia.example' then
    raise exception 'r140e1b_fixture_qa_invalida';
  end if;
  insert into public.clinicas(id,nome) values(v_clinica,'__R140E1B_DESCARTAVEL__');
  insert into public.clinica_usuarios(usuario_id,clinica_id,role,status) values(v_a,v_clinica,'admin','ativo') returning id into v_ma;
  insert into public.clinica_usuarios(usuario_id,clinica_id,role,status) values(v_b,v_clinica,'dentista','ativo') returning id into v_mb;
  insert into public.clinica_usuarios(usuario_id,clinica_id,role,status) values(v_recepcao,v_clinica,'secretaria','ativo') returning id into v_mr;
  insert into public.dentistas(id,clinica_id,user_id,nome,role,ativo) values
    (v_da,v_clinica,v_a,'__R140E1B_A__','admin',true),(v_db,v_clinica,v_b,'__R140E1B_B__','dentista',true);
  insert into public.clinica_acessos(clinica_id,membro_id,acessos,acessos_estoque_ativos) values(v_clinica,v_mr,'[]'::jsonb,v_acessos);
  update public.users set active_clinica_id=v_clinica where id in(v_a,v_b,v_recepcao);
  insert into public.clinica_governanca(clinica_id,responsavel_usuario_id,modelo_estoque,estoque_ativo)
    values(v_clinica,v_a,'gerida',true);

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a::text,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  v_resultado := public.operar_estoque('cadastrar',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000001',
    'titular',jsonb_build_object('tipo','clinica'),'nome','__R140E1B_GAZE__','unidadeBase','unidade',
    'comportamento','consumivel','controlaLote',true,'minimo','10'
  ));
  if v_resultado->>'ok' is distinct from 'true' then raise exception 'r140e1b_cadastro_falhou:%',v_resultado; end if;
  v_item := (v_resultado#>>'{data,itemId}')::uuid; v_versao := (v_resultado#>>'{data,versao}')::integer;

  v_resultado := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000002','itemId',v_item::text,'versaoEsperada',v_versao,
    'quantidadeBase','100','novoLote',jsonb_build_object('codigoFabricante','__R140E1B_LOTE__','validadeISO','2099-12-31'),
    'embalagemConferida',jsonb_build_object('quantidadeEmbalagens','1','quantidadePorEmbalagem','100','unidadeBase','unidade')
  ));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '100' then raise exception 'r140e1b_entrada_100_falhou:%',v_resultado; end if;
  v_lote := (v_resultado#>>'{data,loteId}')::uuid; v_entrada := (v_resultado#>>'{data,movimentoId}')::uuid; v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_replay := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000002','itemId',v_item::text,'versaoEsperada',v_versao-1,
    'quantidadeBase','100','novoLote',jsonb_build_object('codigoFabricante','__R140E1B_LOTE__','validadeISO','2099-12-31'),
    'embalagemConferida',jsonb_build_object('quantidadeEmbalagens','1','quantidadePorEmbalagem','100','unidadeBase','unidade')
  ));
  if v_replay is distinct from v_resultado then raise exception 'r140e1b_replay_nao_idempotente:%',v_replay; end if;
  v_replay := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000002','itemId',v_item::text,'versaoEsperada',v_versao,
    'quantidadeBase','99','loteId',v_lote::text
  ));
  if v_replay->>'codigo' is distinct from 'CONFLITO' then raise exception 'r140e1b_chave_payload_diferente:%',v_replay; end if;

  v_resultado := public.operar_estoque('consumir',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000003','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',v_versao,'quantidade','2','motivo','Uso manual QA'));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '98' then raise exception 'r140e1b_consumo_2_falhou:%',v_resultado; end if;
  v_consumo := (v_resultado#>>'{data,movimentoId}')::uuid; v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('ajustar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000004','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',v_versao,'quantidadeContada','98','motivo','Contagem igual QA'));
  if v_resultado#>>'{data,movimentoId}' is not null or v_resultado#>>'{data,saldo}' is distinct from '98' then raise exception 'r140e1b_contagem_igual_invalida:%',v_resultado; end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('descartar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000005','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',v_versao,'quantidade','3','motivo','Descarte QA'));
  if v_resultado#>>'{data,saldo}' is distinct from '95' then raise exception 'r140e1b_descarte_falhou:%',v_resultado; end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;

  v_resultado := public.operar_estoque('corrigir',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000006','itemId',v_item::text,'movimentoId',v_consumo::text,'versaoEsperada',v_versao,'motivo','Consumo corrigido QA','substituicao',jsonb_build_object('tipo','consumo','quantidade','4')));
  if v_resultado->>'ok' is distinct from 'true' or v_resultado#>>'{data,saldo}' is distinct from '93' or v_resultado#>>'{data,reversaoId}' is null then raise exception 'r140e1b_correcao_falhou:%',v_resultado; end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;

  v_resultado := public.operar_estoque('editar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000007','itemId',v_item::text,'versaoEsperada',v_versao,'nome','__R140E1B_GAZE_EDITADA__','minimo','10','ativo',false,'motivo','Arquivar com saldo'));
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then raise exception 'r140e1b_arquivou_com_saldo:%',v_resultado; end if;

  v_resultado := public.operar_estoque('receber',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000008','itemId',v_item::text,'versaoEsperada',v_versao,'quantidadeBase','1','novoLote',jsonb_build_object('codigoFabricante','__R140E1B_VENCIDO__','validadeISO','2000-01-01')));
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then raise exception 'r140e1b_recebeu_vencido_sem_confirmar:%',v_resultado; end if;
  v_resultado := public.operar_estoque('receber',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000009','itemId',v_item::text,'versaoEsperada',v_versao,'quantidadeBase','1','novoLote',jsonb_build_object('codigoFabricante','__R140E1B_VENCIDO__','validadeISO','2000-01-01'),'aceitarVencido',true,'motivoVencido','Registro histórico QA'));
  if v_resultado->>'ok' is distinct from 'true' then raise exception 'r140e1b_recebimento_vencido_declarado:%',v_resultado; end if;
  v_versao := (v_resultado#>>'{data,versao}')::integer;
  v_resultado := public.operar_estoque('receber',jsonb_build_object(
    'clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','10000000-0000-4000-8000-000000000010',
    'itemId',v_item::text,'versaoEsperada',v_versao,'quantidadeBase','1',
    'novoLote',jsonb_build_object('codigoFabricante','__R140E1B_PAR__','validadeISO','2099-12-31'),
    'aceitarVencido',false,'motivoVencido','Declaração parcial QA'
  ));
  if v_resultado->>'codigo' is distinct from 'INVALIDO' then raise exception 'r140e1b_declaracao_vencimento_parcial:%',v_resultado; end if;

  v_resultado := public.consultar_estoque('listar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'titular',jsonb_build_object('tipo','clinica'),'busca','GAZE','filtro','todos','limite',1));
  if v_resultado->>'ok' is distinct from 'true' or (v_resultado#>'{data,itens}' @> jsonb_build_array(jsonb_build_object('id',v_item::text))) is not true then raise exception 'r140e1b_listagem_invalida:%',v_resultado; end if;
  v_resultado := public.consultar_estoque('detalhar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'itemId',v_item::text,'limite',1));
  if v_resultado->>'ok' is distinct from 'true' or (v_resultado#>'{data,lotes}' @> jsonb_build_array(jsonb_build_object('id',v_lote::text))) is not true or jsonb_array_length(v_resultado#>'{data,movimentos}') is distinct from 1 then raise exception 'r140e1b_detalhe_paginado_invalido:%',v_resultado; end if;
  v_cursor := v_resultado#>'{data,proximoCursor}';
  if v_cursor is null then raise exception 'r140e1b_cursor_movimento_ausente'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b::text,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',v_b::text,true);
  v_resultado := public.operar_estoque('cadastrar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','20000000-0000-4000-8000-000000000001','titular',jsonb_build_object('tipo','dentista','dentistaId',v_db::text),'nome','__R140E1B_PRIVADO_B__','unidadeBase','unidade','comportamento','consumivel','controlaLote',false,'minimo','0'));
  if v_resultado->>'ok' is distinct from 'true' then raise exception 'r140e1b_privado_b_falhou:%',v_resultado; end if;
  v_resultado := public.consultar_estoque('detalhar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'itemId',v_item::text));
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then raise exception 'r140e1b_b_leu_compartilhado_sem_grant:%',v_resultado; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_recepcao::text,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',v_recepcao::text,true);
  v_resultado := public.operar_estoque('consumir',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','30000000-0000-4000-8000-000000000001','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',v_versao,'quantidade','1','motivo','Recepção QA'));
  if v_resultado->>'ok' is distinct from 'true' then raise exception 'r140e1b_recepcao_grant_independente:%',v_resultado; end if;
  update public.clinica_acessos set acessos_estoque_ativos='[]'::jsonb where clinica_id=v_clinica and membro_id=v_mr;
  v_resultado := public.operar_estoque('consumir',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','30000000-0000-4000-8000-000000000001','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',v_versao,'quantidade','1','motivo','Recepção QA'));
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then raise exception 'r140e1b_replay_revogado_nao_negou:%',v_resultado; end if;
  v_resultado := public.operar_estoque('consumir',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'chaveIdempotencia','30000000-0000-4000-8000-000000000002','itemId',v_item::text,'loteId',v_lote::text,'versaoEsperada',(v_versao+1),'quantidade','1','motivo','Revogado QA'));
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then raise exception 'r140e1b_revogacao_nao_revalidada:%',v_resultado; end if;
  update public.clinica_usuarios set status='suspenso' where id=v_mb;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b::text,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',v_b::text,true);
  v_resultado := public.consultar_estoque('listar',jsonb_build_object('clinicaIdEsperada',v_clinica::text,'titular',jsonb_build_object('tipo','dentista','dentistaId',v_db::text)));
  if v_resultado->>'codigo' is distinct from 'SEM_ACESSO' then raise exception 'r140e1b_suspensao_nao_revalidada:%',v_resultado; end if;
  if (select count(*) from public.estoque_auditoria where clinica_id=v_clinica) < 6 then raise exception 'r140e1b_auditoria_incompleta'; end if;
  raise notice 'R-140e1b operações: 23 gates SQL passaram; rollback obrigatório a seguir.';
end;
$$;

select 23::integer as gates_passaram;
rollback;
