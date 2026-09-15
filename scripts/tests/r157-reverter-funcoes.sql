-- R157: usar somente para reversão do comportamento após reverter o app.
-- Preserva todas as tabelas, linhas e colunas, inclusive composições/notas já salvas.
-- Não executar automaticamente; novas propostas por grupo ficam indisponíveis no app antigo.
begin;
set local lock_timeout='3s';
drop function if exists public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text);
CREATE OR REPLACE FUNCTION public.criar_cobranca_orcamento(p_orcamento_id uuid, p_item_ids uuid[], p_desconto numeric DEFAULT 0, p_numero_parcelas smallint DEFAULT 1, p_primeiro_vencimento date DEFAULT NULL::date)
 RETURNS orcamento_cobrancas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orc public.orcamentos%rowtype;
  v_cobranca public.orcamento_cobrancas%rowtype;
  v_subtotal numeric := 0;
  v_valor_final numeric := 0;
  v_item public.orcamento_itens%rowtype;
  v_item_id uuid;
  v_primeiro_vencimento date;
begin
  if v_clinica_id is null or v_actor_id is null then raise exception 'sem_permissao'; end if;
  if p_item_ids is null or cardinality(p_item_ids) is null or cardinality(p_item_ids) = 0
     or cardinality(p_item_ids) <> cardinality(array(select distinct unnest(p_item_ids))) then
    raise exception 'itens_invalidos';
  end if;
  if p_desconto is null or p_desconto < 0 or round(p_desconto * 100) <> p_desconto * 100 then
    raise exception 'desconto_invalido';
  end if;
  if p_numero_parcelas is null or p_numero_parcelas < 1 or p_numero_parcelas > 24 then
    raise exception 'numero_parcelas_invalido';
  end if;
  v_primeiro_vencimento := coalesce(p_primeiro_vencimento, (now() at time zone 'America/Sao_Paulo')::date);

  select o.* into v_orc
    from public.orcamentos o
   where o.id = p_orcamento_id and o.clinica_id = v_clinica_id
   for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then
    raise exception 'sem_permissao';
  end if;

  foreach v_item_id in array p_item_ids loop
    select oi.* into v_item
      from public.orcamento_itens oi
     where oi.id = v_item_id
       and oi.orcamento_id = v_orc.id
       and oi.clinica_id = v_clinica_id
     for update;
    if v_item.id is null or not v_item.aprovado then raise exception 'item_nao_aprovado'; end if;
    if exists (
      select 1
      from public.orcamento_cobranca_itens ci
      join public.orcamento_cobrancas c on c.id = ci.cobranca_id
      where ci.orcamento_item_id = v_item.id
        and ci.ativo
        and c.situacao = 'aberta'
    ) then
      raise exception 'item_ja_cobrado';
    end if;
    v_subtotal := v_subtotal + coalesce(v_item.preco_total, 0);
  end loop;
  if v_subtotal <= 0 then raise exception 'subtotal_invalido'; end if;
  if p_desconto > v_subtotal then raise exception 'desconto_acima_subtotal'; end if;
  v_valor_final := v_subtotal - p_desconto;

  insert into public.orcamento_cobrancas (
    clinica_id, orcamento_id, paciente_id, dentista_id, subtotal, desconto, valor_final,
    numero_parcelas, primeiro_vencimento
  ) values (
    v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, v_subtotal, p_desconto, v_valor_final,
    p_numero_parcelas, v_primeiro_vencimento
  ) returning * into v_cobranca;

  foreach v_item_id in array p_item_ids loop
    select oi.* into v_item from public.orcamento_itens oi where oi.id = v_item_id;
    insert into public.orcamento_cobranca_itens (
      cobranca_id, orcamento_item_id, clinica_id, preco_total_snapshot
    ) values (
      v_cobranca.id, v_item.id, v_clinica_id, coalesce(v_item.preco_total, 0)
    );
  end loop;

  perform public.recompor_previsao_cobranca(v_cobranca.id, v_clinica_id, v_actor_id);
  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'cobranca.etapa_criada', jsonb_build_object(
      'cobranca_id', v_cobranca.id, 'item_ids', p_item_ids, 'subtotal', v_subtotal,
      'desconto', p_desconto, 'valor_final', v_valor_final,
      'numero_parcelas', p_numero_parcelas, 'primeiro_vencimento', v_primeiro_vencimento
    )
  );
  return v_cobranca;
