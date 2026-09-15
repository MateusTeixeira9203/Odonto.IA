-- Private Free-compatible substitute for 20260914210240_r169b_ficha_orcamento_incremental.sql.
-- The historical migration remains unchanged. Apply this file in its place as R169 step 3.
-- Usage: run only after R169 step 2; then continue unchanged with steps 4–7.
-- Verified on Free after all seven steps: view hash 04cdd43590fc1bf986cf76310604c0d7;
-- criar_cobranca_orcamento 85c7c5dcbfb9cb56713426c000040258;
-- editar_cobranca_orcamento eed4d65fcc703fa82f354776dfc78996;
-- aceitar_orcamento 520a79615795990928e77b553a04cd5f.
-- R163a added orcamentos.titular_recebimento after this view's original 29-column
-- contract existed. Explicit projection preserves all public view names and ordinals,
-- then appends titular_recebimento as column 30 rather than inserting it at 26.
begin;
set local lock_timeout = '5s';

-- R169b: conservar a identidade clínica e comercial sem apagar recebimentos.
alter table public.odontograma_eventos
  add column if not exists retirado_em timestamptz,
  add column if not exists retirado_por uuid references public.dentistas(id);
alter table public.orcamento_itens
  add column if not exists retirado_em timestamptz,
  add column if not exists retirado_por uuid references public.dentistas(id);
alter table public.orcamento_eventos
  add column if not exists item_id uuid references public.orcamento_itens(id),
  add column if not exists retirado_em timestamptz,
  add column if not exists retirado_por uuid references public.dentistas(id);

create index if not exists orcamento_eventos_ativos_por_evento_idx
  on public.orcamento_eventos(clinica_id, evento_id) where retirado_em is null;
create index if not exists odontograma_eventos_ficha_ativos_idx
  on public.odontograma_eventos(clinica_id, ficha_id) where retirado_em is null;

create or replace function public.validar_item_do_vinculo_orcamento()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.item_id is null then return new; end if;
  if not exists (
    select 1 from public.orcamento_itens oi
    where oi.id = new.item_id
      and oi.orcamento_id = new.orcamento_id
      and oi.clinica_id = new.clinica_id
  ) then
    raise exception 'orcamento_evento_item_invalido';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_item_do_vinculo_orcamento on public.orcamento_eventos;
create trigger validar_item_do_vinculo_orcamento
before insert or update of item_id, orcamento_id, clinica_id on public.orcamento_eventos
for each row execute function public.validar_item_do_vinculo_orcamento();

-- A assinatura existente recebe o item recém-criado, mantendo cliente e RPC compatíveis.
create or replace function public.adicionar_itens_orcamento_com_eventos(
  p_orcamento_id uuid,
  p_itens jsonb
) returns numeric
language plpgsql security definer set search_path = public
as $$
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
  v_item_id uuid;
  v_total_adicionado numeric := 0;
