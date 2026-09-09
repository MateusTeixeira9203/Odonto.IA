-- Aplicação atômica mesmo quando o executor não envolve o arquivo em BEGIN.
DO $r157_migration$
BEGIN
  PERFORM set_config('lock_timeout', '3s', true);
  EXECUTE $r157_ddl$
-- R-157: expansão aditiva, sem alterar RLS ou reescrever orçamentos históricos.
-- Aplicar antes do app. RPCs _r157 evitam descartar composição num banco ainda antigo.
alter table public.orcamento_itens add column if not exists composicao jsonb;
alter table public.orcamento_cobrancas add column if not exists observacoes text;
alter table public.orcamento_cobrancas add constraint r157_observacoes_limite
  check (observacoes is null or char_length(observacoes) <= 2000);

create or replace function public.validar_composicao_orcamento(p_item jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_composicao jsonb := nullif(p_item->'composicao', 'null'::jsonb);
  v_membro jsonb;
  v_ids uuid[] := '{}';
  v_esperados uuid[];
begin
  if v_composicao is null then return; end if;
  if jsonb_typeof(v_composicao) <> 'array' then raise exception 'grupo_invalido'; end if;
  if jsonb_array_length(v_composicao) not between 2 and 100
    or coalesce((p_item->>'quantidade')::numeric,0) <> 1
    or coalesce((p_item->>'preco_unitario')::numeric,0) <= 0
    or round((p_item->>'preco_unitario')::numeric,2) <> (p_item->>'preco_unitario')::numeric
    or char_length(btrim(coalesce(p_item->>'descricao',''))) not between 1 and 120
    or nullif(p_item->>'procedimento_id','') is not null then raise exception 'grupo_invalido'; end if;
  for v_membro in select value from jsonb_array_elements(v_composicao) loop
    if jsonb_typeof(v_membro) <> 'object'
      or char_length(btrim(coalesce(v_membro->>'descricao',''))) not between 1 and 500
      or coalesce((v_membro->>'quantidade')::numeric,0) not between 1 and 99
      or trunc((v_membro->>'quantidade')::numeric) <> (v_membro->>'quantidade')::numeric
      or jsonb_typeof(v_membro->'eventoIds') is distinct from 'array'
      or v_membro ? 'composicao' then raise exception 'grupo_invalido'; end if;
    if jsonb_array_length(v_membro->'eventoIds') not between 1 and 100 then raise exception 'grupo_invalido'; end if;
    perform nullif(v_membro->>'procedimentoId','')::uuid;
    select v_ids || array_agg(value::uuid) into v_ids from jsonb_array_elements_text(v_membro->'eventoIds');
  end loop;
  select array_agg(value::uuid order by value::uuid) into v_esperados
    from jsonb_array_elements_text(p_item->'evento_ids');
  if cardinality(v_ids) > 100 or cardinality(v_ids) <> cardinality(array(select distinct unnest(v_ids)))
    or array(select unnest(v_ids) order by 1) is distinct from v_esperados then raise exception 'grupo_eventos_invalidos'; end if;
end;
$$;
revoke all on function public.validar_composicao_orcamento(jsonb) from public, anon, authenticated;

-- O pacote salvo é imutável pela edição legada (que apagaria sua composição).
-- Aprovação permanece permitida; textos/preços/composição exigem renegociação explícita.
create or replace function public.validar_grupo_orcamento_persistido()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_orc public.orcamentos%rowtype;
  v_membro jsonb;
  v_eventos jsonb;
  v_evento uuid;
begin
  if TG_OP = 'UPDATE' and old.composicao is not null and
    (new.composicao,new.descricao,new.quantidade,new.preco_unitario,new.preco_total,new.procedimento_id,new.orcamento_id,new.clinica_id)
    is distinct from
    (old.composicao,old.descricao,old.quantidade,old.preco_unitario,old.preco_total,old.procedimento_id,old.orcamento_id,old.clinica_id)
    then raise exception 'grupo_preservado'; end if;
  if new.composicao is null then return new; end if;
  if TG_OP = 'UPDATE' then
    if old.composicao is null then raise exception 'grupo_preservado'; end if;
    return new;
  end if;
  select jsonb_agg(e.value) into v_eventos from jsonb_array_elements(new.composicao) m
    cross join lateral jsonb_array_elements(m.value->'eventoIds') e;
  perform public.validar_composicao_orcamento(jsonb_build_object(
    'descricao',new.descricao,'quantidade',new.quantidade,'preco_unitario',new.preco_unitario,
    'procedimento_id',new.procedimento_id,'evento_ids',v_eventos,'composicao',new.composicao));
  if new.preco_total is distinct from new.preco_unitario then raise exception 'grupo_invalido'; end if;
  select * into v_orc from public.orcamentos where id=new.orcamento_id and clinica_id=new.clinica_id;
  if v_orc.id is null then raise exception 'orcamento_nao_encontrado'; end if;
  for v_membro in select value from jsonb_array_elements(new.composicao) loop
    if nullif(v_membro->>'procedimentoId','') is not null and not exists (
      select 1 from public.procedimentos p where p.id=(v_membro->>'procedimentoId')::uuid
        and p.clinica_id=new.clinica_id and p.dentista_id=v_orc.dentista_id
    ) then raise exception 'orcamento_procedimento_de_outro_dentista'; end if;
    for v_evento in select value::uuid from jsonb_array_elements_text(v_membro->'eventoIds') loop
      if not exists (select 1 from public.odontograma_eventos e join public.fichas f on f.id=e.ficha_id
        where e.id=v_evento and e.clinica_id=new.clinica_id and e.ficha_id=v_orc.ficha_id
          and f.paciente_id=v_orc.paciente_id and f.clinica_id=new.clinica_id and e.origem='clinica'
          and coalesce(e.encaminhado_para,f.dentista_id)=v_orc.dentista_id)
        then raise exception 'grupo_eventos_invalidos'; end if;
    end loop;
  end loop;
  return new;
end;
$$;
revoke all on function public.validar_grupo_orcamento_persistido() from public, anon, authenticated;
create trigger r157_validar_grupo before insert or update on public.orcamento_itens
for each row execute function public.validar_grupo_orcamento_persistido();

CREATE OR REPLACE FUNCTION public.criar_orcamento_com_eventos_r157(p_paciente_id uuid, p_dentista_id uuid, p_ficha_id uuid, p_desconto numeric, p_itens jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_orcamento_id uuid;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_evento_ids uuid[] := '{}';
  v_todos_evento_ids uuid[] := '{}';
  v_evento_id uuid;
  v_descricao text;
  v_quantidade integer;
  v_preco_unitario numeric;
  v_procedimento_id uuid;
begin
  if auth.uid() is null or v_clinica_id is null then
    raise exception 'orcamento_sem_contexto';
  end if;

  if not public.can_act_as_dentista(p_dentista_id) then
    raise exception 'orcamento_dentista_invalido';
  end if;

  if not exists (
    select 1 from public.pacientes p
    where p.id = p_paciente_id and p.clinica_id = v_clinica_id
  ) then
    raise exception 'orcamento_paciente_invalido';
  end if;

  if p_ficha_id is not null and not exists (
    select 1 from public.fichas f
    where f.id = p_ficha_id
      and f.clinica_id = v_clinica_id
      and f.paciente_id = p_paciente_id
  ) then
    raise exception 'orcamento_ficha_invalida';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'orcamento_itens_invalidos'; end if;
  if jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception 'orcamento_itens_invalidos';
  end if;

  if p_desconto > 0 and exists (select 1 from jsonb_array_elements(p_itens) i where nullif(i.value->'composicao','null'::jsonb) is not null) then
    raise exception 'grupo_desconto_por_etapa';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    perform public.validar_composicao_orcamento(v_item);
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
    v_subtotal := v_subtotal + (v_quantidade * v_preco_unitario);
  end loop;

  if cardinality(v_todos_evento_ids) <> cardinality(array(select distinct unnest(v_todos_evento_ids))) then
    raise exception 'orcamento_evento_duplicado';
  end if;

  if p_desconto is null or p_desconto < 0 then
    raise exception 'orcamento_desconto_invalido';
  end if;

  v_total := greatest(0, v_subtotal - p_desconto);

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
          and f.paciente_id = p_paciente_id
          and e.origem = 'clinica'
          and coalesce(e.encaminhado_para, f.dentista_id) = p_dentista_id
      ) then
        raise exception 'orcamento_evento_invalido';
      end if;

      if exists (select 1 from public.orcamento_eventos oe where oe.evento_id = v_evento_id) then
        raise exception 'orcamento_evento_ja_orcado';
      end if;
    end loop;
  end loop;

  insert into public.orcamentos (
    clinica_id, dentista_id, paciente_id, ficha_id, status, total, desconto,
    validade_dias, mostrar_valor_por_item
  ) values (
    v_clinica_id, p_dentista_id, p_paciente_id, p_ficha_id, 'rascunho', v_total,
    p_desconto, 30, false
  ) returning id into v_orcamento_id;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_descricao := btrim(v_item->>'descricao');
    v_quantidade := (v_item->>'quantidade')::integer;
    v_preco_unitario := (v_item->>'preco_unitario')::numeric;
    v_procedimento_id := nullif(v_item->>'procedimento_id', '')::uuid;

    insert into public.orcamento_itens (
      orcamento_id, clinica_id, descricao, procedimento_id, quantidade,
      preco_unitario, preco_total, composicao
    ) values (
      v_orcamento_id, v_clinica_id, v_descricao, v_procedimento_id, v_quantidade,
      v_preco_unitario, v_quantidade * v_preco_unitario, nullif(v_item->'composicao','null'::jsonb)
    );

    for v_evento_id in
      select value::text::uuid
      from jsonb_array_elements_text(coalesce(v_item->'evento_ids', '[]'::jsonb))
    loop
      insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id)
      values (v_clinica_id, v_orcamento_id, v_evento_id);
    end loop;
  end loop;

  return v_orcamento_id;