end;
$function$;

revoke all on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date) from public,anon;
grant execute on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date) to authenticated;
CREATE OR REPLACE FUNCTION public.aceitar_orcamento(p_orcamento_id uuid, p_assinado_por text, p_assinatura_ref text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id    uuid := get_my_clinica_id();
  v_caller        uuid := get_my_dentista_id();
  v_role          text := get_my_role();
  v_orc           record;
  v_cro           text;
  v_snapshot      jsonb;
  v_subtotal      numeric(10,2);
  v_valor_aprovado numeric(10,2);
  v_assinatura_id uuid;
begin
  select o.id, o.paciente_id, o.dentista_id, o.status, o.total, o.valor_acordado, o.desconto,
         o.validade_dias, o.condicoes_pagamento, o.mostrar_valor_por_item
    into v_orc
  from public.orcamentos o
  where o.id = p_orcamento_id and o.clinica_id = v_clinica_id;

  if v_orc.id is null then raise exception 'sem_permissao'; end if;
  if v_orc.dentista_id is null then raise exception 'sem_responsavel'; end if;

  select coalesce(sum(i.preco_total), 0) into v_valor_aprovado
  from public.orcamento_itens i where i.orcamento_id = p_orcamento_id and i.aprovado;

  if v_valor_aprovado = 0 then raise exception 'status_invalido'; end if;

  if v_orc.dentista_id <> v_caller and v_role <> 'secretaria' then
    raise exception 'sem_permissao';
  end if;

  if exists (select 1 from public.assinaturas a
             where a.orcamento_id = p_orcamento_id and a.tipo = 'orcamento') then
    raise exception 'ja_aceito';
  end if;

  select d.cro into v_cro from public.dentistas d where d.id = v_orc.dentista_id;

  select coalesce(sum(i.preco_total), 0) into v_subtotal
  from public.orcamento_itens i where i.orcamento_id = p_orcamento_id;

  select jsonb_build_object(
    'versao', 2,
    'subtotal', v_subtotal,
    'valorAprovado', v_valor_aprovado,
    'desconto', coalesce(v_orc.desconto, 0),
    'total', coalesce(v_orc.valor_acordado, v_valor_aprovado, 0),
    'validadeDias', v_orc.validade_dias,
    'condicoesPagamento', v_orc.condicoes_pagamento,
    'mostrarValorPorItem', v_orc.mostrar_valor_por_item,
    'estadoNoAto', 'aceito',
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', i.descricao, 'dente', i.dente, 'quantidade', i.quantidade,
        'precoUnitario', i.preco_unitario, 'precoTotal', i.preco_total
      ) order by i.created_at)
      from public.orcamento_itens i where i.orcamento_id = p_orcamento_id and i.aprovado
    ), '[]'::jsonb)
  ) into v_snapshot;

  insert into public.assinaturas
    (clinica_id, paciente_id, tipo, orcamento_id, dentista_id,
     assinado_por, cro_no_ato, assinatura_ref, termos_snapshot)
  values
    (v_clinica_id, v_orc.paciente_id, 'orcamento', p_orcamento_id, v_orc.dentista_id,
     p_assinado_por, v_cro, p_assinatura_ref, v_snapshot)
  returning id into v_assinatura_id;

  return v_assinatura_id;
end;
$function$;

-- Guardas e RPCs aditivas permanecem: não removem nem reescrevem registros.
notify pgrst, 'reload schema';
commit;
