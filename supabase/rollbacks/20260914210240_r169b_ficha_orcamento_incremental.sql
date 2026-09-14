begin;
-- Reversão de API somente antes de qualquer vínculo/retirada R169b. Colunas e
-- histórico ficam preservados deliberadamente; funções antigas não os interpretam.
do $guard$
begin
  if exists (select 1 from public.orcamento_itens where retirado_em is not null)
    or exists (select 1 from public.orcamento_eventos where retirado_em is not null or item_id is not null)
    or exists (select 1 from public.odontograma_eventos where retirado_em is not null) then
    raise exception 'r169b_historico_preservado_rollback_recusado';
  end if;
end;
$guard$;

drop trigger if exists validar_item_do_vinculo_orcamento on public.orcamento_eventos;
drop function if exists public.validar_item_do_vinculo_orcamento();
drop function if exists public.retirar_evento_ficha_orcamento(uuid);
drop function if exists public.retirar_itens_orcamento_da_ficha(uuid, uuid, uuid[], timestamptz, boolean);
drop function if exists public.dispensar_retirada_orcamento(uuid, uuid, uuid);
drop function if exists public.vincular_eventos_legados_item_orcamento(uuid, uuid, uuid[]);
drop function if exists public.resolver_renomeacao_item_orcamento(uuid, uuid, uuid, uuid, text, boolean);

-- DDL live capturado antes da aplicação R169b (2026-09-14).
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
    'total', (select e.valor_devido from public.orcamentos_com_estado e where e.id = p_orcamento_id and e.clinica_id = v_clinica_id),
    'validadeDias', v_orc.validade_dias,
    'condicoesPagamento', v_orc.condicoes_pagamento,
    'mostrarValorPorItem', v_orc.mostrar_valor_por_item,
    'estadoNoAto', 'aceito',
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'descricao', i.descricao, 'dente', i.dente, 'quantidade', i.quantidade,
        'precoUnitario', i.preco_unitario, 'precoTotal', i.preco_total, 'composicao', i.composicao
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

