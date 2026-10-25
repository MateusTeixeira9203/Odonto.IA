-- R-140e2 / sublote 4B: correção por revisão e compensação, sem editar fatos confirmados.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.estoque_usos
  add column substituido_por_id uuid,
  add constraint estoque_usos_substituido_por_fkey foreign key (clinica_id, substituido_por_id)
    references public.estoque_usos(clinica_id, id) on delete restrict;

create or replace function private.estoque_validar_uso()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if tg_op='DELETE' then raise exception 'ESTOQUE_HISTORICO_PRESERVADO' using errcode='23514'; end if;
  if new.id<>old.id or new.clinica_id<>old.clinica_id or new.atendimento_id<>old.atendimento_id
    or new.linha_origem_id<>old.linha_origem_id or new.revisao<>old.revisao
    or new.autor_usuario_id<>old.autor_usuario_id or new.snapshot_material<>old.snapshot_material
    or new.quantidade_declarada<>old.quantidade_declarada or new.unidade_declarada<>old.unidade_declarada
    or new.item_id<>old.item_id or new.lote_id<>old.lote_id or new.kit_versao_id is distinct from old.kit_versao_id
    or new.created_at<>old.created_at then raise exception 'ESTOQUE_USO_IMUTAVEL' using errcode='23514'; end if;
  if old.estado_operacional='pendente_autorizacao'
    and new.estado_operacional in ('confirmado','confirmado_divergente')
    and new.movimento_id is not null and new.operacao_id is not null and new.substituido_por_id is null then return new; end if;
  if old.estado_operacional in ('confirmado','confirmado_divergente')
    and new.estado_operacional='substituido' and new.substituido_por_id is not null then return new; end if;
  raise exception 'ESTOQUE_TRANSICAO_USO_INVALIDA' using errcode='23514';
end; $$;

create function private.corrigir_uso_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_ator uuid:=auth.uid(); v_clinica uuid; v_contexto jsonb; v_atendimento public.atendimentos_clinicos%rowtype;
  v_chave uuid; v_hash text; v_replay public.estoque_operacoes%rowtype; v_operacao uuid:=gen_random_uuid();
  v_anterior public.estoque_usos%rowtype; v_item_anterior public.estoque_itens%rowtype; v_item_novo public.estoque_itens%rowtype; v_lote_novo public.estoque_lotes%rowtype;
  v_uso_novo uuid:=gen_random_uuid(); v_reversao uuid:=gen_random_uuid(); v_movimento uuid:=gen_random_uuid();
  v_linha jsonb; v_kit uuid; v_quantidade numeric; v_versao integer; v_saldo_novo numeric; v_divergente boolean; v_resultado jsonb;
