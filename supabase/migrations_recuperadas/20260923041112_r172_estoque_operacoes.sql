-- R-140e1b: operações manuais e leituras de estoque, expostas apenas por RPC autenticada.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create function private.estoque_decimal_text(p_valor numeric)
returns text language sql immutable security invoker set search_path = pg_catalog
as $$
  select case
    when p_valor = 0 then '0'
    when position('.' in p_valor::text) > 0
      then trim(trailing '.' from trim(trailing '0' from p_valor::text))
    else p_valor::text
  end;
$$;

create function private.estoque_decimal(p_valor text, p_positivo boolean default false)
returns numeric language plpgsql immutable security invoker set search_path = pg_catalog
as $$
declare v_valor text := coalesce(p_valor, '');
begin
  if v_valor !~ '^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{0,5}[1-9])?$'
    or (p_positivo and v_valor = '0') then return null; end if;
  return v_valor::numeric;
end;
$$;

create function private.estoque_decimal_json(p_valor jsonb, p_positivo boolean default false)
returns numeric language sql immutable security invoker set search_path = pg_catalog, private
as $$ select case when jsonb_typeof(p_valor) = 'string' then private.estoque_decimal(p_valor #>> '{}', p_positivo) end; $$;

create function private.estoque_uuid(p_valor text)
returns uuid language plpgsql immutable security invoker set search_path = pg_catalog
as $$ begin
  if coalesce(p_valor, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return p_valor::uuid;
end; $$;

create function private.estoque_versao(p_valor jsonb)
returns integer language plpgsql immutable security invoker set search_path = pg_catalog
as $$ begin
  if jsonb_typeof(p_valor) <> 'number' or p_valor #>> '{}' !~ '^[1-9][0-9]{0,9}$' then return null; end if;
  begin
    if (p_valor #>> '{}')::numeric > 2147483647 then return null; end if;
    return (p_valor #>> '{}')::integer;
  exception when others then return null; end;
end; $$;

create function private.estoque_chaves_exatas(p_valor jsonb, p_chaves text[])
returns boolean language sql immutable security invoker set search_path = pg_catalog
as $$
  select jsonb_typeof(p_valor) = 'object'
    and not exists (select 1 from jsonb_object_keys(p_valor) k where not (k = any(p_chaves)));
$$;

create function private.estoque_titular(p_valor jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = pg_catalog
as $$
begin
  if jsonb_typeof(p_valor) <> 'object' then return null; end if;
  if p_valor->>'tipo' = 'clinica'
    and private.estoque_chaves_exatas(p_valor, array['tipo']) then
    return jsonb_build_object('tipo', 'clinica');
  end if;
  if p_valor->>'tipo' = 'dentista'
    and private.estoque_chaves_exatas(p_valor, array['tipo','dentistaId'])
    and private.estoque_uuid(p_valor->>'dentistaId') is not null then
    return jsonb_build_object('tipo', 'dentista', 'dentistaId', lower(p_valor->>'dentistaId'));
  end if;
  return null;
end; $$;

create function private.estoque_contexto_travado(p_clinica_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare v_contexto jsonb; v_ator uuid := auth.uid();
begin
  v_contexto := private.obter_contexto_estoque(p_clinica_id);
  if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  perform 1 from public.clinica_governanca where clinica_id = p_clinica_id for update;
  perform 1 from public.clinica_usuarios
    where clinica_id = p_clinica_id and usuario_id = v_ator and status = 'ativo' for update;
  perform 1 from public.users where id = v_ator for update;
  perform 1 from public.dentistas
    where clinica_id = p_clinica_id and user_id = v_ator order by id for share;
  perform 1 from public.clinica_acessos ca
    join public.clinica_usuarios cu on cu.id = ca.membro_id
    where ca.clinica_id = p_clinica_id and cu.usuario_id = v_ator for update of ca;
  return private.obter_contexto_estoque(p_clinica_id);
end; $$;

create function private.estoque_tem_acao(
  p_contexto jsonb, p_titular_tipo text, p_titular_dentista_id uuid, p_acao text
)
returns boolean language sql immutable security invoker set search_path = pg_catalog
as $$
  select case
    when p_titular_tipo = 'dentista' then
      p_contexto#>>'{data,dentistaId}' = p_titular_dentista_id::text
      and (p_contexto#>'{data,permissoesPessoais}') @> jsonb_build_array('estoque.ler', p_acao)
    when p_titular_tipo = 'clinica' then
      (p_contexto#>'{data,permissoesCompartilhadas}') @> jsonb_build_array('estoque.ler', p_acao)
    else false end;
$$;

create function private.estoque_hash(p_acao text, p_entrada jsonb)
returns text language sql immutable security invoker set search_path = pg_catalog
as $$ select encode(extensions.digest(jsonb_build_object('acao', p_acao, 'entrada', p_entrada)::text, 'sha256'), 'hex'); $$;

create function private.estoque_item_resumo(p_item public.estoque_itens)
returns jsonb language sql stable security definer set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', p_item.id::text, 'nome', p_item.nome, 'unidadeBase', p_item.unidade_base,
    'titular', case when p_item.titular_tipo = 'clinica' then jsonb_build_object('tipo','clinica')
      else jsonb_build_object('tipo','dentista','dentistaId',p_item.titular_dentista_id::text) end,
    'controlaLote', p_item.controle_lote, 'minimo', private.estoque_decimal_text(p_item.minimo),
    'saldo', private.estoque_decimal_text(coalesce((select sum(m.quantidade) from public.estoque_movimentos m
      where m.clinica_id=p_item.clinica_id and m.item_id=p_item.id),0)),
    'ativo', p_item.ativo, 'versao', p_item.versao,
    'validadeProxima', (select min(l.validade)::text from public.estoque_lotes l
      where l.clinica_id=p_item.clinica_id and l.item_id=p_item.id and l.validade is not null
        and coalesce((select sum(m.quantidade) from public.estoque_movimentos m
          where m.clinica_id=l.clinica_id and m.item_id=l.item_id and m.lote_id=l.id),0) > 0)
  );
$$;

create function private.estoque_item_resumo_id(p_clinica_id uuid, p_item_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public, private
as $$
  select private.estoque_item_resumo(i)
  from public.estoque_itens i where i.clinica_id=p_clinica_id and i.id=p_item_id;
$$;

create function private.operar_estoque(p_acao text, p_entrada jsonb)
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
    if v_substituicao->>'tipo' = 'consumo' and v_lote.validade < v_hoje then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Lote vencido indisponível para consumo.'); end if;
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
    if p_acao = 'consumir' and v_validade < v_hoje then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Lote vencido indisponível para consumo.'); end if;
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
      values(v_movimento_id,v_clinica,v_item.id,v_lote_id,case when p_acao='receber' then 'entrada' when p_acao='ajustar' then 'ajuste' else p_acao end,v_delta,case when p_acao='receber' then null else v_motivo end,case when p_acao='ajustar' then 'contagem' else 'manual' end,v_operacao_id,v_ator);
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

create function private.consultar_estoque(p_acao text, p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare
  v_contexto jsonb; v_clinica uuid; v_titular jsonb; v_item public.estoque_itens%rowtype;
  v_busca text := ''; v_filtro text := 'todos'; v_limite integer := 25;
  v_cursor_nome text; v_cursor_id uuid; v_cursor_ocorrido timestamptz;
  v_itens jsonb; v_lotes jsonb; v_movimentos jsonb; v_proximo jsonb; v_total integer; v_tem_mais boolean;
begin
  perform set_config('statement_timeout','15s',true);
  if p_acao not in ('listar','detalhar') or jsonb_typeof(p_entrada) <> 'object' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Consulta de estoque inválida.');
  end if;
  if not private.estoque_chaves_exatas(p_entrada, case when p_acao='listar'
    then array['clinicaIdEsperada','titular','busca','filtro','cursor','limite']
    else array['clinicaIdEsperada','itemId','cursor','limite'] end) then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Campos da consulta inválidos.');
  end if;
  v_clinica := private.estoque_uuid(p_entrada->>'clinicaIdEsperada');
  if v_clinica is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Contexto da consulta inválido.'); end if;
  v_contexto := private.obter_contexto_estoque(v_clinica);
  if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
  if p_entrada ? 'limite' then
    if jsonb_typeof(p_entrada->'limite') <> 'number' or p_entrada->>'limite' !~ '^(?:[1-9]|[1-4][0-9]|50)$' then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Limite de paginação inválido.');
    end if;
    v_limite := (p_entrada->>'limite')::integer;
  end if;

  if p_acao = 'listar' then
    v_titular := private.estoque_titular(p_entrada->'titular');
    if v_titular is null or not private.estoque_tem_acao(v_contexto,v_titular->>'tipo',private.estoque_uuid(v_titular->>'dentistaId'),'estoque.ler') then
      return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao titular do estoque.');
    end if;
    if p_entrada ? 'busca' then
      if jsonb_typeof(p_entrada->'busca') <> 'string' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Busca inválida.'); end if;
      v_busca := btrim(p_entrada->>'busca');
      if char_length(v_busca) > 120 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Busca inválida.'); end if;
    end if;
    if p_entrada ? 'filtro' then
      if jsonb_typeof(p_entrada->'filtro') <> 'string' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Filtro inválido.'); end if;
      v_filtro := p_entrada->>'filtro';
    end if;
    if v_filtro not in ('todos','baixo','validade','divergente','arquivados') then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Filtro inválido.'); end if;
    if p_entrada ? 'cursor' and p_entrada->'cursor' <> 'null'::jsonb then
      if not private.estoque_chaves_exatas(p_entrada->'cursor',array['nome','id']) or jsonb_typeof(p_entrada#>'{cursor,nome}') <> 'string' then
        return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Cursor inválido.');
      end if;
      v_cursor_nome := p_entrada#>>'{cursor,nome}'; v_cursor_id := private.estoque_uuid(p_entrada#>>'{cursor,id}');
      if char_length(v_cursor_nome) not between 1 and 120 or v_cursor_id is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Cursor inválido.'); end if;
    end if;
    with candidatos as (
      select i.*, coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=i.clinica_id and m.item_id=i.id),0) as saldo
      from public.estoque_itens i
      where i.clinica_id=v_clinica and i.titular_tipo=v_titular->>'tipo'
        and i.titular_dentista_id is not distinct from private.estoque_uuid(v_titular->>'dentistaId')
        and (v_busca='' or position(lower(v_busca) in lower(i.nome)) > 0)
        and (v_filtro='todos' and i.ativo
          or v_filtro='arquivados' and not i.ativo
          or v_filtro='baixo' and i.ativo and coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=i.clinica_id and m.item_id=i.id),0) <= i.minimo
          or v_filtro='validade' and i.ativo and exists(select 1 from public.estoque_lotes l where l.clinica_id=i.clinica_id and l.item_id=i.id and l.validade <= ((now() at time zone 'America/Sao_Paulo')::date+30) and coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=l.clinica_id and m.item_id=l.item_id and m.lote_id=l.id),0)>0)
          or v_filtro='divergente' and exists(select 1 from public.estoque_movimentos m where m.clinica_id=i.clinica_id and m.item_id=i.id group by m.lote_id having sum(m.quantidade)<0))
    ), pagina as (
      select c.*, row_number() over(order by c.nome,c.id) as posicao from candidatos c
      where v_cursor_id is null or (c.nome,c.id) > (v_cursor_nome,v_cursor_id)
      order by c.nome,c.id limit v_limite+1
    )
    select coalesce(jsonb_agg(private.estoque_item_resumo_id(pagina.clinica_id,pagina.id) order by nome,id) filter(where posicao<=v_limite),'[]'::jsonb),
      count(*)>v_limite,
      (array_agg(jsonb_build_object('nome',nome,'id',id::text) order by posicao) filter(where posicao=v_limite))[1]
    into v_itens,v_tem_mais,v_proximo from pagina;
    select count(*) into v_total from public.estoque_itens i
      where i.clinica_id=v_clinica and i.titular_tipo=v_titular->>'tipo'
        and i.titular_dentista_id is not distinct from private.estoque_uuid(v_titular->>'dentistaId')
        and (v_busca='' or position(lower(v_busca) in lower(i.nome)) > 0)
        and (v_filtro='todos' and i.ativo
          or v_filtro='arquivados' and not i.ativo
          or v_filtro='baixo' and i.ativo and coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=i.clinica_id and m.item_id=i.id),0) <= i.minimo
          or v_filtro='validade' and i.ativo and exists(select 1 from public.estoque_lotes l where l.clinica_id=i.clinica_id and l.item_id=i.id and l.validade <= ((now() at time zone 'America/Sao_Paulo')::date+30) and coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=l.clinica_id and m.item_id=l.item_id and m.lote_id=l.id),0)>0)
          or v_filtro='divergente' and exists(select 1 from public.estoque_movimentos m where m.clinica_id=i.clinica_id and m.item_id=i.id group by m.lote_id having sum(m.quantidade)<0));
    return jsonb_build_object('ok',true,'data',jsonb_build_object('itens',v_itens,'proximoCursor',case when v_tem_mais then v_proximo else null end,'total',v_total));
  end if;

  v_cursor_id := private.estoque_uuid(p_entrada->>'itemId');
  if v_cursor_id is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Material inválido.'); end if;
  select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=v_cursor_id;
  if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
  if not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,'estoque.ler') then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material.'); end if;
  if p_entrada ? 'cursor' and p_entrada->'cursor' <> 'null'::jsonb then
    if not private.estoque_chaves_exatas(p_entrada->'cursor',array['ocorridoEm','id']) or jsonb_typeof(p_entrada#>'{cursor,ocorridoEm}') <> 'string' then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Cursor inválido.'); end if;
    v_cursor_id := private.estoque_uuid(p_entrada#>>'{cursor,id}');
    begin v_cursor_ocorrido := (p_entrada#>>'{cursor,ocorridoEm}')::timestamptz; exception when others then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Cursor inválido.'); end;
    if v_cursor_id is null then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Cursor inválido.'); end if;
  else v_cursor_id := null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id::text,'codigoFabricante',l.identificador_fabricante,'validadeISO',l.validade::text,'semIdentificacao',l.origem_sem_identificacao,'saldo',private.estoque_decimal_text(coalesce((select sum(m.quantidade) from public.estoque_movimentos m where m.clinica_id=l.clinica_id and m.item_id=l.item_id and m.lote_id=l.id),0))) order by l.created_at,l.id),'[]'::jsonb) into v_lotes
    from public.estoque_lotes l where l.clinica_id=v_clinica and l.item_id=v_item.id;
  with pagina as (
    select m.*,row_number() over(order by m.ocorrido_em desc,m.id desc) as posicao
    from public.estoque_movimentos m where m.clinica_id=v_clinica and m.item_id=v_item.id
      and (v_cursor_id is null or (m.ocorrido_em,m.id)<(v_cursor_ocorrido,v_cursor_id))
    order by m.ocorrido_em desc,m.id desc limit v_limite+1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id::text,'loteId',p.lote_id::text,'tipo',p.tipo,'quantidade',private.estoque_decimal_text(p.quantidade),'motivo',coalesce(p.motivo,'Recebimento'),'ocorridoEm',to_char(p.ocorrido_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'atorUsuarioId',p.ator_usuario_id::text,'atorNome',coalesce(nullif(btrim(d.nome),''),nullif(btrim(s.nome),''),'Membro da equipe'),'reversaoDe',p.reversao_de::text,'corrigido',exists(select 1 from public.estoque_movimentos r where r.reversao_de=p.id)) order by p.ocorrido_em desc,p.id desc) filter(where p.posicao<=v_limite),'[]'::jsonb),count(*)>v_limite,(array_agg(jsonb_build_object('ocorridoEm',to_char(p.ocorrido_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'id',p.id::text) order by p.posicao) filter(where p.posicao=v_limite))[1]
  into v_movimentos,v_tem_mais,v_proximo from pagina p
  left join public.dentistas d on d.clinica_id=p.clinica_id and d.user_id=p.ator_usuario_id
  left join public.secretarias s on s.clinica_id=p.clinica_id and s.usuario_id=p.ator_usuario_id;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('item',private.estoque_item_resumo(v_item),'lotes',v_lotes,'movimentos',v_movimentos,'proximoCursor',case when v_tem_mais then v_proximo else null end));