CREATE OR REPLACE FUNCTION public.adicionar_itens_orcamento_com_eventos(p_orcamento_id uuid, p_itens jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_orcamento public.orcamentos%rowtype;
  v_item jsonb;
  v_evento_id uuid;
  v_evento_ids uuid[] := '{}';
  v_todos_evento_ids uuid[] := '{}';
  v_descricao text;
  v_quantidade integer;
  v_preco_unitario numeric;
  v_procedimento_id uuid;
  v_total_adicionado numeric := 0;
begin
  if auth.uid() is null or v_clinica_id is null then
    raise exception 'orcamento_sem_contexto';
  end if;

  select * into v_orcamento
  from public.orcamentos o
  where o.id = p_orcamento_id
    and o.clinica_id = v_clinica_id;

  if not found then
    raise exception 'orcamento_nao_encontrado';
  end if;

  if not public.can_act_as_dentista(v_orcamento.dentista_id) then
    raise exception 'orcamento_sem_permissao';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'orcamento_itens_invalidos';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_descricao := btrim(coalesce(v_item->>'descricao', ''));
    v_quantidade := nullif(v_item->>'quantidade', '')::integer;
    v_preco_unitario := nullif(v_item->>'preco_unitario', '')::numeric;
    v_procedimento_id := nullif(v_item->>'procedimento_id', '')::uuid;

    if v_descricao = '' or char_length(v_descricao) > 500
      or v_quantidade is null or v_quantidade < 1 or v_quantidade > 99
      or v_preco_unitario is null or v_preco_unitario < 0 then
      raise exception 'orcamento_item_invalido';
    end if;

    if v_procedimento_id is not null and not exists (
      select 1 from public.procedimentos pr
      where pr.id = v_procedimento_id and pr.clinica_id = v_clinica_id
    ) then
      raise exception 'orcamento_procedimento_invalido';
    end if;

    if jsonb_typeof(coalesce(v_item->'evento_ids', '[]'::jsonb)) <> 'array' then
      raise exception 'orcamento_eventos_invalidos';
    end if;

    select coalesce(array_agg(value::text::uuid), '{}')
      into strict v_evento_ids
    from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb));

    if cardinality(v_evento_ids) <> cardinality(array(select distinct unnest(v_evento_ids))) then
      raise exception 'orcamento_evento_duplicado';
    end if;

    v_todos_evento_ids := v_todos_evento_ids || v_evento_ids;
    v_total_adicionado := v_total_adicionado + (v_quantidade * v_preco_unitario);
  end loop;

  if cardinality(v_todos_evento_ids) <> cardinality(array(select distinct unnest(v_todos_evento_ids))) then
    raise exception 'orcamento_evento_duplicado';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    for v_evento_id in
      select value::text::uuid
      from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb))
    loop
      if not exists (
        select 1
        from public.odontograma_eventos e
        join public.fichas f on f.id = e.ficha_id
        where e.id = v_evento_id
          and e.clinica_id = v_clinica_id
          and f.paciente_id = v_orcamento.paciente_id
          and e.origem = 'clinica'
          and coalesce(e.encaminhado_para, f.dentista_id) = v_orcamento.dentista_id
      ) then
        raise exception 'orcamento_evento_invalido';
      end if;

      if exists (
        select 1 from public.orcamento_eventos oe where oe.evento_id = v_evento_id
      ) then
        raise exception 'orcamento_evento_ja_orcado';
      end if;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_descricao := btrim(v_item->>'descricao');
    v_quantidade := (v_item->>'quantidade')::integer;
    v_preco_unitario := (v_item->>'preco_unitario')::numeric;
    v_procedimento_id := nullif(v_item->>'procedimento_id', '')::uuid;

    insert into public.orcamento_itens (
      orcamento_id, clinica_id, descricao, procedimento_id, quantidade,
      preco_unitario, preco_total, aprovado
    ) values (
      v_orcamento.id, v_clinica_id, v_descricao, v_procedimento_id, v_quantidade,
      v_preco_unitario, v_quantidade * v_preco_unitario, false
    );

    for v_evento_id in
      select value::text::uuid
      from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb))
    loop
      insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id)
      values (v_clinica_id, v_orcamento.id, v_evento_id);
    end loop;
  end loop;

  update public.orcamentos
  set total = coalesce(total, 0) + v_total_adicionado
  where id = v_orcamento.id
    and clinica_id = v_clinica_id;

  return v_total_adicionado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirmar_previsao_orcamento(p_pagamento_id uuid, p_forma text, p_data date)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_pagamento public.pagamentos%rowtype;
  v_orc public.orcamentos%rowtype;
  v_valor_aprovado numeric := 0;
  v_valor_devido numeric := 0;
  v_valor_pago numeric := 0;
begin
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then
    raise exception 'forma_invalida';
  end if;

  select p.* into v_pagamento
    from public.pagamentos p
   where p.id = p_pagamento_id and p.clinica_id = v_clinica_id;
  if v_pagamento.id is null or v_pagamento.status <> 'pendente' then
    raise exception 'previsao_indisponivel';
  end if;

  select o.* into v_orc
    from public.orcamentos o
   where o.id = v_pagamento.orcamento_id and o.clinica_id = v_clinica_id
   for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then
    raise exception 'sem_permissao';
  end if;

  select coalesce(sum(oi.preco_total) filter (where oi.aprovado), 0)
    into v_valor_aprovado
    from public.orcamento_itens oi
   where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  if v_valor_aprovado <= 0 then raise exception 'orcamento_sem_aprovacao'; end if;
  select e.valor_devido into strict v_valor_devido from public.orcamentos_com_estado e where e.id = v_orc.id and e.clinica_id = v_clinica_id;
  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_valor_pago
    from public.pagamentos p
   where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id;
  if round((v_valor_pago + v_pagamento.valor) * 100) > round(v_valor_devido * 100) then
    raise exception 'valor_acima_do_saldo';
  end if;

  update public.pagamentos
     set status = 'pago', forma_pagamento = p_forma, data_pagamento = p_data, marcado_por_id = v_actor_id
   where id = v_pagamento.id and clinica_id = v_clinica_id
   returning * into v_pagamento;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.registrado', jsonb_build_object('valor', v_pagamento.valor, 'forma', p_forma, 'orcamento_id', v_orc.id, 'origem', 'previsao')
  );

  return v_pagamento;