begin
  if auth.uid() is null or v_clinica_id is null then raise exception 'orcamento_sem_contexto'; end if;
  select * into v_orcamento from public.orcamentos o
  where o.id = p_orcamento_id and o.clinica_id = v_clinica_id for update;
  if not found then raise exception 'orcamento_nao_encontrado'; end if;
  if not public.can_act_as_dentista(v_orcamento.dentista_id) then raise exception 'orcamento_sem_permissao'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'orcamento_itens_invalidos'; end if;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_descricao := btrim(coalesce(v_item->>'descricao', ''));
    v_quantidade := nullif(v_item->>'quantidade', '')::integer;
    v_preco_unitario := nullif(v_item->>'preco_unitario', '')::numeric;
    v_procedimento_id := nullif(v_item->>'procedimento_id', '')::uuid;
    if v_descricao = '' or char_length(v_descricao) > 500 or v_quantidade is null or v_quantidade < 1 or v_quantidade > 99 or v_preco_unitario is null or v_preco_unitario < 0 then
      raise exception 'orcamento_item_invalido';
    end if;
    if v_procedimento_id is not null and not exists (select 1 from public.procedimentos pr where pr.id = v_procedimento_id and pr.clinica_id = v_clinica_id) then
      raise exception 'orcamento_procedimento_invalido';
    end if;
    if jsonb_typeof(coalesce(v_item->'evento_ids', '[]'::jsonb)) <> 'array' then raise exception 'orcamento_eventos_invalidos'; end if;
    select coalesce(array_agg(value::text::uuid), '{}') into strict v_evento_ids
    from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb));
    if cardinality(v_evento_ids) <> cardinality(array(select distinct unnest(v_evento_ids))) then raise exception 'orcamento_evento_duplicado'; end if;
    v_todos_evento_ids := v_todos_evento_ids || v_evento_ids;
    v_total_adicionado := v_total_adicionado + (v_quantidade * v_preco_unitario);
  end loop;
  if cardinality(v_todos_evento_ids) <> cardinality(array(select distinct unnest(v_todos_evento_ids))) then raise exception 'orcamento_evento_duplicado'; end if;

  -- Ordem orçamento -> eventos (por id) impede que uma retirada clínica ou outro
  -- orçamento valide o mesmo evento entre a checagem e a inserção do vínculo.
  perform e.id from public.odontograma_eventos e
  where e.clinica_id = v_clinica_id and e.id = any(v_todos_evento_ids)
  order by e.id for update;

  for v_evento_id in select unnest(v_todos_evento_ids) loop
    if not exists (
      select 1 from public.odontograma_eventos e join public.fichas f on f.id = e.ficha_id
      where e.id = v_evento_id and e.clinica_id = v_clinica_id and e.retirado_em is null
        and e.ficha_id = v_orcamento.ficha_id and f.paciente_id = v_orcamento.paciente_id
        and e.origem = 'clinica' and e.status in ('indicado', 'realizado')
        and coalesce(e.encaminhado_para, f.dentista_id) = v_orcamento.dentista_id
    ) then raise exception 'orcamento_evento_invalido'; end if;
    if exists (select 1 from public.orcamento_eventos oe where oe.evento_id = v_evento_id and oe.retirado_em is null) then raise exception 'orcamento_evento_ja_orcado'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    v_descricao := btrim(v_item->>'descricao');
    v_quantidade := (v_item->>'quantidade')::integer;
    v_preco_unitario := (v_item->>'preco_unitario')::numeric;
    v_procedimento_id := nullif(v_item->>'procedimento_id', '')::uuid;
    insert into public.orcamento_itens (orcamento_id, clinica_id, descricao, procedimento_id, quantidade, preco_unitario, preco_total, aprovado)
    values (v_orcamento.id, v_clinica_id, v_descricao, v_procedimento_id, v_quantidade, v_preco_unitario, v_quantidade * v_preco_unitario, false)
    returning id into v_item_id;
    for v_evento_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb)) loop
      insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id, item_id)
      values (v_clinica_id, v_orcamento.id, v_evento_id, v_item_id);
    end loop;
  end loop;
  update public.orcamentos set total = coalesce(total, 0) + v_total_adicionado
  where id = v_orcamento.id and clinica_id = v_clinica_id;
  return v_total_adicionado;
end;
$$;
revoke all on function public.adicionar_itens_orcamento_com_eventos(uuid, jsonb) from public, anon;
grant execute on function public.adicionar_itens_orcamento_com_eventos(uuid, jsonb) to authenticated;