begin
  if v_ator is null or jsonb_typeof(p_entrada)<>'object' or not private.estoque_chaves_exatas(p_entrada,array['clinicaIdEsperada','atendimentoId','usoId','revisaoEsperada','chaveIdempotencia','substituicao','aceitarDivergencia']) then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Correção de material inválida.'); end if;
  v_clinica:=private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave:=private.estoque_uuid(p_entrada->>'chaveIdempotencia'); v_linha:=p_entrada->'substituicao';
  if v_clinica is null or v_chave is null or private.estoque_uuid(p_entrada->>'atendimentoId') is null
    or private.estoque_uuid(p_entrada->>'usoId') is null or private.estoque_versao(p_entrada->'revisaoEsperada') is null
    or jsonb_typeof(v_linha)<>'object' or not private.estoque_chaves_exatas(v_linha,array['itemId','loteId','quantidade','kitVersaoId','versaoItemEsperada'])
    or private.estoque_uuid(v_linha->>'itemId') is null or private.estoque_uuid(v_linha->>'loteId') is null
    or private.estoque_decimal_json(v_linha->'quantidade',true) is null or private.estoque_versao(v_linha->'versaoItemEsperada') is null
    or jsonb_typeof(v_linha->'kitVersaoId') not in ('string','null') or jsonb_typeof(p_entrada->'aceitarDivergencia')<>'boolean' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Correção de material inválida.'); end if;
  v_contexto:=private.estoque_contexto_travado(v_clinica); if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
  if not found or v_atendimento.dentista_id is distinct from private.estoque_uuid(v_contexto#>>'{data,dentistaId}') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Atendimento indisponível.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text||':'||v_ator::text||':'||v_chave::text,0)); v_hash:=private.estoque_hash('corrigir_uso',p_entrada);
  select * into v_replay from public.estoque_operacoes where clinica_id=v_clinica and ator_usuario_id=v_ator and chave_idempotencia=v_chave;
  if found then if v_replay.payload_hash is distinct from v_hash then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra operação.'); end if; return v_replay.resultado; end if;
  select * into v_anterior from public.estoque_usos where clinica_id=v_clinica and atendimento_id=v_atendimento.id and id=private.estoque_uuid(p_entrada->>'usoId') for update;
  if not found or v_anterior.autor_usuario_id is distinct from v_ator then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Uso indisponível para correção.'); end if;
  if v_anterior.estado_operacional not in ('confirmado','confirmado_divergente') or v_anterior.revisao is distinct from private.estoque_versao(p_entrada->'revisaoEsperada') then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O uso mudou. Atualize antes de corrigir.'); end if;
  select * into v_item_anterior from public.estoque_itens where clinica_id=v_clinica and id=v_anterior.item_id for update;
  if not found or not private.estoque_tem_acao(v_contexto,v_item_anterior.titular_tipo,v_item_anterior.titular_dentista_id,'estoque.consumir') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material original.'); end if;
  select * into v_item_novo from public.estoque_itens where clinica_id=v_clinica and id=private.estoque_uuid(v_linha->>'itemId') for update;
  select * into v_lote_novo from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item_novo.id and id=private.estoque_uuid(v_linha->>'loteId') for update;
  if not found or v_item_novo.id is null or not v_item_novo.ativo then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
  if v_item_novo.versao is distinct from private.estoque_versao(v_linha->'versaoItemEsperada') then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O estoque mudou. Atualize antes de corrigir.'); end if;
  if not private.estoque_tem_acao(v_contexto,v_item_novo.titular_tipo,v_item_novo.titular_dentista_id,'estoque.consumir') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material substituto.'); end if;
  v_kit:=case when v_linha->'kitVersaoId'='null'::jsonb then null else private.estoque_uuid(v_linha->>'kitVersaoId') end;
  if v_kit is not null and not exists(select 1 from public.estoque_kit_componentes c where c.clinica_id=v_clinica and c.kit_versao_id=v_kit and c.item_id=v_item_novo.id) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Componente do kit inválido.'); end if;
  v_quantidade:=private.estoque_decimal_json(v_linha->'quantidade',true);
  select coalesce(sum(m.quantidade),0) + case when v_anterior.item_id=v_item_novo.id and v_anterior.lote_id=v_lote_novo.id then v_anterior.quantidade_declarada else 0 end - v_quantidade into v_saldo_novo from public.estoque_movimentos m where m.clinica_id=v_clinica and m.item_id=v_item_novo.id and m.lote_id=v_lote_novo.id;
  v_divergente:=v_saldo_novo<0; if v_divergente and p_entrada->'aceitarDivergencia'<>'true'::jsonb then return jsonb_build_object('ok',false,'codigo','SALDO_INSUFICIENTE','mensagem','Confirme explicitamente a divergência desta correção.'); end if;
  v_resultado:=jsonb_build_object('ok',true,'data',jsonb_build_object('usoId',v_uso_novo::text,'revisao',v_anterior.revisao+1,'movimentoId',v_movimento::text,'reversaoId',v_reversao::text,'estado',case when v_divergente then 'confirmado_divergente' else 'confirmado' end));
  insert into public.estoque_operacoes values(v_operacao,v_clinica,v_ator,v_chave,v_hash,v_resultado,now());
  insert into public.estoque_usos(id,clinica_id,atendimento_id,linha_origem_id,revisao,autor_usuario_id,snapshot_material,quantidade_declarada,unidade_declarada,item_id,lote_id,kit_versao_id) values(v_uso_novo,v_clinica,v_atendimento.id,v_anterior.linha_origem_id,v_anterior.revisao+1,v_ator,v_item_novo.nome,v_quantidade,v_item_novo.unidade_base,v_item_novo.id,v_lote_novo.id,v_kit);
  insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,origem_id,operacao_id,reversao_de,ator_usuario_id) values(v_reversao,v_clinica,v_anterior.item_id,v_anterior.lote_id,'reversao',-((select quantidade from public.estoque_movimentos where clinica_id=v_clinica and id=v_anterior.movimento_id)),'Correção de uso na ficha.','correcao',v_anterior.id,v_operacao,v_anterior.movimento_id,v_ator);
  insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,origem_id,operacao_id,ator_usuario_id) values(v_movimento,v_clinica,v_item_novo.id,v_lote_novo.id,'consumo',-v_quantidade,'Correção de uso na ficha.','uso_atendimento',v_uso_novo,v_operacao,v_ator);
  update public.estoque_usos set estado_operacional='substituido',substituido_por_id=v_uso_novo where clinica_id=v_clinica and id=v_anterior.id;
  update public.estoque_usos set movimento_id=v_movimento,operacao_id=v_operacao,estado_operacional=case when v_divergente then 'confirmado_divergente' else 'confirmado' end where clinica_id=v_clinica and id=v_uso_novo;
  update public.estoque_itens set versao=versao+1 where clinica_id=v_clinica and id in (v_anterior.item_id,v_item_novo.id);
  insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,antes,depois,motivo,operacao_id) values(v_clinica,v_ator,'corrigir_uso',v_anterior.item_id,jsonb_build_object('usoId',v_anterior.id::text,'movimentoId',v_anterior.movimento_id::text),jsonb_build_object('reversaoId',v_reversao::text,'novoUsoId',v_uso_novo::text,'movimentoId',v_movimento::text),'Correção de uso na ficha.',v_operacao);
  return v_resultado;
exception when lock_not_available or query_canceled then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Materiais indisponíveis. Tente novamente.');
when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível corrigir o uso.'); end;
$$;

create function public.corrigir_uso_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.corrigir_uso_estoque(p_entrada); $$;
revoke all on function private.corrigir_uso_estoque(jsonb),public.corrigir_uso_estoque(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.corrigir_uso_estoque(jsonb),public.corrigir_uso_estoque(jsonb) to authenticated;