end;
$function$;

CREATE OR REPLACE FUNCTION public.corrigir_recebimento_orcamento(p_pagamento_id uuid, p_valor numeric, p_forma text, p_data date)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_pagamento public.pagamentos%rowtype;
  v_orc public.orcamentos%rowtype;
  v_cobranca public.orcamento_cobrancas%rowtype;
  v_antes jsonb;
  v_valor_aprovado numeric := 0;
  v_valor_devido numeric := 0;
  v_valor_pago numeric := 0;
begin
  if p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100 then raise exception 'valor_invalido'; end if;
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then raise exception 'forma_invalida'; end if;
  select p.* into v_pagamento from public.pagamentos p
   where p.id = p_pagamento_id and p.clinica_id = v_clinica_id;
  if v_pagamento.id is null or v_pagamento.status <> 'pago' then raise exception 'recebimento_indisponivel'; end if;
  v_antes := jsonb_build_object('valor', v_pagamento.valor, 'forma', v_pagamento.forma_pagamento, 'data', v_pagamento.data_pagamento);

  if v_pagamento.cobranca_id is not null then
    select c.* into v_cobranca from public.orcamento_cobrancas c
     where c.id = v_pagamento.cobranca_id and c.clinica_id = v_clinica_id for update;
    if v_cobranca.id is null or v_cobranca.situacao <> 'aberta'
       or not public.can_act_as_dentista(v_cobranca.dentista_id) then raise exception 'cobranca_indisponivel'; end if;
    select coalesce(sum(p.valor) filter (where p.status = 'pago' and p.id <> v_pagamento.id), 0)
      into v_valor_pago from public.pagamentos p
     where p.cobranca_id = v_cobranca.id and p.clinica_id = v_clinica_id;
    if round((v_valor_pago + p_valor) * 100) > round(v_cobranca.valor_final * 100) then raise exception 'valor_acima_do_saldo'; end if;
    update public.pagamentos set valor = p_valor, forma_pagamento = p_forma, data_pagamento = p_data, marcado_por_id = v_actor_id
     where id = v_pagamento.id and clinica_id = v_clinica_id returning * into v_pagamento;
    perform public.recompor_previsao_cobranca(v_cobranca.id, v_clinica_id, v_actor_id);
    select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
    insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
    values (v_clinica_id, v_actor_id, v_actor_nome, v_cobranca.paciente_id, 'orcamento', v_cobranca.orcamento_id::text,
      'pagamento.editado', jsonb_build_object('cobranca_id', v_cobranca.id, 'antes', v_antes, 'depois', jsonb_build_object('valor', p_valor, 'forma', p_forma, 'data', p_data)));
    return v_pagamento;
  end if;

  select o.* into v_orc from public.orcamentos o
   where o.id = v_pagamento.orcamento_id and o.clinica_id = v_clinica_id for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then raise exception 'sem_permissao'; end if;
  select coalesce(sum(oi.preco_total) filter (where oi.aprovado), 0) into v_valor_aprovado
   from public.orcamento_itens oi where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  if v_valor_aprovado <= 0 then raise exception 'orcamento_sem_aprovacao'; end if;
  select e.valor_devido into strict v_valor_devido from public.orcamentos_com_estado e where e.id = v_orc.id and e.clinica_id = v_clinica_id;
  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0) into v_valor_pago
   from public.pagamentos p where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id;
  if round((v_valor_pago - v_pagamento.valor + p_valor) * 100) > round(v_valor_devido * 100) then raise exception 'valor_acima_do_saldo'; end if;
  update public.pagamentos set valor = p_valor, forma_pagamento = p_forma, data_pagamento = p_data, marcado_por_id = v_actor_id
   where id = v_pagamento.id and clinica_id = v_clinica_id returning * into v_pagamento;
  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.editado', jsonb_build_object('antes', v_antes, 'depois', jsonb_build_object('valor', p_valor, 'forma', p_forma, 'data', p_data)));
  return v_pagamento;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_cobranca_orcamento(p_orcamento_id uuid, p_item_ids uuid[], p_desconto numeric DEFAULT 0, p_numero_parcelas smallint DEFAULT 1, p_primeiro_vencimento date DEFAULT NULL::date, p_observacoes text DEFAULT NULL::text)
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
  if char_length(p_observacoes) > 2000 then raise exception 'observacao_invalida'; end if;
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

  if coalesce(v_orc.desconto, 0) > 0 or v_orc.valor_acordado is not null then
    raise exception 'orcamento_acordo_global';
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
    numero_parcelas, primeiro_vencimento, observacoes
  ) values (
    v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, v_subtotal, p_desconto, v_valor_final,
    p_numero_parcelas, v_primeiro_vencimento, nullif(btrim(p_observacoes),'')
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

CREATE OR REPLACE FUNCTION public.editar_cobranca_orcamento(p_cobranca_id uuid, p_item_ids uuid[], p_valor_final numeric)
 RETURNS orcamento_cobrancas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_cobranca public.orcamento_cobrancas%rowtype;
  v_orcamento public.orcamentos%rowtype;
  v_item public.orcamento_itens%rowtype;
  v_subtotal numeric := 0;
  v_recebido numeric := 0;
  v_item_count integer := 0;
  v_antes jsonb;
  v_depois jsonb;
begin
  if v_clinica_id is null or v_actor_id is null then raise exception 'sem_permissao'; end if;
  if p_item_ids is null or cardinality(p_item_ids) is null or cardinality(p_item_ids) = 0
     or cardinality(p_item_ids) <> cardinality(array(select distinct unnest(p_item_ids))) then
    raise exception 'itens_invalidos';
  end if;
  if p_valor_final is null or p_valor_final < 0
     or round(p_valor_final * 100) <> p_valor_final * 100 then
    raise exception 'valor_final_invalido';
  end if;

  select c.* into v_cobranca
    from public.orcamento_cobrancas c
   where c.id = p_cobranca_id and c.clinica_id = v_clinica_id
   for update;
  if v_cobranca.id is null or v_cobranca.situacao <> 'aberta'
     or not public.can_act_as_dentista(v_cobranca.dentista_id) then
    raise exception 'cobranca_indisponivel';
  end if;

  select o.* into v_orcamento
    from public.orcamentos o
   where o.id = v_cobranca.orcamento_id and o.clinica_id = v_clinica_id
   for update;
  if v_orcamento.id is null then raise exception 'cobranca_indisponivel'; end if;

  select jsonb_build_object(
    'subtotal', v_cobranca.subtotal,
    'desconto', v_cobranca.desconto,
    'valor_final', v_cobranca.valor_final,
    'item_ids', coalesce(jsonb_agg(ci.orcamento_item_id order by ci.orcamento_item_id), '[]'::jsonb)
  ) into v_antes
  from public.orcamento_cobranca_itens ci
  where ci.cobranca_id = v_cobranca.id
    and ci.clinica_id = v_clinica_id
    and ci.ativo;

  -- Ordem estável reduz disputa entre duas pessoas tentando incluir os mesmos itens.
  for v_item in
    select oi.*
      from public.orcamento_itens oi
     where oi.id = any(p_item_ids)
       and oi.orcamento_id = v_orcamento.id
       and oi.clinica_id = v_clinica_id
     order by oi.id
     for update
  loop
    v_item_count := v_item_count + 1;
    if not v_item.aprovado then raise exception 'item_nao_aprovado'; end if;
    if exists (
      select 1
        from public.orcamento_cobranca_itens ci
        join public.orcamento_cobrancas c on c.id = ci.cobranca_id
       where ci.orcamento_item_id = v_item.id
         and ci.ativo
         and c.situacao = 'aberta'
         and ci.cobranca_id <> v_cobranca.id
    ) then
      raise exception 'item_ja_cobrado';
    end if;
    v_subtotal := v_subtotal + coalesce(v_item.preco_total, 0);
  end loop;

  if v_item_count <> cardinality(p_item_ids) then raise exception 'itens_invalidos'; end if;
  if v_subtotal <= 0 then raise exception 'subtotal_invalido'; end if;
  if p_valor_final > v_subtotal then raise exception 'valor_final_invalido'; end if;

  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_recebido
    from public.pagamentos p
   where p.cobranca_id = v_cobranca.id
     and p.clinica_id = v_clinica_id;
  if p_valor_final < v_recebido then raise exception 'valor_final_abaixo_recebido'; end if;

  update public.orcamento_cobranca_itens
     set ativo = false
   where cobranca_id = v_cobranca.id
     and clinica_id = v_clinica_id
     and ativo
     and not (orcamento_item_id = any(p_item_ids));

  for v_item in
    select oi.*
      from public.orcamento_itens oi
     where oi.id = any(p_item_ids)
       and oi.orcamento_id = v_orcamento.id
       and oi.clinica_id = v_clinica_id
     order by oi.id
  loop
    insert into public.orcamento_cobranca_itens (
      cobranca_id, orcamento_item_id, clinica_id, preco_total_snapshot, ativo
    ) values (
      v_cobranca.id, v_item.id, v_clinica_id, coalesce(v_item.preco_total, 0), true
    ) on conflict (cobranca_id, orcamento_item_id) do update
      set ativo = true,
          preco_total_snapshot = excluded.preco_total_snapshot;
  end loop;

  update public.orcamento_cobrancas
     set subtotal = v_subtotal,
         desconto = v_subtotal - p_valor_final,
         valor_final = p_valor_final,
         updated_at = now()
   where id = v_cobranca.id
     and clinica_id = v_clinica_id
   returning * into v_cobranca;

  perform public.recompor_previsao_cobranca(v_cobranca.id, v_clinica_id, v_actor_id);

  select jsonb_build_object(
    'subtotal', v_cobranca.subtotal,
    'desconto', v_cobranca.desconto,
    'valor_final', v_cobranca.valor_final,
    'item_ids', coalesce(jsonb_agg(ci.orcamento_item_id order by ci.orcamento_item_id), '[]'::jsonb)
  ) into v_depois
  from public.orcamento_cobranca_itens ci
  where ci.cobranca_id = v_cobranca.id
    and ci.clinica_id = v_clinica_id
    and ci.ativo;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_cobranca.paciente_id, 'orcamento', v_cobranca.orcamento_id::text,
    'cobranca.etapa_editada', jsonb_build_object(
      'cobranca_id', v_cobranca.id,
      'recebido_preservado', v_recebido,
      'antes', v_antes,
      'depois', v_depois
    )
  );
  return v_cobranca;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_orcamento(p_orcamento_id uuid, p_valor numeric, p_forma text, p_data date)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orc public.orcamentos%rowtype;
  v_valor_aprovado numeric := 0;
  v_valor_devido numeric := 0;
  v_valor_pago numeric := 0;
  v_pagamento public.pagamentos%rowtype;