exception when query_canceled then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Consulta indisponível. Tente novamente.');
when others then return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível consultar o estoque.');
end;
$$;

create function public.operar_estoque(p_acao text, p_entrada jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog, public, private
as $$ select private.operar_estoque(p_acao,p_entrada); $$;
create function public.consultar_estoque(p_acao text, p_entrada jsonb)
returns jsonb language sql security invoker set search_path = pg_catalog, public, private
as $$ select private.consultar_estoque(p_acao,p_entrada); $$;

revoke all on function private.estoque_decimal_text(numeric),private.estoque_decimal(text,boolean),private.estoque_decimal_json(jsonb,boolean),private.estoque_uuid(text),private.estoque_versao(jsonb),private.estoque_chaves_exatas(jsonb,text[]),private.estoque_titular(jsonb),private.estoque_contexto_travado(uuid),private.estoque_tem_acao(jsonb,text,uuid,text),private.estoque_hash(text,jsonb),private.estoque_item_resumo(public.estoque_itens),private.estoque_item_resumo_id(uuid,uuid),private.operar_estoque(text,jsonb),private.consultar_estoque(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.operar_estoque(text,jsonb),public.consultar_estoque(text,jsonb) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.operar_estoque(text,jsonb),private.consultar_estoque(text,jsonb),public.operar_estoque(text,jsonb),public.consultar_estoque(text,jsonb) to authenticated;
