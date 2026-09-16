-- Snapshot das cinco RPCs do Free em 15/09/2026, após R169.
-- Apenas fixture local: garante que a autorização não substitui cálculos vigentes.
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
   where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id and oi.retirado_em is null;
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
   from public.orcamento_itens oi where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id and oi.retirado_em is null;
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

CREATE OR REPLACE FUNCTION public.estornar_recebimento_orcamento(p_pagamento_id uuid, p_motivo text)
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
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if v_motivo = '' or length(v_motivo) > 500 then raise exception 'motivo_invalido'; end if;
  select p.* into v_pagamento from public.pagamentos p
   where p.id = p_pagamento_id and p.clinica_id = v_clinica_id;
  if v_pagamento.id is null or v_pagamento.status <> 'pago' then raise exception 'recebimento_indisponivel'; end if;

  if v_pagamento.cobranca_id is not null then
    select c.* into v_cobranca from public.orcamento_cobrancas c
     where c.id = v_pagamento.cobranca_id and c.clinica_id = v_clinica_id for update;
    if v_cobranca.id is null or v_cobranca.situacao <> 'aberta'
       or not public.can_act_as_dentista(v_cobranca.dentista_id) then raise exception 'cobranca_indisponivel'; end if;
    update public.pagamentos set status = 'cancelado', observacoes = concat_ws(E'\n', observacoes, 'Estorno: ' || v_motivo), marcado_por_id = v_actor_id
     where id = v_pagamento.id and clinica_id = v_clinica_id returning * into v_pagamento;
    perform public.recompor_previsao_cobranca(v_cobranca.id, v_clinica_id, v_actor_id);
    select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
    insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
    values (v_clinica_id, v_actor_id, v_actor_nome, v_cobranca.paciente_id, 'orcamento', v_cobranca.orcamento_id::text,
      'pagamento.estornado', jsonb_build_object('cobranca_id', v_cobranca.id, 'valor', v_pagamento.valor, 'motivo', v_motivo));
    return v_pagamento;
  end if;

  select o.* into v_orc from public.orcamentos o
   where o.id = v_pagamento.orcamento_id and o.clinica_id = v_clinica_id for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then raise exception 'sem_permissao'; end if;
  update public.pagamentos set status = 'cancelado', observacoes = concat_ws(E'\n', observacoes, 'Estorno: ' || v_motivo), marcado_por_id = v_actor_id
   where id = v_pagamento.id and clinica_id = v_clinica_id returning * into v_pagamento;
  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.estornado', jsonb_build_object('valor', v_pagamento.valor, 'motivo', v_motivo, 'orcamento_id', v_orc.id));
  return v_pagamento;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_cobranca(p_cobranca_id uuid, p_valor numeric, p_forma text, p_data date)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_cobranca public.orcamento_cobrancas%rowtype;
  v_pago numeric := 0;
  v_pagamento public.pagamentos%rowtype;
begin
  if p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100 then raise exception 'valor_invalido'; end if;
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then raise exception 'forma_invalida'; end if;

  select c.* into v_cobranca
    from public.orcamento_cobrancas c
   where c.id = p_cobranca_id and c.clinica_id = v_clinica_id
   for update;
  if v_cobranca.id is null or v_cobranca.situacao <> 'aberta'
     or not public.can_act_as_dentista(v_cobranca.dentista_id) then raise exception 'cobranca_indisponivel'; end if;
  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_pago from public.pagamentos p
   where p.cobranca_id = v_cobranca.id and p.clinica_id = v_clinica_id;
  if round((v_pago + p_valor) * 100) > round(v_cobranca.valor_final * 100) then raise exception 'valor_acima_do_saldo'; end if;

  insert into public.pagamentos (
    clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status,
    forma_pagamento, data_pagamento, marcado_por_id
  ) values (
    v_clinica_id, v_cobranca.orcamento_id, v_cobranca.id, v_cobranca.paciente_id,
    v_cobranca.dentista_id, p_valor, 'pago', p_forma, p_data, v_actor_id
  ) returning * into v_pagamento;
  perform public.recompor_previsao_cobranca(v_cobranca.id, v_clinica_id, v_actor_id);

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_cobranca.paciente_id, 'orcamento', v_cobranca.orcamento_id::text,
    'pagamento.registrado', jsonb_build_object('cobranca_id', v_cobranca.id, 'valor', p_valor, 'forma', p_forma)
  );
  return v_pagamento;
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
   where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id and oi.retirado_em is null;
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