begin
  if p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100 then
    raise exception 'valor_invalido';
  end if;
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then
    raise exception 'forma_invalida';
  end if;

  select o.* into v_orc
    from public.orcamentos o
   where o.id = p_orcamento_id and o.clinica_id = v_clinica_id
   for update;

  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then
    raise exception 'sem_permissao';
  end if;

  select coalesce(sum(oi.preco_total) filter (where oi.aprovado), 0)
    into v_valor_aprovado
    from public.orcamento_itens oi
   where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  if v_valor_aprovado <= 0 then raise exception 'orcamento_sem_aprovacao'; end if;

  select e.valor_devido into strict v_valor_devido from public.orcamentos_com_estado e where e.id = v_orc.id and e.clinica_id = v_clinica_id;
  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_valor_pago
    from public.pagamentos p
   where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id;
  if round((v_valor_pago + p_valor) * 100) > round(v_valor_devido * 100) then
    raise exception 'valor_acima_do_saldo';
  end if;

  insert into public.pagamentos (
    clinica_id, orcamento_id, paciente_id, dentista_id, valor, status,
    forma_pagamento, data_pagamento, marcado_por_id
  ) values (
    v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, p_valor, 'pago',
    p_forma, p_data, v_actor_id
  ) returning * into v_pagamento;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.registrado', jsonb_build_object('valor', p_valor, 'forma', p_forma, 'orcamento_id', v_orc.id)
  );

  return v_pagamento;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reorganizar_parcelas_orcamento(p_orcamento_id uuid, p_valor_acordado numeric, p_parcelas jsonb)
 RETURNS SETOF pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orc public.orcamentos%rowtype;
  v_valor_aprovado numeric := 0;
  v_valor_pago numeric := 0;
  v_saldo numeric := 0;
  v_soma numeric := 0;
  v_quantidade integer := 0;
  v_indice integer := 0;
  v_item jsonb;
  v_valor numeric;
  v_data date;
