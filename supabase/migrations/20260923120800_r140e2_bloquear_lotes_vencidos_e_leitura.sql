-- R-140e2: reforça autorização da ficha e bloqueia consumo clínico de lote vencido.
-- Forward-only: preserva os fatos e os replays criados pelas funções já aplicadas.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter function private.operar_kits_estoque(text,jsonb) rename to operar_kits_estoque_legacy_r140e2;
alter function private.declarar_usos_estoque(jsonb) rename to declarar_usos_estoque_legacy_r140e2;
alter function private.confirmar_usos_estoque(jsonb) rename to confirmar_usos_estoque_legacy_r140e2;
alter function private.corrigir_uso_estoque(jsonb) rename to corrigir_uso_estoque_legacy_r140e2;

create or replace function private.estoque_tem_kit_gerir(p_contexto jsonb,p_titular_tipo text,p_titular_dentista_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
  select private.estoque_tem_acao(p_contexto,p_titular_tipo,p_titular_dentista_id,'estoque.gerir');
$$;

create function private.operar_kits_estoque(p_acao text,p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_resultado jsonb;
begin
  begin
    v_resultado := private.operar_kits_estoque_legacy_r140e2(p_acao,p_entrada);
    if coalesce((v_resultado->>'ok')::boolean,false) is not true then
      raise exception 'R140E2_KIT_SEM_EFEITO_PARCIAL' using errcode='P0001';
    end if;
    return v_resultado;
  exception when raise_exception then
    return v_resultado;
  end;
end;
$$;

create function private.declarar_usos_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  v_ator uuid := auth.uid(); v_clinica uuid := private.estoque_uuid(p_entrada->>'clinicaIdEsperada');
  v_chave uuid := private.estoque_uuid(p_entrada->>'chaveIdempotencia'); v_contexto jsonb;
  v_atendimento public.atendimentos_clinicos%rowtype; v_linha jsonb; v_item public.estoque_itens%rowtype; v_lote public.estoque_lotes%rowtype; v_kit uuid; v_resultado jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if jsonb_typeof(p_entrada)='object' and v_ator is not null and v_clinica is not null and v_chave is not null
    and jsonb_typeof(p_entrada->'linhas')='array' then
    -- Um replay é fato histórico: o lote pode vencer depois da declaração sem mudar sua resposta.
    if exists(select 1 from public.estoque_operacoes o where o.clinica_id=v_clinica and o.ator_usuario_id=v_ator and o.chave_idempotencia=v_chave) then
      return private.declarar_usos_estoque_legacy_r140e2(p_entrada);
    end if;
    v_contexto := private.estoque_contexto_travado(v_clinica);
    if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
    select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
    if not found or v_atendimento.dentista_id is distinct from private.estoque_uuid(v_contexto#>>'{data,dentistaId}') then
      return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Atendimento indisponível.');
    end if;
    for v_linha in select value from jsonb_array_elements(p_entrada->'linhas') order by private.estoque_uuid(value->>'itemId'), private.estoque_uuid(value->>'loteId') loop
      if jsonb_typeof(v_linha)<>'object' or private.estoque_uuid(v_linha->>'linhaOrigemId') is null or private.estoque_uuid(v_linha->>'itemId') is null or private.estoque_uuid(v_linha->>'loteId') is null or private.estoque_decimal_json(v_linha->'quantidade',true) is null or jsonb_typeof(v_linha->'kitVersaoId') not in ('string','null') then
        return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Linhas de materiais inválidas.');
      end if;
      select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=private.estoque_uuid(v_linha->>'itemId') for share;
      if not found or not v_item.ativo then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
      if not private.estoque_tem_acao(v_contexto,v_item.titular_tipo,v_item.titular_dentista_id,'estoque.ler') then
        return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao material selecionado.');
      end if;
      select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=private.estoque_uuid(v_linha->>'loteId') for share;
      if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Material indisponível.'); end if;
      if v_lote.validade is not null and v_lote.validade < v_hoje then
        return jsonb_build_object('ok',false,'codigo','LOTE_VENCIDO','mensagem','Lote vencido indisponível para uso na ficha.');
      end if;
      v_kit := case when v_linha->'kitVersaoId'='null'::jsonb then null else private.estoque_uuid(v_linha->>'kitVersaoId') end;
      if jsonb_typeof(v_linha->'kitVersaoId')='string' and v_kit is null then
        return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Componente do kit inválido.');
      end if;
      if v_kit is not null and not exists(select 1 from public.estoque_kit_componentes c where c.clinica_id=v_clinica and c.kit_versao_id=v_kit and c.item_id=v_item.id) then
        return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Componente do kit inválido.');
      end if;
    end loop;
  end if;
  begin
    v_resultado := private.declarar_usos_estoque_legacy_r140e2(p_entrada);
    if coalesce((v_resultado->>'ok')::boolean,false) is not true then
      raise exception 'R140E2_DECLARACAO_SEM_EFEITO_PARCIAL' using errcode='P0001';
    end if;
    return v_resultado;
  exception when raise_exception then
    return v_resultado;
  end;
end;
$$;

create function private.confirmar_usos_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  v_ator uuid := auth.uid(); v_clinica uuid := private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave uuid := private.estoque_uuid(p_entrada->>'chaveIdempotencia');
  v_contexto jsonb; v_atendimento public.atendimentos_clinicos%rowtype; v_ids uuid[]; v_uso public.estoque_usos%rowtype;
  v_item public.estoque_itens%rowtype; v_lote public.estoque_lotes%rowtype; v_resultado jsonb; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if jsonb_typeof(p_entrada)='object' and v_ator is not null and v_clinica is not null and v_chave is not null
    and jsonb_typeof(p_entrada->'usoIds')='array' and jsonb_array_length(p_entrada->'usoIds') between 1 and 50 then
    if exists(select 1 from public.estoque_operacoes o where o.clinica_id=v_clinica and o.ator_usuario_id=v_ator and o.chave_idempotencia=v_chave) then
      return private.confirmar_usos_estoque_legacy_r140e2(p_entrada);
    end if;
    select array_agg(private.estoque_uuid(value)) into v_ids from jsonb_array_elements_text(p_entrada->'usoIds');
    if array_position(v_ids,null) is null and cardinality(v_ids)=cardinality(array(select distinct unnest(v_ids))) then
      v_contexto := private.estoque_contexto_travado(v_clinica);
      if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
      select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
      if found and v_atendimento.dentista_id=private.estoque_uuid(v_contexto#>>'{data,dentistaId}')
        and (select count(*) from public.estoque_usos u where u.clinica_id=v_clinica and u.id=any(v_ids) and u.atendimento_id=v_atendimento.id and u.autor_usuario_id=v_ator and u.estado_operacional='pendente_autorizacao')=cardinality(v_ids) then
        for v_uso in select * from public.estoque_usos where clinica_id=v_clinica and id=any(v_ids) order by item_id,lote_id,id for update loop
          select * into v_item from public.estoque_itens where clinica_id=v_clinica and id=v_uso.item_id for update;
          select * into v_lote from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item.id and id=v_uso.lote_id for update;
          if found and v_lote.validade is not null and v_lote.validade<v_hoje then
            return jsonb_build_object('ok',false,'codigo','LOTE_VENCIDO','mensagem','Um lote selecionado está vencido e não pode ser confirmado.');
          end if;
        end loop;
      end if;
    end if;
  end if;
  begin
    v_resultado := private.confirmar_usos_estoque_legacy_r140e2(p_entrada);
    if coalesce((v_resultado->>'ok')::boolean,false) is not true then
      raise exception 'R140E2_CONFIRMACAO_SEM_EFEITO_PARCIAL' using errcode='P0001';
    end if;
    return v_resultado;
  exception when raise_exception then
    return v_resultado;
  end;
end;
$$;

create function private.corrigir_uso_estoque(p_entrada jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  v_ator uuid := auth.uid(); v_clinica uuid := private.estoque_uuid(p_entrada->>'clinicaIdEsperada'); v_chave uuid := private.estoque_uuid(p_entrada->>'chaveIdempotencia');
  v_contexto jsonb; v_atendimento public.atendimentos_clinicos%rowtype; v_anterior public.estoque_usos%rowtype;
  v_item_anterior public.estoque_itens%rowtype; v_item_novo public.estoque_itens%rowtype; v_lote_novo public.estoque_lotes%rowtype;
  v_linha jsonb := p_entrada->'substituicao'; v_resultado jsonb; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if jsonb_typeof(p_entrada)='object' and v_ator is not null and v_clinica is not null and v_chave is not null and jsonb_typeof(v_linha)='object'
    and private.estoque_uuid(p_entrada->>'usoId') is not null and private.estoque_uuid(v_linha->>'itemId') is not null and private.estoque_uuid(v_linha->>'loteId') is not null then
    if exists(select 1 from public.estoque_operacoes o where o.clinica_id=v_clinica and o.ator_usuario_id=v_ator and o.chave_idempotencia=v_chave) then
      return private.corrigir_uso_estoque_legacy_r140e2(p_entrada);
    end if;
    v_contexto := private.estoque_contexto_travado(v_clinica);
    if (v_contexto->>'ok')::boolean is not true then return v_contexto; end if;
    select * into v_atendimento from public.atendimentos_clinicos where clinica_id=v_clinica and id=private.estoque_uuid(p_entrada->>'atendimentoId') for update;
    if found and v_atendimento.dentista_id=private.estoque_uuid(v_contexto#>>'{data,dentistaId}') then
      select * into v_anterior from public.estoque_usos where clinica_id=v_clinica and atendimento_id=v_atendimento.id and id=private.estoque_uuid(p_entrada->>'usoId') and autor_usuario_id=v_ator and estado_operacional in ('confirmado','confirmado_divergente') for update;
      if found then
        select * into v_item_anterior from public.estoque_itens where clinica_id=v_clinica and id=v_anterior.item_id for update;
        select * into v_item_novo from public.estoque_itens where clinica_id=v_clinica and id=private.estoque_uuid(v_linha->>'itemId') for update;
        if found and private.estoque_tem_acao(v_contexto,v_item_novo.titular_tipo,v_item_novo.titular_dentista_id,'estoque.consumir') then
          select * into v_lote_novo from public.estoque_lotes where clinica_id=v_clinica and item_id=v_item_novo.id and id=private.estoque_uuid(v_linha->>'loteId') for update;
          if found and v_lote_novo.validade is not null and v_lote_novo.validade<v_hoje then
            return jsonb_build_object('ok',false,'codigo','LOTE_VENCIDO','mensagem','Lote vencido indisponível para correção de uso.');
          end if;
        end if;
      end if;
    end if;
  end if;
  begin
    v_resultado := private.corrigir_uso_estoque_legacy_r140e2(p_entrada);
    if coalesce((v_resultado->>'ok')::boolean,false) is not true then
      raise exception 'R140E2_CORRECAO_SEM_EFEITO_PARCIAL' using errcode='P0001';
    end if;
    return v_resultado;
  exception when raise_exception then
    return v_resultado;
  end;
end;
$$;

create or replace function public.operar_kits_estoque(p_acao text,p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.operar_kits_estoque(p_acao,p_entrada); $$;
create or replace function public.declarar_usos_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.declarar_usos_estoque(p_entrada); $$;
create or replace function public.confirmar_usos_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.confirmar_usos_estoque(p_entrada); $$;
create or replace function public.corrigir_uso_estoque(p_entrada jsonb) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.corrigir_uso_estoque(p_entrada); $$;

revoke all on function private.operar_kits_estoque_legacy_r140e2(text,jsonb),private.declarar_usos_estoque_legacy_r140e2(jsonb),private.confirmar_usos_estoque_legacy_r140e2(jsonb),private.corrigir_uso_estoque_legacy_r140e2(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.operar_kits_estoque(text,jsonb),private.declarar_usos_estoque(jsonb),private.confirmar_usos_estoque(jsonb),private.corrigir_uso_estoque(jsonb),public.operar_kits_estoque(text,jsonb),public.declarar_usos_estoque(jsonb),public.confirmar_usos_estoque(jsonb),public.corrigir_uso_estoque(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.operar_kits_estoque(text,jsonb),private.declarar_usos_estoque(jsonb),private.confirmar_usos_estoque(jsonb),private.corrigir_uso_estoque(jsonb),public.operar_kits_estoque(text,jsonb),public.declarar_usos_estoque(jsonb),public.confirmar_usos_estoque(jsonb),public.corrigir_uso_estoque(jsonb) to authenticated;
