-- R-167 — corrige uma cobrança por etapa sem apagar o dinheiro já recebido.
-- Não reescreve dados históricos: somente vínculos da etapa e previsões pendentes mudam.

create or replace function public.editar_cobranca_orcamento(
  p_cobranca_id uuid,
  p_item_ids uuid[],
  p_valor_final numeric
) returns public.orcamento_cobrancas
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.editar_cobranca_orcamento(uuid, uuid[], numeric) from public, anon;
grant execute on function public.editar_cobranca_orcamento(uuid, uuid[], numeric) to authenticated;