end;
$function$;
revoke all on function public.criar_orcamento_com_eventos_r157(uuid,uuid,uuid,numeric,jsonb) from public, anon;
grant execute on function public.criar_orcamento_com_eventos_r157(uuid,uuid,uuid,numeric,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.adicionar_itens_orcamento_com_eventos_r157(p_orcamento_id uuid, p_itens jsonb)
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
    and o.clinica_id = v_clinica_id for update;

  if not found then
    raise exception 'orcamento_nao_encontrado';
  end if;

  if not public.can_act_as_dentista(v_orcamento.dentista_id) then
    raise exception 'orcamento_sem_permissao';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'orcamento_itens_invalidos'; end if;
  if jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception 'orcamento_itens_invalidos';
  end if;

  if exists (select 1 from jsonb_array_elements(p_itens) i where nullif(i.value->'composicao','null'::jsonb) is not null)
    and (coalesce(v_orcamento.desconto,0) > 0 or v_orcamento.valor_acordado is not null
      or exists(select 1 from public.pagamentos p where p.orcamento_id=p_orcamento_id and p.clinica_id=v_clinica_id and p.cobranca_id is null)) then
    raise exception 'grupo_orcamento_negociado';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    perform public.validar_composicao_orcamento(v_item);
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
      preco_unitario, preco_total, aprovado, composicao
    ) values (
      v_orcamento.id, v_clinica_id, v_descricao, v_procedimento_id, v_quantidade,
      v_preco_unitario, v_quantidade * v_preco_unitario, false, nullif(v_item->'composicao','null'::jsonb)
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
revoke all on function public.adicionar_itens_orcamento_com_eventos_r157(uuid,jsonb) from public, anon;
grant execute on function public.adicionar_itens_orcamento_com_eventos_r157(uuid,jsonb) to authenticated;

drop function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date);
CREATE OR REPLACE FUNCTION public.criar_cobranca_orcamento(p_orcamento_id uuid, p_item_ids uuid[], p_desconto numeric DEFAULT 0, p_numero_parcelas smallint DEFAULT 1, p_primeiro_vencimento date DEFAULT NULL::date, p_observacoes text DEFAULT NULL)
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
revoke all on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text) from public, anon;
grant execute on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text) to authenticated;

-- V2 estendido com campo opcional; snapshots assinados existentes não são alterados.
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

$r157_ddl$;
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$r157_migration$;