create or replace function public.retirar_evento_ficha_orcamento(p_evento_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_role text := public.get_my_role();
  v_evento public.odontograma_eventos%rowtype;
  v_ficha_assinada timestamptz;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') or v_caller is null then raise exception 'sem_permissao'; end if;
  -- Todas as mutações da ficha tomam o lock da ficha antes do evento. Isso evita
  -- ciclo com adicionar/assinar/renomear, que já usam Ficha -> Evento.
  select e.* into v_evento from public.odontograma_eventos e where e.id = p_evento_id and e.clinica_id = v_clinica_id;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  select assinado_em into v_ficha_assinada from public.fichas where id = v_evento.ficha_id and clinica_id = v_clinica_id for update;
  select e.* into v_evento from public.odontograma_eventos e where e.id = p_evento_id and e.clinica_id = v_clinica_id and e.ficha_id = v_evento.ficha_id for update;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  if v_caller is distinct from v_evento.dentista_id or v_evento.assinatura_id is not null or v_ficha_assinada is not null then raise exception 'registro_bloqueado'; end if;
  if v_evento.retirado_em is not null then return; end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  update public.odontograma_eventos set retirado_em = now(), retirado_por = v_caller where id = p_evento_id and clinica_id = v_clinica_id;
  -- A ficha mantém os campos legados como projeção dos eventos ativos. A mesma
  -- derivação é usada pela inclusão incremental, na transação e sob o lock da ficha.
  with eventos as (
    select e.dente, e.status, row_number() over (order by e.created_at, e.id) as ordem,
      nullif(btrim(e.observacao), '') as observacao,
      coalesce(nullif(btrim(e.procedimento_nome), ''),
        case when e.tipo = 'outro' then nullif(btrim(e.observacao), '') end,
        case e.tipo
          when 'carie_restauracao' then 'Restauração' when 'exodontia' then 'Extração'
          when 'endodontia' then 'Canal' when 'lesao_periapical' then 'Lesão periapical'
          when 'implante' then 'Implante' when 'coroa' then 'Coroa total' when 'ponte' then 'Ponte'
          when 'selante' then 'Selante' when 'inclusao' then 'Incluso' when 'esfoliacao' then 'Esfoliado'
          when 'fratura' then 'Fratura' when 'pino_nucleo' then 'Pino/núcleo' when 'profilaxia' then 'Profilaxia'
          when 'raspagem' then 'Raspagem' when 'clareamento' then 'Clareamento' when 'fluor' then 'Flúor'
          when 'exame_periodontal' then 'Exame periodontal' else 'Outro procedimento' end
      ) as rotulo
    from public.odontograma_eventos e
    where e.ficha_id = v_evento.ficha_id and e.clinica_id = v_clinica_id and e.retirado_em is null
  ), rotulos as (
    select rotulo, min(ordem) as ordem from eventos group by rotulo
  ), por_dente as (
    select dente, string_agg(case when observacao is not null and observacao <> rotulo
      then rotulo || ' (' || observacao || ')' else rotulo end, E'\n' order by ordem) as texto
    from eventos where dente is not null group by dente
  ), dentes as (
    select distinct dente from eventos where dente is not null
  )
  update public.fichas
  set dentes_afetados = array(select dente::integer from dentes order by dente)::integer[],
      dentes_observacoes = coalesce((select jsonb_object_agg(dente::text, texto) from por_dente), '{}'::jsonb),
      procedimentos = array(select rotulo from rotulos order by ordem),
      status = case when exists (select 1 from eventos where status = 'indicado') then 'aberta' else 'concluida' end,
      updated_at = now()
  where id = v_evento.ficha_id and clinica_id = v_clinica_id;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_evento.paciente_id, 'odontograma_evento', p_evento_id::text, 'odontograma_evento.retirado',
    jsonb_build_object('ficha_id', v_evento.ficha_id, 'evento_id', p_evento_id, 'procedimento_nome', coalesce(v_evento.procedimento_nome, v_evento.tipo), 'retirado_em', now()));
end;
$$;
revoke all on function public.retirar_evento_ficha_orcamento(uuid) from public, anon;
grant execute on function public.retirar_evento_ficha_orcamento(uuid) to authenticated;