begin
  if p_valor_acordado is null or p_valor_acordado <= 0 or round(p_valor_acordado * 100) <> p_valor_acordado * 100 then
    raise exception 'valor_invalido';
  end if;
  if jsonb_typeof(p_parcelas) <> 'array' then raise exception 'parcelas_invalidas'; end if;
  v_quantidade := jsonb_array_length(p_parcelas);
  if v_quantidade > 24 then raise exception 'numero_parcelas_invalido'; end if;

  select o.* into v_orc
    from public.orcamentos o
   where o.id = p_orcamento_id and o.clinica_id = v_clinica_id
   for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then
    raise exception 'sem_permissao';
  end if;
  select coalesce(sum(oi.preco_total) filter (where oi.aprovado), 0)
    into v_valor_aprovado
    from public.orcamento_itens oi
   where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  if v_valor_aprovado <= 0 then raise exception 'orcamento_sem_aprovacao'; end if;
  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_valor_pago
    from public.pagamentos p
   where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id;
  if round(p_valor_acordado * 100) < round(v_valor_pago * 100) then raise exception 'valor_menor_que_recebido'; end if;
  v_saldo := p_valor_acordado - v_valor_pago;

  for v_item in select value from jsonb_array_elements(p_parcelas) loop
    begin
      v_valor := (v_item ->> 'valor')::numeric;
      v_data := (v_item ->> 'data_vencimento')::date;
    exception when others then
      raise exception 'parcelas_invalidas';
    end;
    if v_valor is null or v_valor <= 0 or round(v_valor * 100) <> v_valor * 100 or v_data is null then
      raise exception 'parcelas_invalidas';
    end if;
    v_soma := v_soma + v_valor;
  end loop;
  if v_quantidade > 0 and round(v_soma * 100) <> round(v_saldo * 100) then
    raise exception 'parcelas_nao_fecham_saldo';
  end if;

  update public.pagamentos
     set status = 'cancelado', observacoes = concat_ws(E'\n', observacoes, 'Previsão substituída em ' || to_char(now(), 'YYYY-MM-DD HH24:MI'))
   where orcamento_id = v_orc.id and clinica_id = v_clinica_id and status = 'pendente';

  update public.orcamentos
     set valor_acordado = p_valor_acordado,
         plano_forma = case when v_quantidade = 0 then 'avista' else 'parcelado' end,
         plano_parcelas = case when v_quantidade = 0 then null else v_quantidade end,
         plano_entrada_valor = null,
         plano_entrada_forma = null,
         plano_parcelas_forma = null,
         plano_definido_em = now(),
         plano_definido_por_id = v_actor_id
   where id = v_orc.id and clinica_id = v_clinica_id;

  if v_quantidade = 0 and v_saldo > 0 then
    insert into public.pagamentos (
      clinica_id, orcamento_id, paciente_id, dentista_id, valor, status, data_vencimento
    ) values (
      v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, v_saldo, 'pendente',
      (now() at time zone 'America/Sao_Paulo')::date
    );
  end if;

  v_indice := 0;
  for v_item in select value from jsonb_array_elements(p_parcelas) loop
    v_indice := v_indice + 1;
    v_valor := (v_item ->> 'valor')::numeric;
    v_data := (v_item ->> 'data_vencimento')::date;
    insert into public.pagamentos (
      clinica_id, orcamento_id, paciente_id, dentista_id, valor, status,
      data_vencimento, parcela_numero, total_parcelas
    ) values (
      v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, v_valor, 'pendente',
      v_data, v_indice, v_quantidade
    );
  end loop;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.previsao_reorganizada', jsonb_build_object('valor_acordado', p_valor_acordado, 'parcelas', p_parcelas)
  );

  return query
    select p.* from public.pagamentos p
     where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id and p.status = 'pendente'
     order by p.parcela_numero nulls first, p.data_vencimento;
