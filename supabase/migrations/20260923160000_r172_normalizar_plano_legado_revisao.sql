-- R-172 — corrige orçamentos legados cujo plano de pagamento não atende ao
-- contrato atual. A revisão comercial precisa conseguir tocar o total sem
-- alterar recebimentos já registrados.

create or replace function public.revisar_orcamento_aceito(
  p_orcamento_id uuid,
  p_itens jsonb,
  p_valor_acordado numeric,
  p_versao_esperada timestamptz
)
returns table(total numeric, valor_acordado numeric, valor_recebido numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orc public.orcamentos%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_descricao text;
  v_quantidade integer;
  v_preco_unitario numeric;
  v_ids_atuais uuid[] := '{}';
  v_ids_recebidos uuid[] := '{}';
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_pago numeric := 0;
  v_pendentes integer := 0;
  v_saldo_centavos bigint := 0;
  v_base_centavos bigint := 0;
  v_resto_centavos bigint := 0;
  v_parcelas jsonb := '[]'::jsonb;
  v_itens_antes jsonb := '[]'::jsonb;
  v_itens_depois jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_clinica_id is null or v_actor_id is null then
    raise exception 'sem_permissao';
  end if;
  if p_versao_esperada is null then raise exception 'conflito'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) < 1 or jsonb_array_length(p_itens) > 100 then
    raise exception 'itens_invalidos';
  end if;
  if p_valor_acordado is null or p_valor_acordado <= 0 or round(p_valor_acordado * 100) <> p_valor_acordado * 100 then
    raise exception 'valor_invalido';
  end if;

  select o.* into v_orc
  from public.orcamentos o
  where o.id = p_orcamento_id and o.clinica_id = v_clinica_id
  for update;

  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then
    raise exception 'sem_permissao';
  end if;
  if v_orc.updated_at <> p_versao_esperada then raise exception 'conflito'; end if;

  select coalesce(array_agg(i.id order by i.id), '{}')
    into v_ids_atuais
  from public.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.clinica_id = v_clinica_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'descricao', i.descricao,
    'quantidade', i.quantidade,
    'precoUnitario', i.preco_unitario,
    'precoTotal', i.preco_total,
    'aprovado', i.aprovado
  ) order by i.created_at, i.id), '[]'::jsonb)
    into v_itens_antes
  from public.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.clinica_id = v_clinica_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    begin
      v_item_id := nullif(v_item ->> 'id', '')::uuid;
      v_descricao := btrim(coalesce(v_item ->> 'descricao', ''));
      v_quantidade := nullif(v_item ->> 'quantidade', '')::integer;
      v_preco_unitario := nullif(v_item ->> 'preco_unitario', '')::numeric;
    exception when others then
      raise exception 'itens_invalidos';
    end;

    if v_descricao = '' or char_length(v_descricao) > 500
      or v_quantidade is null or v_quantidade < 1 or v_quantidade > 99
      or v_preco_unitario is null or v_preco_unitario < 0
      or round(v_preco_unitario * 100) <> v_preco_unitario * 100 then
      raise exception 'itens_invalidos';
    end if;

    if v_item_id is not null then
      if not (v_item_id = any(v_ids_atuais)) or v_item_id = any(v_ids_recebidos) then
        raise exception 'item_invalido';
      end if;
      v_ids_recebidos := array_append(v_ids_recebidos, v_item_id);
    end if;
  end loop;

  if cardinality(v_ids_recebidos) <> cardinality(v_ids_atuais) then
    raise exception 'itens_incompletos';
  end if;

  select coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    into v_pago
  from public.pagamentos p
  where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id;
  if p_valor_acordado < v_pago then raise exception 'valor_menor_que_recebido'; end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    v_descricao := btrim(v_item ->> 'descricao');
    v_quantidade := (v_item ->> 'quantidade')::integer;
    v_preco_unitario := (v_item ->> 'preco_unitario')::numeric;

    if v_item_id is null then
      insert into public.orcamento_itens (
        clinica_id, orcamento_id, descricao, quantidade,
        preco_unitario, preco_total, aprovado
      ) values (
        v_clinica_id, v_orc.id, v_descricao, v_quantidade,
        v_preco_unitario, v_quantidade * v_preco_unitario, true
      );
    else
      update public.orcamento_itens
         set descricao = v_descricao,
             quantidade = v_quantidade,
             preco_unitario = v_preco_unitario,
             preco_total = v_quantidade * v_preco_unitario
       where id = v_item_id
         and orcamento_id = v_orc.id
         and clinica_id = v_clinica_id;
    end if;
  end loop;

  select coalesce(sum(i.preco_total), 0)
    into v_subtotal
  from public.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.clinica_id = v_clinica_id;
  v_total := greatest(0, v_subtotal - coalesce(v_orc.desconto, 0));

  -- Alguns orçamentos anteriores ao contrato de plano mantêm `parcelado` com
  -- uma (ou nenhuma) parcela. Corrige apenas os metadados inválidos ao tocar a
  -- linha, preservando todas as cobranças e os valores efetivamente recebidos.
  update public.orcamentos
     set total = v_total,
         plano_forma = case
           when plano_forma = 'parcelado' and plano_parcelas between 2 and 24 then 'parcelado'
           when plano_forma = 'parcelado' then null
           else plano_forma
         end,
         plano_parcelas = case
           when plano_forma = 'parcelado' and plano_parcelas between 2 and 24 then plano_parcelas
           else null
         end
   where id = v_orc.id and clinica_id = v_clinica_id;

  select count(*) into v_pendentes
  from public.pagamentos p
  where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id and p.status = 'pendente';

  if v_pendentes > 1 then
    v_saldo_centavos := round((p_valor_acordado - v_pago) * 100)::bigint;
    if v_saldo_centavos > 0 then
      v_base_centavos := v_saldo_centavos / v_pendentes;
      v_resto_centavos := v_saldo_centavos % v_pendentes;
      select coalesce(jsonb_agg(jsonb_build_object(
        'valor', (v_base_centavos + case when posicao = v_pendentes then v_resto_centavos else 0 end)::numeric / 100,
        'data_vencimento', data_vencimento
      ) order by posicao), '[]'::jsonb)
        into v_parcelas
      from (
        select p.data_vencimento,
          row_number() over (order by p.parcela_numero nulls last, p.data_vencimento, p.created_at) as posicao
        from public.pagamentos p
        where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id and p.status = 'pendente'
      ) pendentes;
    end if;

    perform public.reorganizar_parcelas_orcamento(v_orc.id, p_valor_acordado, v_parcelas);
  elsif v_pendentes = 1 and p_valor_acordado > v_pago then
    update public.pagamentos
       set valor = p_valor_acordado - v_pago
     where orcamento_id = v_orc.id and clinica_id = v_clinica_id and status = 'pendente';
    update public.orcamentos
       set valor_acordado = p_valor_acordado,
           plano_forma = 'avista',
           plano_parcelas = null,
           plano_entrada_valor = null,
           plano_entrada_forma = null,
           plano_parcelas_forma = null,
           plano_definido_em = now(),
           plano_definido_por_id = v_actor_id
     where id = v_orc.id and clinica_id = v_clinica_id;
  elsif v_pendentes = 1 then
    perform public.reorganizar_parcelas_orcamento(v_orc.id, p_valor_acordado, '[]'::jsonb);
  else
    update public.orcamentos
       set valor_acordado = p_valor_acordado
     where id = v_orc.id and clinica_id = v_clinica_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'descricao', i.descricao,
    'quantidade', i.quantidade,
    'precoUnitario', i.preco_unitario,
    'precoTotal', i.preco_total,
    'aprovado', i.aprovado
  ) order by i.created_at, i.id), '[]'::jsonb)
    into v_itens_depois
  from public.orcamento_itens i
  where i.orcamento_id = v_orc.id and i.clinica_id = v_clinica_id;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'orcamento.editado', jsonb_build_object(
      'alteracao', 'revisao_aceita',
      'confirmadoComoAceito', true,
      'totalAnterior', v_orc.total,
      'totalNovo', v_total,
      'valorAcordadoAnterior', v_orc.valor_acordado,
      'valorAcordadoNovo', p_valor_acordado,
      'valorRecebido', v_pago,
      'itensAntes', v_itens_antes,
      'itensDepois', v_itens_depois
    )
  );

  return query select v_total, p_valor_acordado, v_pago;
end;
$$;

revoke all on function public.revisar_orcamento_aceito(uuid, jsonb, numeric, timestamptz) from public, anon;
grant execute on function public.revisar_orcamento_aceito(uuid, jsonb, numeric, timestamptz) to authenticated;