create or replace function public.retirar_itens_orcamento_da_ficha(
  p_orcamento_id uuid, p_item_id uuid, p_evento_ids uuid[], p_versao_esperada timestamptz,
  p_confirmar_ajuste_financeiro boolean default false
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_orcamento public.orcamentos%rowtype;
  v_item public.orcamento_itens%rowtype;
  v_pago numeric;
  v_tem_impacto_financeiro boolean;
  v_saldo numeric;
  v_devido_apos numeric;
  v_devido_antes numeric;
  v_desconto_etapas numeric := 0;
  v_etapas_abertas integer := 0;
  v_total_apos numeric;
  v_actor_nome text;
begin
  if v_clinica_id is null or v_caller is null or cardinality(p_evento_ids) = 0 then raise exception 'sem_permissao'; end if;
  select * into v_orcamento from public.orcamentos where id = p_orcamento_id and clinica_id = v_clinica_id for update;
  if not found or not public.can_act_as_dentista(v_orcamento.dentista_id) then raise exception 'sem_permissao'; end if;
  -- O cliente recebe ISO em milissegundos, enquanto `now()` do Postgres tem microssegundos.
  -- Comparar nessa resolução preserva a proteção contra escrita concorrente sem rejeitar
  -- uma versão que ele próprio acabou de ler.
  if date_trunc('milliseconds', v_orcamento.updated_at) is distinct from date_trunc('milliseconds', p_versao_esperada) then raise exception 'conflito'; end if;
  select * into v_item from public.orcamento_itens where id = p_item_id and orcamento_id = p_orcamento_id and clinica_id = v_clinica_id for update;
  if not found or v_item.retirado_em is not null then raise exception 'conflito'; end if;
  if exists (
    select 1 from public.orcamento_eventos oe
    where oe.orcamento_id = p_orcamento_id and oe.item_id = p_item_id and oe.retirado_em is null
      and not (oe.evento_id = any(p_evento_ids))
  ) then raise exception 'revisar_cobranca'; end if;
  if not exists (select 1 from public.orcamento_eventos where orcamento_id = p_orcamento_id and item_id = p_item_id and evento_id = any(p_evento_ids) and retirado_em is null) then raise exception 'conflito'; end if;
  select coalesce(sum(valor), 0) into v_pago from public.pagamentos where orcamento_id = p_orcamento_id and clinica_id = v_clinica_id and status = 'pago';
  v_tem_impacto_financeiro := v_pago > 0
    or v_orcamento.valor_acordado is not null
    or coalesce(v_orcamento.desconto, 0) > 0
    or exists (select 1 from public.orcamento_cobrancas where orcamento_id = p_orcamento_id and clinica_id = v_clinica_id and situacao = 'aberta');
  select count(*), coalesce(sum(c.desconto), 0) into v_etapas_abertas, v_desconto_etapas
  from public.orcamento_cobrancas c
  where c.orcamento_id = p_orcamento_id and c.clinica_id = v_clinica_id and c.situacao = 'aberta';
  select greatest(0, coalesce(v_orcamento.valor_acordado,
    coalesce(sum(oi.preco_total) filter (where oi.aprovado and oi.retirado_em is null), 0)
    - case when v_etapas_abertas > 0 then v_desconto_etapas else coalesce(v_orcamento.desconto, 0) end)) into v_devido_antes
  from public.orcamento_itens oi
  where oi.orcamento_id = p_orcamento_id and oi.clinica_id = v_clinica_id;
  select greatest(0, coalesce(v_orcamento.valor_acordado,
    coalesce(sum(oi.preco_total) filter (where oi.aprovado and oi.id <> p_item_id and oi.retirado_em is null), 0)
    - case when v_etapas_abertas > 0 then v_desconto_etapas else coalesce(v_orcamento.desconto, 0) end)) into v_devido_apos
  from public.orcamento_itens oi
  where oi.orcamento_id = p_orcamento_id and oi.clinica_id = v_clinica_id;
  v_saldo := greatest(0, v_devido_antes - v_pago);
  v_total_apos := greatest(0, coalesce(v_orcamento.total, 0) - coalesce(v_item.preco_total, 0));
  if (v_tem_impacto_financeiro and not p_confirmar_ajuste_financeiro) or v_pago > v_devido_apos then
    return jsonb_build_object(
      'status', 'revisar_cobranca', 'total', v_total_apos,
      'recebido', v_pago, 'saldo', v_saldo,
      'etapas_abertas', v_etapas_abertas, 'total_antes', coalesce(v_orcamento.total, 0),
      'total_depois', v_total_apos, 'devido_antes', v_devido_antes, 'devido_depois', v_devido_apos,
      'motivo', case when v_pago > v_devido_apos then 'valor_abaixo_recebido' else 'confirmacao_necessaria' end
    );
  end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  update public.orcamento_eventos set retirado_em = now(), retirado_por = v_caller
  where orcamento_id = p_orcamento_id and item_id = p_item_id and evento_id = any(p_evento_ids) and clinica_id = v_clinica_id and retirado_em is null;
  update public.orcamento_itens set retirado_em = now(), retirado_por = v_caller where id = p_item_id and clinica_id = v_clinica_id;
  update public.orcamentos set total = greatest(0, coalesce(total, 0) - coalesce(v_item.preco_total, 0)) where id = p_orcamento_id and clinica_id = v_clinica_id;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_orcamento.paciente_id, 'orcamento_item', p_item_id::text, 'orcamento_evento.retirado', jsonb_build_object(
    'orcamento_id', p_orcamento_id, 'evento_ids', p_evento_ids, 'item_id', p_item_id,
    'confirmacao_financeira', p_confirmar_ajuste_financeiro, 'total_antes', v_orcamento.total,
    'recebido_preservado', v_pago, 'saldo_antes', v_saldo
  ));
  return jsonb_build_object('status', 'ok', 'total', greatest(0, coalesce(v_orcamento.total, 0) - coalesce(v_item.preco_total, 0)), 'recebido', v_pago);
