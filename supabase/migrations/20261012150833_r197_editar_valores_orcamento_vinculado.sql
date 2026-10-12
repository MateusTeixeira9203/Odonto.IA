begin;
set local lock_timeout = '5s';

-- R-197: a edição de preço e quantidade de um orçamento originado na Ficha não
-- pode apagar/recriar itens. `orcamento_eventos.item_id` e a trilha comercial
-- dependem da identidade do item original.
create or replace function public.editar_valores_orcamento_vinculado(
  p_orcamento_id uuid,
  p_itens jsonb,
  p_versao_esperada timestamptz
)
returns table(total numeric, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orcamento public.orcamentos%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_quantidade integer;
  v_preco_unitario numeric;
  v_ids_atuais uuid[] := '{}'::uuid[];
  v_ids_recebidos uuid[] := '{}'::uuid[];
  v_itens_antes jsonb := '[]'::jsonb;
  v_itens_depois jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_updated_at timestamptz;
begin
  if auth.uid() is null
    or v_clinica_id is null
    or v_actor_id is null
    -- get_my_role() aceita fallback de dentistas legados mesmo quando a
    -- participação foi suspensa. Para esta escrita financeira, o vínculo
    -- ativo na clínica precisa ser verificado diretamente.
    or not exists (
      select 1 from public.clinica_usuarios cu
       where cu.usuario_id = auth.uid()
         and cu.clinica_id = v_clinica_id
         and cu.status = 'ativo'
         and cu.role in ('admin', 'dentista')
    )
    or not exists (
      select 1 from public.dentistas d
       where d.id = v_actor_id
         and d.user_id = auth.uid()
         and d.clinica_id = v_clinica_id
         and d.ativo = true
         and d.role in ('admin', 'dentista')
    ) then
    raise exception 'sem_permissao';
  end if;

  if p_versao_esperada is null
    or p_itens is null
    or jsonb_typeof(p_itens) <> 'array'
    or jsonb_array_length(p_itens) < 1
    or jsonb_array_length(p_itens) > 100 then
    raise exception 'itens_invalidos';
  end if;

  -- Primeiro trava o agregado; as linhas filhas são travadas em ordem estável
  -- logo abaixo para não competir com R-169b/R-172 em ordem inversa.
  select o.* into v_orcamento
    from public.orcamentos o
   where o.id = p_orcamento_id
     and o.clinica_id = v_clinica_id
   for update;

  if v_orcamento.id is null
    or v_orcamento.dentista_id is distinct from v_actor_id then
    raise exception 'sem_permissao';
  end if;
  if v_orcamento.ficha_id is null then
    raise exception 'orcamento_nao_vinculado';
  end if;
  if v_orcamento.updated_at is distinct from p_versao_esperada then
    raise exception 'conflito';
  end if;

  perform i.id
    from public.orcamento_itens i
   where i.orcamento_id = v_orcamento.id
     and i.clinica_id = v_clinica_id
   order by i.id
   for update;

  -- R-169b preserva retirada e composição de grupo como fatos clínicos. A
  -- edição restrita de valores não pode reinterpretar esses itens.
  if exists (
      select 1
        from public.orcamento_itens i
       where i.orcamento_id = v_orcamento.id
         and i.clinica_id = v_clinica_id
         and i.retirado_em is not null
    ) then
    raise exception 'orcamento_itens_retirados';
  end if;
  if exists (
      select 1
        from public.orcamento_itens i
       where i.orcamento_id = v_orcamento.id
         and i.clinica_id = v_clinica_id
         and i.retirado_em is null
         and i.composicao is not null
    ) then
    raise exception 'orcamento_itens_com_composicao';
  end if;

  -- Histórico comercial pertence ao contrato de revisão R-172. Esta RPC nunca
  -- altera um acordo, cobrança, parcela, recebimento, aceite ou aprovação.
  if exists (
      select 1
        from public.orcamento_itens i
       where i.orcamento_id = v_orcamento.id
         and i.clinica_id = v_clinica_id
         and i.retirado_em is null
         and i.aprovado
    )
    or v_orcamento.status = 'aprovado'
    or v_orcamento.valor_acordado is not null
    or v_orcamento.plano_forma is not null
    or exists (
      select 1 from public.assinaturas a
       where a.orcamento_id = v_orcamento.id
         and a.clinica_id = v_clinica_id
    )
    or exists (
      select 1 from public.orcamento_cobrancas c
       where c.orcamento_id = v_orcamento.id
         and c.clinica_id = v_clinica_id
    )
    or exists (
      select 1 from public.pagamentos p
       where p.orcamento_id = v_orcamento.id
         and p.clinica_id = v_clinica_id
    ) then
    raise exception 'orcamento_com_historico_comercial';
  end if;

  select coalesce(array_agg(i.id order by i.id), '{}'::uuid[])
    into v_ids_atuais
    from public.orcamento_itens i
   where i.orcamento_id = v_orcamento.id
     and i.clinica_id = v_clinica_id
     and i.retirado_em is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'quantidade', i.quantidade,
    'precoUnitario', i.preco_unitario,
    'precoTotal', i.preco_total
  ) order by i.id), '[]'::jsonb)
    into v_itens_antes
    from public.orcamento_itens i
   where i.orcamento_id = v_orcamento.id
     and i.clinica_id = v_clinica_id
     and i.retirado_em is null;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    begin
      v_item_id := nullif(v_item ->> 'id', '')::uuid;
      v_quantidade := nullif(v_item ->> 'quantidade', '')::integer;
      v_preco_unitario := nullif(v_item ->> 'preco_unitario', '')::numeric;
    exception when others then
      raise exception 'itens_invalidos';
    end;

    if v_item_id is null
      or v_quantidade is null
      or v_quantidade < 1
      or v_quantidade > 99
      or v_preco_unitario is null
      or v_preco_unitario < 0
      or v_preco_unitario > 999999.99
      or round(v_preco_unitario * 100) <> v_preco_unitario * 100 then
      raise exception 'itens_invalidos';
    end if;

    if not (v_item_id = any(v_ids_atuais)) then
      raise exception 'item_invalido';
    end if;
    if v_item_id = any(v_ids_recebidos) then
      raise exception 'item_duplicado';
    end if;
    v_ids_recebidos := array_append(v_ids_recebidos, v_item_id);
  end loop;

  if cardinality(v_ids_recebidos) <> cardinality(v_ids_atuais) then
    raise exception 'itens_incompletos';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_item_id := (v_item ->> 'id')::uuid;
    v_quantidade := (v_item ->> 'quantidade')::integer;
    v_preco_unitario := (v_item ->> 'preco_unitario')::numeric;

    update public.orcamento_itens
       set quantidade = v_quantidade,
           preco_unitario = v_preco_unitario,
           preco_total = v_quantidade * v_preco_unitario
     where id = v_item_id
       and orcamento_id = v_orcamento.id
       and clinica_id = v_clinica_id
       and retirado_em is null;
    if not found then
      raise exception 'item_invalido';
    end if;
  end loop;

  select coalesce(sum(i.preco_total), 0)
    into v_subtotal
    from public.orcamento_itens i
   where i.orcamento_id = v_orcamento.id
     and i.clinica_id = v_clinica_id
     and i.retirado_em is null;
  v_total := greatest(0, v_subtotal - coalesce(v_orcamento.desconto, 0));

  update public.orcamentos o
     set total = v_total
   where o.id = v_orcamento.id
     and o.clinica_id = v_clinica_id
  returning o.updated_at into v_updated_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'quantidade', i.quantidade,
    'precoUnitario', i.preco_unitario,
    'precoTotal', i.preco_total
  ) order by i.id), '[]'::jsonb)
    into v_itens_depois
    from public.orcamento_itens i
   where i.orcamento_id = v_orcamento.id
     and i.clinica_id = v_clinica_id
     and i.retirado_em is null;

  select d.nome into v_actor_nome
    from public.dentistas d
   where d.id = v_actor_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_actor_id, v_actor_nome, v_orcamento.paciente_id,
    'orcamento', v_orcamento.id::text, 'orcamento.editado',
    jsonb_build_object(
      'alteracao', 'valores_itens_vinculados',
      'itemIds', v_ids_recebidos,
      'totalAnterior', v_orcamento.total,
      'totalNovo', v_total,
      'itensAntes', v_itens_antes,
      'itensDepois', v_itens_depois
    )
  );

  return query select v_total, v_updated_at;
end;
$$;

revoke all on function public.editar_valores_orcamento_vinculado(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.editar_valores_orcamento_vinculado(uuid, jsonb, timestamptz) to authenticated;

commit;