end;
$function$;

revoke all on function public.aceitar_orcamento(uuid, text, text) from public, anon;
grant execute on function public.aceitar_orcamento(uuid, text, text) to authenticated, service_role;
revoke all on function public.adicionar_itens_orcamento_com_eventos(uuid, jsonb) from public, anon;
grant execute on function public.adicionar_itens_orcamento_com_eventos(uuid, jsonb) to authenticated, service_role;
revoke all on function public.confirmar_previsao_orcamento(uuid, text, date) from public, anon;
grant execute on function public.confirmar_previsao_orcamento(uuid, text, date) to authenticated, service_role;
revoke all on function public.corrigir_recebimento_orcamento(uuid, numeric, text, date) from public, anon;
grant execute on function public.corrigir_recebimento_orcamento(uuid, numeric, text, date) to authenticated, service_role;
revoke all on function public.criar_cobranca_orcamento(uuid, uuid[], numeric, smallint, date, text) from public, anon;
grant execute on function public.criar_cobranca_orcamento(uuid, uuid[], numeric, smallint, date, text) to authenticated, service_role;
revoke all on function public.editar_cobranca_orcamento(uuid, uuid[], numeric) from public, anon;
grant execute on function public.editar_cobranca_orcamento(uuid, uuid[], numeric) to authenticated, service_role;
revoke all on function public.registrar_recebimento_orcamento(uuid, numeric, text, date) from public, anon;
grant execute on function public.registrar_recebimento_orcamento(uuid, numeric, text, date) to authenticated, service_role;
revoke all on function public.reorganizar_parcelas_orcamento(uuid, numeric, jsonb) from public, anon;
grant execute on function public.reorganizar_parcelas_orcamento(uuid, numeric, jsonb) to authenticated, service_role;