end;
$$;
revoke all on function public.retirar_itens_orcamento_da_ficha(uuid, uuid, uuid[], timestamptz, boolean) from public, anon;
grant execute on function public.retirar_itens_orcamento_da_ficha(uuid, uuid, uuid[], timestamptz, boolean) to authenticated;

-- A dispensa fecha somente este log clínico para este orçamento. Um novo log de
-- retirada cria outra pendência e nunca é escondido pela dispensa anterior.
create or replace function public.dispensar_retirada_orcamento(
  p_orcamento_id uuid, p_evento_id uuid, p_alteracao_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_orcamento public.orcamentos%rowtype;
  v_actor_nome text;
begin
  if v_clinica_id is null or v_caller is null then raise exception 'sem_permissao'; end if;
  select * into v_orcamento from public.orcamentos
  where id = p_orcamento_id and clinica_id = v_clinica_id for update;
  if not found or not public.can_act_as_dentista(v_orcamento.dentista_id) then raise exception 'sem_permissao'; end if;
  if not exists (
    select 1 from public.orcamento_eventos oe
    where oe.orcamento_id = p_orcamento_id and oe.evento_id = p_evento_id
      and oe.clinica_id = v_clinica_id and oe.retirado_em is null
  ) then raise exception 'vinculo_nao_encontrado'; end if;
  if not exists (
    select 1 from public.activity_logs a
    where a.id = p_alteracao_id and a.clinica_id = v_clinica_id and a.paciente_id = v_orcamento.paciente_id
      and a.entity_type = 'odontograma_evento' and a.entity_id = p_evento_id::text
      and a.action = 'odontograma_evento.retirado'
  ) then raise exception 'alteracao_invalida'; end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_orcamento.paciente_id, 'orcamento', p_orcamento_id::text,
    'orcamento_evento.retirada_dispensada', jsonb_build_object('alteracao_id', p_alteracao_id, 'evento_id', p_evento_id, 'orcamento_id', p_orcamento_id));
