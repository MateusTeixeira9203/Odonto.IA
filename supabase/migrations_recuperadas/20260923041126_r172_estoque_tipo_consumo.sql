-- R-140e1b: ações da RPC persistem os tipos físicos canônicos e vencidos não são tentativas incertas.
create or replace function private.operar_estoque(p_acao text, p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  v_ator uuid := auth.uid(); v_clinica uuid; v_contexto jsonb; v_titular jsonb;
  v_item public.estoque_itens%rowtype; v_lote public.estoque_lotes%rowtype;
  v_original public.estoque_movimentos%rowtype; v_replay public.estoque_operacoes%rowtype;
  v_item_id uuid; v_lote_id uuid; v_movimento_id uuid := gen_random_uuid(); v_reversao_id uuid := gen_random_uuid();
  v_original_id uuid;
  v_operacao_id uuid := gen_random_uuid(); v_chave uuid; v_hash text; v_resultado jsonb;
  v_versao integer; v_quantidade numeric; v_delta numeric; v_saldo_lote numeric; v_saldo_item numeric;
  v_nome text; v_minimo numeric; v_motivo text; v_tipo text; v_substituicao jsonb; v_antes jsonb;
  v_validade date; v_codigo text; v_aceitar_vencido boolean; v_motivo_vencido text;
  v_acao_exigida text; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform set_config('lock_timeout','1500ms',true);
  perform set_config('statement_timeout','15s',true);
  if v_ator is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sessão obrigatória.'); end if;
  if p_acao not in ('cadastrar','editar','receber','consumir','descartar','ajustar','corrigir')
    or jsonb_typeof(p_entrada) <> 'object' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Operação de estoque inválida.');
  end if;
  if not private.estoque_chaves_exatas(p_entrada, case p_acao
    when 'cadastrar' then array['clinicaIdEsperada','chaveIdempotencia','titular','nome','unidadeBase','comportamento','controlaLote','minimo']
    when 'editar' then array['clinicaIdEsperada','chaveIdempotencia','itemId','versaoEsperada','nome','minimo','ativo','motivo']
    when 'receber' then array['clinicaIdEsperada','chaveIdempotencia','itemId','versaoEsperada','quantidadeBase','embalagemConferida','loteId','novoLote','aceitarVencido','motivoVencido']
    when 'consumir' then array['clinicaIdEsperada','chaveIdempotencia','itemId','loteId','versaoEsperada','quantidade','motivo']
    when 'descartar' then array['clinicaIdEsperada','chaveIdempotencia','itemId','loteId','versaoEsperada','quantidade','motivo']
    when 'ajustar' then array['clinicaIdEsperada','chaveIdempotencia','itemId','loteId','versaoEsperada','quantidadeContada','motivo']
    else array['clinicaIdEsperada','chaveIdempotencia','itemId','movimentoId','versaoEsperada','motivo','substituicao','aceitarVencido','motivoVencido'] end) then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Campos da operação inválidos.');
  end if;
  v_clinica := private.estoque_uuid(p_entrada->>'clinicaIdEsperada');
  v_chave := private.estoque_uuid(p_entrada->>'chaveIdempotencia');
  if v_clinica is null or v_chave is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Contexto da operação inválido.'); end if;
  v_contexto := private.estoque_contexto_travado(v_clinica);
  if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  if p_acao in ('receber','corrigir') and (
    ((p_entrada ? 'aceitarVencido') <> (p_entrada ? 'motivoVencido'))
    or ((p_entrada ? 'aceitarVencido') and p_entrada->'aceitarVencido' <> 'true'::jsonb)
    or ((p_entrada ? 'motivoVencido') and (jsonb_typeof(p_entrada->'motivoVencido') <> 'string'
      or char_length(btrim(p_entrada->>'motivoVencido')) not between 1 and 500))
  ) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Declaração de vencimento inválida.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text || ':' || v_ator::text || ':' || v_chave::text, 0));
  v_hash := private.estoque_hash(p_acao,p_entrada);
  select * into v_replay from public.estoque_operacoes
    where clinica_id=v_clinica and ator_usuario_id=v_ator and chave_idempotencia=v_chave;
  if found then
    if v_replay.payload_hash is distinct from v_hash then
      return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Chave já usada em outra operação.');
    end if;
  end if;

  if p_acao = 'cadastrar' then
    v_titular := private.estoque_titular(p_entrada->'titular');
    v_nome := btrim(coalesce(p_entrada->>'nome',''));
    v_minimo := private.estoque_decimal_json(p_entrada->'minimo');
    if v_titular is null or char_length(v_nome) not between 1 and 120 or v_minimo is null
      or p_entrada->>'unidadeBase' not in ('unidade','g','ml') or p_entrada->>'comportamento' <> 'consumivel'
      or jsonb_typeof(p_entrada->'controlaLote') <> 'boolean' then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados do material inválidos.');
    end if;
    if (v_titular->>'tipo'='dentista' and private.estoque_uuid(v_titular->>'dentistaId') is null)
      or not private.estoque_tem_acao(v_contexto,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'),'estoque.gerir') then
      return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao titular do material.');
    end if;
    if v_replay.id is not null then return v_replay.resultado; end if;
    v_item_id := gen_random_uuid();
    v_resultado := jsonb_build_object('ok',true,'data',jsonb_build_object('itemId',v_item_id::text,'versao',1));
    insert into public.estoque_operacoes(id,clinica_id,ator_usuario_id,chave_idempotencia,payload_hash,resultado)
      values(v_operacao_id,v_clinica,v_ator,v_chave,v_hash,v_resultado);
    insert into public.estoque_itens(id,clinica_id,titular_tipo,titular_dentista_id,nome,unidade_base,comportamento,controle_lote,minimo)
      values(v_item_id,v_clinica,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'),v_nome,p_entrada->>'unidadeBase','consumivel',(p_entrada->>'controlaLote')::boolean,v_minimo);
    select * into v_item from public.estoque_itens where id=v_item_id and clinica_id=v_clinica;
    insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,depois,operacao_id)
      values(v_clinica,v_ator,'cadastrar',v_item_id,private.estoque_item_resumo(v_item),v_operacao_id);
    return v_resultado;
  end if;

  v_item_id := private.estoque_uuid(p_entrada->>'itemId');
  v_versao := private.estoque_versao(p_entrada->'versaoEsperada');
  if v_item_id is null or v_versao is null or v_versao <= 0 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Referência do material inválida.'); end if;
  select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=v_item_id for update;
  if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
  v_acao_exigida := case p_acao when 'editar' then 'estoque.gerir' when 'receber' then 'estoque.receber'
    when 'consumir' then 'estoque.consumir' when 'descartar' then 'estoque.descartar' else 'estoque.ajustar' end;
  if not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,v_acao_exigida) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material.');
  end if;
  if p_acao <> 'corrigir' and v_replay.id is not null then return v_replay.resultado; end if;
  if p_acao <> 'corrigir' and v_item.versao is distinct from v_versao then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O material mudou. Atualize antes de salvar.'); end if;

  if p_acao = 'editar' then
    v_nome := btrim(coalesce(p_entrada->>'nome','')); v_minimo := private.estoque_decimal_json(p_entrada->'minimo');
    v_motivo := btrim(coalesce(p_entrada->>'motivo',''));
    if char_length(v_nome) not between 1 and 120 or v_minimo is null or char_length(v_motivo) not between 1 and 500
      or jsonb_typeof(p_entrada->'ativo') <> 'boolean' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados da edição inválidos.'); end if;
    if (p_entrada->>'ativo')::boolean is not true and exists (
      select 1 from public.estoque_movimentos m where m.clinica_id=v_clinica and m.item_id=v_item.id
      group by m.lote_id having sum(m.quantidade) <> 0
    ) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Material com saldo não pode ser arquivado.'); end if;
    v_antes := private.estoque_item_resumo(v_item);
    v_resultado := jsonb_build_object('ok',true,'data',jsonb_build_object('itemId',v_item.id::text,'versao',v_item.versao+1));
    insert into public.estoque_operacoes values(v_operacao_id,v_clinica,v_ator,v_chave,v_hash,v_resultado,now());
    update public.estoque_itens set nome=v_nome,minimo=v_minimo,ativo=(p_entrada->>'ativo')::boolean,versao=versao+1
      where clinica_id=v_clinica and id=v_item.id;
    select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=v_item.id;
    insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,antes,depois,motivo,operacao_id)
      values(v_clinica,v_ator,'editar',v_item.id,v_antes,private.estoque_item_resumo(v_item),v_motivo,v_operacao_id);
    return v_resultado;
  end if;

  if not v_item.ativo then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
  if p_acao = 'corrigir' then
    v_original := null; v_original_id := private.estoque_uuid(p_entrada->>'movimentoId'); v_motivo := btrim(coalesce(p_entrada->>'motivo',''));
    v_substituicao := p_entrada->'substituicao';
    if v_original_id is null or char_length(v_motivo) not between 1 and 500 or jsonb_typeof(v_substituicao) <> 'object'
      or not private.estoque_chaves_exatas(v_substituicao,array['tipo','quantidade'])
      or v_substituicao->>'tipo' not in ('entrada','consumo','descarte') then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados da correção inválidos.'); end if;
    v_quantidade := private.estoque_decimal_json(v_substituicao->'quantidade',true);
    if v_quantidade is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Quantidade da correção inválida.'); end if;
    v_acao_exigida := case v_substituicao->>'tipo' when 'entrada' then 'estoque.receber' when 'consumo' then 'estoque.consumir' else 'estoque.descartar' end;
    if not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,v_acao_exigida) then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso à ação substituta.'); end if;
    if v_replay.id is not null then return v_replay.resultado; end if;
    if v_item.versao is distinct from v_versao then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O material mudou. Atualize antes de salvar.'); end if;
    select * into v_original from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_item.id and id=v_original_id for update;
    if not found or v_original.tipo not in ('entrada','consumo','descarte') or v_original.origem_tipo not in ('manual','correcao')
      or exists(select 1 from public.estoque_movimentos m where m.reversao_de=v_original.id) then
      return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Movimento indisponível para correção.');
    end if;
    select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=v_original.lote_id for update;
    select coalesce(sum(quantidade),0) into v_saldo_lote from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_item.id and lote_id=v_lote.id;
    if v_substituicao->>'tipo' = 'consumo' and v_lote.validade < v_hoje then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Lote vencido não pode ser consumido.'); end if;
    if v_substituicao->>'tipo' = 'entrada' and v_lote.validade < v_hoje then
      v_aceitar_vencido := p_entrada->'aceitarVencido' = 'true'::jsonb; v_motivo_vencido := btrim(coalesce(p_entrada->>'motivoVencido',''));
      if v_aceitar_vencido is not true or char_length(v_motivo_vencido) not between 1 and 500 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirme e justifique o recebimento vencido.'); end if;
    end if;
    v_delta := -v_original.quantidade + case when v_substituicao->>'tipo'='entrada' then v_quantidade else -v_quantidade end;
    if v_saldo_lote + v_delta < 0 then return jsonb_build_object('ok',false,'codigo','SALDO_INSUFICIENTE','mensagem','Saldo insuficiente para a correção.'); end if;
    select coalesce(sum(quantidade),0)+v_delta into v_saldo_item from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_item.id;
    v_resultado := jsonb_build_object('ok',true,'data',jsonb_build_object('itemId',v_item.id::text,'loteId',v_lote.id::text,'movimentoId',v_movimento_id::text,'reversaoId',v_reversao_id::text,'saldo',private.estoque_decimal_text(v_saldo_item),'versao',v_item.versao+1));
    insert into public.estoque_operacoes values(v_operacao_id,v_clinica,v_ator,v_chave,v_hash,v_resultado,now());
    insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,operacao_id,reversao_de,ator_usuario_id)
      values(v_reversao_id,v_clinica,v_item.id,v_lote.id,'reversao',-v_original.quantidade,v_motivo,'correcao',v_operacao_id,v_original.id,v_ator);
    insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,origem_id,operacao_id,ator_usuario_id)
      values(v_movimento_id,v_clinica,v_item.id,v_lote.id,v_substituicao->>'tipo',case when v_substituicao->>'tipo'='entrada' then v_quantidade else -v_quantidade end,v_motivo,'correcao',v_original.id,v_operacao_id,v_ator);
    update public.estoque_itens set versao=versao+1 where clinica_id=v_clinica and id=v_item.id;
    insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,antes,depois,motivo,operacao_id)
      values(v_clinica,v_ator,'corrigir',v_item.id,jsonb_build_object('movimentoId',v_original.id::text),jsonb_build_object('reversaoId',v_reversao_id::text,'movimentoId',v_movimento_id::text),v_motivo,v_operacao_id);
    return v_resultado;
  end if;

  v_lote_id := private.estoque_uuid(p_entrada->>'loteId');
  if p_acao = 'receber' and ((p_entrada ? 'loteId') = (p_entrada ? 'novoLote')) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Informe um lote existente ou novo.'); end if;
  if p_acao = 'receber' and (p_entrada ? 'novoLote') then
    if jsonb_typeof(p_entrada->'novoLote') <> 'object' or not private.estoque_chaves_exatas(p_entrada->'novoLote',array['codigoFabricante','validadeISO'])
      or jsonb_typeof(p_entrada->'novoLote'->'codigoFabricante') not in ('string','null') or jsonb_typeof(p_entrada->'novoLote'->'validadeISO') not in ('string','null') then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados do lote inválidos.'); end if;
    v_codigo := nullif(btrim(p_entrada->'novoLote'->>'codigoFabricante'),'');
    if jsonb_typeof(p_entrada->'novoLote'->'codigoFabricante') = 'string' and v_codigo is null then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Código do lote inválido.');
    end if;
    if v_codigo is not null and char_length(v_codigo) not between 1 and 120 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Código do lote inválido.'); end if;
    begin v_validade := (p_entrada->'novoLote'->>'validadeISO')::date; exception when others then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Validade do lote inválida.'); end;
    if p_entrada->'novoLote'->>'validadeISO' is not null and to_char(v_validade,'YYYY-MM-DD') is distinct from p_entrada->'novoLote'->>'validadeISO' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Validade do lote inválida.'); end if;
    if v_item.controle_lote and v_codigo is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Código do fabricante obrigatório.'); end if;
    v_lote_id := gen_random_uuid();
  else
    if v_lote_id is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Lote inválido.'); end if;
    select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=v_lote_id for update;
    if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Lote indisponível.'); end if;
    v_validade := v_lote.validade;
  end if;
  if p_acao = 'receber' then
    v_quantidade := private.estoque_decimal_json(p_entrada->'quantidadeBase',true);
    if v_quantidade is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Quantidade de recebimento inválida.'); end if;
    if p_entrada ? 'embalagemConferida' then
      if jsonb_typeof(p_entrada->'embalagemConferida') <> 'object' or not private.estoque_chaves_exatas(p_entrada->'embalagemConferida',array['quantidadeEmbalagens','quantidadePorEmbalagem','unidadeBase'])
        or p_entrada#>>'{embalagemConferida,unidadeBase}' is distinct from v_item.unidade_base
        or private.estoque_decimal_json(p_entrada#>'{embalagemConferida,quantidadeEmbalagens}',true) * private.estoque_decimal_json(p_entrada#>'{embalagemConferida,quantidadePorEmbalagem}',true) is distinct from v_quantidade then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Conversão de embalagem inválida.'); end if;
    end if;
    if v_validade < v_hoje then
      v_aceitar_vencido := p_entrada->'aceitarVencido' = 'true'::jsonb; v_motivo_vencido := btrim(coalesce(p_entrada->>'motivoVencido',''));
      if v_aceitar_vencido is not true or char_length(v_motivo_vencido) not between 1 and 500 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirme e justifique o recebimento vencido.'); end if;
    end if;
  elsif p_acao = 'ajustar' then
    v_motivo := btrim(coalesce(p_entrada->>'motivo','')); v_quantidade := private.estoque_decimal_json(p_entrada->'quantidadeContada');
    if v_quantidade is null or char_length(v_motivo) not between 1 and 500 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Contagem inválida.'); end if;
  else
    v_motivo := btrim(coalesce(p_entrada->>'motivo','')); v_quantidade := private.estoque_decimal_json(p_entrada->'quantidade',true);
    if v_quantidade is null or char_length(v_motivo) not between 1 and 500 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Movimento inválido.'); end if;
    if p_acao = 'consumir' and v_validade < v_hoje then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Lote vencido não pode ser consumido.'); end if;
  end if;
  if p_acao = 'receber' and (p_entrada ? 'novoLote') then
    insert into public.estoque_lotes(id,clinica_id,item_id,identificador_fabricante,validade,origem_sem_identificacao)
      values(v_lote_id,v_clinica,v_item.id,v_codigo,v_validade,v_codigo is null);
    select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=v_lote_id;
  end if;
  select coalesce(sum(quantidade),0) into v_saldo_lote from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_item.id and lote_id=v_lote_id;
  v_delta := case when p_acao='receber' then v_quantidade when p_acao='ajustar' then v_quantidade-v_saldo_lote else -v_quantidade end;
  if v_saldo_lote+v_delta < 0 then return jsonb_build_object('ok',false,'codigo','SALDO_INSUFICIENTE','mensagem','Saldo insuficiente.'); end if;
  select coalesce(sum(quantidade),0)+v_delta into v_saldo_item from public.estoque_movimentos where clinica_id=v_clinica and item_id=v_item.id;
  v_resultado := jsonb_build_object('ok',true,'data',jsonb_build_object('itemId',v_item.id::text,'loteId',v_lote_id::text,'movimentoId',case when p_acao='ajustar' and v_delta=0 then null else v_movimento_id::text end,'saldo',private.estoque_decimal_text(v_saldo_item),'versao',v_item.versao+1));
  insert into public.estoque_operacoes values(v_operacao_id,v_clinica,v_ator,v_chave,v_hash,v_resultado,now());
  if v_delta <> 0 then
    insert into public.estoque_movimentos(id,clinica_id,item_id,lote_id,tipo,quantidade,motivo,origem_tipo,operacao_id,ator_usuario_id)
      values(v_movimento_id,v_clinica,v_item.id,v_lote_id,case p_acao
        when 'receber' then 'entrada'
        when 'consumir' then 'consumo'
        when 'descartar' then 'descarte'
        else 'ajuste'
      end,v_delta,case when p_acao='receber' then null else v_motivo end,case when p_acao='ajustar' then 'contagem' else 'manual' end,v_operacao_id,v_ator);
  end if;
  update public.estoque_itens set versao=versao+1 where clinica_id=v_clinica and id=v_item.id;
  insert into public.estoque_auditoria(clinica_id,ator_usuario_id,acao,item_id,antes,depois,motivo,operacao_id)
    values(v_clinica,v_ator,p_acao,v_item.id,jsonb_build_object('saldo',private.estoque_decimal_text(v_saldo_item-v_delta)),jsonb_build_object('saldo',private.estoque_decimal_text(v_saldo_item),'loteId',v_lote_id::text),case when p_acao='receber' then coalesce(v_motivo_vencido,null) else v_motivo end,v_operacao_id);
  return v_resultado;
exception when lock_not_available or query_canceled then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Estoque indisponível. Tente novamente.');
when others then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível concluir a operação.');
end;
$$;