create or replace view public.orcamentos_com_estado with (security_invoker = true) as
 SELECT o.id,
    o.clinica_id,
    o.ficha_id,
    o.paciente_id,
    o.dentista_id,
    o.status,
    o.validade_dias,
    o.condicoes_pagamento,
    o.total,
    o.pdf_url,
    o.enviado_em,
    o.created_at,
    o.updated_at,
    o.desconto,
    o.aprovado_por_id,
    o.aprovado_em,
    o.plano_forma,
    o.plano_parcelas,
    o.plano_entrada_valor,
    o.plano_entrada_forma,
    o.plano_parcelas_forma,
    o.valor_acordado,
    o.plano_definido_em,
    o.plano_definido_por_id,
    o.mostrar_valor_por_item,
    COALESCE(ai.soma_aprovada, 0::numeric) AS valor_aprovado,
    COALESCE(pg.total_pago, 0::numeric) AS valor_pago,
    devido.valor AS valor_devido,
        CASE
            WHEN COALESCE(ai.soma_aprovada, 0::numeric) = 0::numeric THEN 'proposto'::text
            WHEN COALESCE(pg.total_pago, 0::numeric) < devido.valor THEN 'aceito'::text
            ELSE 'quitado'::text
        END AS estado
   FROM orcamentos o
     LEFT JOIN LATERAL ( SELECT sum(oi.preco_total) AS soma_aprovada
           FROM orcamento_itens oi
          WHERE oi.orcamento_id = o.id AND oi.clinica_id = o.clinica_id AND oi.aprovado) ai ON true
     LEFT JOIN LATERAL ( SELECT sum(p.valor) AS total_pago
           FROM pagamentos p
          WHERE p.orcamento_id = o.id AND p.clinica_id = o.clinica_id AND p.status = 'pago'::text) pg ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS quantidade,
            sum(c.desconto) AS desconto
           FROM orcamento_cobrancas c
          WHERE c.orcamento_id = o.id AND c.clinica_id = o.clinica_id AND c.situacao = 'aberta'::text) etapas ON true
     CROSS JOIN LATERAL ( SELECT COALESCE(o.valor_acordado, GREATEST(0::numeric, COALESCE(ai.soma_aprovada, 0::numeric) -
                CASE
                    WHEN etapas.quantidade > 0 THEN COALESCE(etapas.desconto, 0::numeric)
                    ELSE COALESCE(o.desconto, 0::numeric)
                END)) AS valor) devido;

notify pgrst, 'reload schema';
commit;