end;
$$;
revoke all on function public.dispensar_retirada_orcamento(uuid, uuid, uuid) from public, anon;
grant execute on function public.dispensar_retirada_orcamento(uuid, uuid, uuid) to authenticated;

-- Itens anteriores ao R169b não guardavam a associação evento→item. A pessoa escolhe
-- explicitamente o item e os eventos, e só então a relação é persistida; nunca por nome.
create or replace function public.vincular_eventos_legados_item_orcamento(
  p_orcamento_id uuid, p_item_id uuid, p_evento_ids uuid[]
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_orcamento public.orcamentos%rowtype;
  v_actor_nome text;
begin
  if v_clinica_id is null or v_caller is null or cardinality(p_evento_ids) is null or cardinality(p_evento_ids) = 0
     or cardinality(p_evento_ids) <> cardinality(array(select distinct unnest(p_evento_ids))) then
    raise exception 'vinculo_invalido';
  end if;
  select * into v_orcamento from public.orcamentos where id = p_orcamento_id and clinica_id = v_clinica_id for update;
  if not found or not public.can_act_as_dentista(v_orcamento.dentista_id) then raise exception 'sem_permissao'; end if;
  perform oi.id from public.orcamento_itens oi
  where oi.id = p_item_id and oi.orcamento_id = p_orcamento_id and oi.clinica_id = v_clinica_id and oi.retirado_em is null for update;
  if not found then raise exception 'vinculo_invalido'; end if;
  perform oe.evento_id from public.orcamento_eventos oe
  join public.odontograma_eventos e on e.id = oe.evento_id
  where oe.orcamento_id = p_orcamento_id and oe.clinica_id = v_clinica_id and oe.evento_id = any(p_evento_ids)
    and oe.item_id is null and oe.retirado_em is null and e.ficha_id = v_orcamento.ficha_id and e.clinica_id = v_clinica_id
  order by oe.evento_id for update;
  if not found or (select count(*) from public.orcamento_eventos oe where oe.orcamento_id = p_orcamento_id and oe.clinica_id = v_clinica_id and oe.evento_id = any(p_evento_ids) and oe.item_id is null and oe.retirado_em is null) <> cardinality(p_evento_ids) then
    raise exception 'vinculo_invalido';
  end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  update public.orcamento_eventos set item_id = p_item_id
  where orcamento_id = p_orcamento_id and clinica_id = v_clinica_id and evento_id = any(p_evento_ids) and item_id is null and retirado_em is null;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_orcamento.paciente_id, 'orcamento', p_orcamento_id::text,
    'orcamento_evento.legado_vinculado', jsonb_build_object('orcamento_id', p_orcamento_id, 'item_id', p_item_id, 'evento_ids', p_evento_ids));
end;
$$;
revoke all on function public.vincular_eventos_legados_item_orcamento(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.vincular_eventos_legados_item_orcamento(uuid, uuid, uuid[]) to authenticated;

create or replace function public.resolver_renomeacao_item_orcamento(
  p_orcamento_id uuid, p_evento_id uuid, p_item_id uuid, p_alteracao_id uuid,
  p_nome_atual text, p_manter_nome_historico boolean
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_orcamento public.orcamentos%rowtype;
  v_item public.orcamento_itens%rowtype;
  v_actor_nome text;
  v_log_valido boolean;
  v_evento_nome text;
begin
  if v_clinica_id is null or v_caller is null or nullif(btrim(p_nome_atual), '') is null or char_length(btrim(p_nome_atual)) > 500 then
    raise exception 'nome_invalido';
  end if;
  select * into v_orcamento from public.orcamentos
  where id = p_orcamento_id and clinica_id = v_clinica_id for update;
  if not found or not public.can_act_as_dentista(v_orcamento.dentista_id) then raise exception 'sem_permissao'; end if;
  select * into v_item from public.orcamento_itens
  where id = p_item_id and orcamento_id = p_orcamento_id and clinica_id = v_clinica_id and retirado_em is null for update;
  if not found then raise exception 'vinculo_nao_encontrado'; end if;
  select e.procedimento_nome into v_evento_nome from public.odontograma_eventos e
  where e.id = p_evento_id and e.clinica_id = v_clinica_id and e.ficha_id = v_orcamento.ficha_id
    and e.paciente_id = v_orcamento.paciente_id and e.retirado_em is null for update;
  if not found or v_evento_nome is distinct from btrim(p_nome_atual) then raise exception 'alteracao_invalida'; end if;
  select exists (
    select 1 from public.activity_logs a
    where a.id = p_alteracao_id and a.clinica_id = v_clinica_id and a.entity_type = 'odontograma_evento'
      and a.entity_id = p_evento_id::text and a.action = 'odontograma_evento.detalhe_alterado'
      and coalesce((a.metadata->>'nome_alterado')::boolean, false)
      and a.metadata->>'nome_atual' = btrim(p_nome_atual)
  ) into v_log_valido;
  if not v_log_valido then raise exception 'alteracao_invalida'; end if;
  if not exists (
    select 1 from public.orcamento_eventos oe
    where oe.orcamento_id = p_orcamento_id and oe.item_id = p_item_id and oe.evento_id = p_evento_id
      and oe.clinica_id = v_clinica_id and oe.retirado_em is null
  ) then raise exception 'vinculo_nao_encontrado'; end if;
  if not p_manter_nome_historico and exists (
    select 1 from public.orcamento_eventos oe
    where oe.orcamento_id = p_orcamento_id and oe.item_id = p_item_id
      and oe.clinica_id = v_clinica_id and oe.retirado_em is null and oe.evento_id <> p_evento_id
  ) then raise exception 'item_agrupado'; end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  if not p_manter_nome_historico then
    update public.orcamento_itens set descricao = btrim(p_nome_atual) where id = p_item_id and clinica_id = v_clinica_id;
  end if;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_orcamento.paciente_id, 'orcamento', p_orcamento_id::text,
    case when p_manter_nome_historico then 'orcamento_evento.nome_dispensado' else 'orcamento_evento.nome_aplicado' end,
    jsonb_build_object('alteracao_id', p_alteracao_id, 'evento_id', p_evento_id, 'item_id', p_item_id,
      'orcamento_id', p_orcamento_id, 'nome_atual', btrim(p_nome_atual)));
end;
$$;
revoke all on function public.resolver_renomeacao_item_orcamento(uuid, uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.resolver_renomeacao_item_orcamento(uuid, uuid, uuid, uuid, text, boolean) to authenticated;

create or replace view public.orcamentos_com_estado
with (security_invoker = true) as
select o.id,
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
  coalesce(ai.soma_aprovada, 0) as valor_aprovado,
  coalesce(pg.total_pago, 0) as valor_pago,
  devido.valor as valor_devido,
  case
    when coalesce(ai.soma_aprovada, 0) = 0 then 'proposto'
    when coalesce(pg.total_pago, 0) < devido.valor then 'aceito'
    else 'quitado'
  end as estado,
  o.titular_recebimento
from public.orcamentos o
left join lateral (
  select sum(oi.preco_total) as soma_aprovada
  from public.orcamento_itens oi
  where oi.orcamento_id = o.id and oi.clinica_id = o.clinica_id and oi.aprovado and oi.retirado_em is null
) ai on true
left join lateral (
  select sum(p.valor) as total_pago
  from public.pagamentos p
  where p.orcamento_id = o.id and p.clinica_id = o.clinica_id and p.status = 'pago'
) pg on true
left join lateral (
  select count(*) as quantidade, sum(c.desconto) as desconto
  from public.orcamento_cobrancas c
  where c.orcamento_id = o.id and c.clinica_id = o.clinica_id and c.situacao = 'aberta'
) etapas on true
cross join lateral (
  select coalesce(o.valor_acordado,
    greatest(0, coalesce(ai.soma_aprovada, 0) - case when etapas.quantidade > 0
      then coalesce(etapas.desconto, 0) else coalesce(o.desconto, 0) end)) as valor
) devido;

-- R145/R167 continuam sendo a única forma de criar ou editar cobranças. Estes
-- guards só impedem que um item retirado volte a uma etapa nova; snapshots de
-- etapas antigas seguem intactos para preservar o dinheiro já recebido.
do $r169b$
declare
  v_assinatura text;
  v_definicao text;
  v_antes text;
begin
  foreach v_assinatura in array array[
    'public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text)',
    'public.editar_cobranca_orcamento(uuid,uuid[],numeric)'
  ] loop
    if to_regprocedure(v_assinatura) is null then
      raise exception 'R169b: RPC obrigatória ausente: %', v_assinatura;
    end if;
    v_definicao := pg_get_functiondef(v_assinatura::regprocedure);
    if strpos(v_definicao, 'oi.retirado_em is null') > 0 then continue; end if;
    if strpos(v_definicao, 'and oi.clinica_id = v_clinica_id') = 0 then
      raise exception 'R169b: definição inesperada em %', v_assinatura;
    end if;
    execute regexp_replace(
      v_definicao,
      E'(and oi\\.clinica_id = v_clinica_id)',
      E'\\1\n       and oi.retirado_em is null',
      'g'
    );
  end loop;
end;
$r169b$;

-- As RPCs legadas que ainda calculam o aprovado diretamente passam a enxergar
-- somente itens ativos. As que o R166 já direcionou para a view canônica não
-- contêm esse trecho e são preservadas sem reescrita.
do $r169b_financeiro$
declare
  v_assinatura text;
  v_definicao text;
  v_antes text;
begin
  foreach v_assinatura in array array[
    'public.registrar_recebimento_orcamento(uuid,numeric,text,date)',
    'public.confirmar_previsao_orcamento(uuid,text,date)',
    'public.corrigir_recebimento_orcamento(uuid,numeric,text,date)',
    'public.reorganizar_parcelas_orcamento(uuid,numeric,jsonb)',
    'public.aceitar_orcamento(uuid,text,text)'
  ] loop
    if to_regprocedure(v_assinatura) is null then continue; end if;
    v_definicao := pg_get_functiondef(v_assinatura::regprocedure);
    if strpos(v_definicao, 'retirado_em is null') > 0 then continue; end if;
    v_antes := v_definicao;
    -- R145 usa `oi`; R146/aceite usa `i` e ganha também o escopo clínico.
    -- Substituição literal não depende da serialização do pg_get_functiondef.
    v_definicao := replace(v_definicao,
      'where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;',
      'where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id and oi.retirado_em is null;');
    v_definicao := replace(v_definicao,
      'where i.orcamento_id = p_orcamento_id and i.aprovado;',
      'where i.orcamento_id = p_orcamento_id and i.clinica_id = v_clinica_id and i.aprovado and i.retirado_em is null;');
    v_definicao := replace(v_definicao,
      'where i.orcamento_id = p_orcamento_id;',
      'where i.orcamento_id = p_orcamento_id and i.clinica_id = v_clinica_id and i.retirado_em is null;');
    if v_definicao = v_antes then
      if strpos(v_definicao, 'orcamentos_com_estado') = 0 then
        raise exception 'R169b: soma de itens inesperada em %', v_assinatura;
      end if;
    else
      execute v_definicao;
    end if;
  end loop;
end;
$r169b_financeiro$;

notify pgrst, 'reload schema';
commit;
