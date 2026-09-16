-- R-157b — entrada, acordo parcelado e cartão confirmado por etapa.
-- Campos são aditivos: etapas já existentes continuam com a semântica legada.

alter table public.orcamento_cobrancas
  add column if not exists entrada_valor numeric(10,2) not null default 0,
  add column if not exists entrada_forma text,
  add column if not exists entrada_registrada boolean not null default false,
  add column if not exists parcelas_forma text not null default 'acordo';

alter table public.orcamento_cobrancas
  drop constraint if exists orcamento_cobrancas_entrada_valor_check,
  add constraint orcamento_cobrancas_entrada_valor_check
    check (entrada_valor >= 0 and entrada_valor <= valor_final),
  drop constraint if exists orcamento_cobrancas_entrada_forma_check,
  add constraint orcamento_cobrancas_entrada_forma_check
    check (entrada_forma is null or entrada_forma in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro')),
  drop constraint if exists orcamento_cobrancas_entrada_registrada_check,
  add constraint orcamento_cobrancas_entrada_registrada_check
    check (not entrada_registrada or entrada_valor > 0 and entrada_forma is not null),
  drop constraint if exists orcamento_cobrancas_parcelas_forma_check,
  add constraint orcamento_cobrancas_parcelas_forma_check
    check (parcelas_forma in ('acordo', 'cartao_credito'));

drop function if exists public.criar_cobranca_orcamento(uuid, uuid[], numeric, smallint, date, text);
create or replace function public.criar_cobranca_orcamento(
  p_orcamento_id uuid,
  p_item_ids uuid[],
  p_desconto numeric default 0,
  p_numero_parcelas smallint default 1,
  p_primeiro_vencimento date default null,
  p_observacoes text default null,
  p_entrada_valor numeric default 0,
  p_entrada_forma text default null,
  p_entrada_registrada boolean default false,
  p_parcelas_forma text default 'acordo'
) returns public.orcamento_cobrancas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_actor_id uuid := public.get_my_dentista_id();
  v_actor_nome text;
  v_orc public.orcamentos%rowtype;
  v_cobranca public.orcamento_cobrancas%rowtype;
  v_subtotal numeric := 0;
  v_valor_final numeric := 0;
  v_valor_parcelado numeric := 0;
  v_item public.orcamento_itens%rowtype;
  v_item_id uuid;
  v_primeiro_vencimento date;
  v_total_centavos bigint;
  v_base_centavos bigint;
  v_resto_centavos bigint;
  v_valor_parcela numeric;
  i smallint;
begin
  if length(coalesce(p_observacoes, '')) > 2000 then raise exception 'observacao_invalida'; end if;
  if v_clinica_id is null or v_actor_id is null then raise exception 'sem_permissao'; end if;
  if p_item_ids is null or cardinality(p_item_ids) is null or cardinality(p_item_ids) = 0
    or cardinality(p_item_ids) <> cardinality(array(select distinct unnest(p_item_ids))) then raise exception 'itens_invalidos'; end if;
  if p_desconto is null or p_desconto < 0 or round(p_desconto * 100) <> p_desconto * 100 then raise exception 'desconto_invalido'; end if;
  if p_numero_parcelas is null or p_numero_parcelas < 1 or p_numero_parcelas > 24 then raise exception 'numero_parcelas_invalido'; end if;
  if p_entrada_valor is null or p_entrada_valor < 0 or round(p_entrada_valor * 100) <> p_entrada_valor * 100 then raise exception 'entrada_invalida'; end if;
  if p_entrada_forma is not null and p_entrada_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then raise exception 'forma_invalida'; end if;
  if coalesce(p_entrada_registrada, false) and (p_entrada_valor = 0 or p_entrada_forma is null) then raise exception 'entrada_invalida'; end if;
  if coalesce(p_parcelas_forma, 'acordo') not in ('acordo', 'cartao_credito') then raise exception 'forma_invalida'; end if;
  if coalesce(p_parcelas_forma, 'acordo') = 'cartao_credito' and p_numero_parcelas < 2 then raise exception 'numero_parcelas_invalido'; end if;
  v_primeiro_vencimento := coalesce(p_primeiro_vencimento, (now() at time zone 'America/Sao_Paulo')::date);

  select o.* into v_orc from public.orcamentos o
    where o.id = p_orcamento_id and o.clinica_id = v_clinica_id for update;
  if v_orc.id is null or not public.can_act_as_dentista(v_orc.dentista_id) then raise exception 'sem_permissao'; end if;
  foreach v_item_id in array p_item_ids loop
    select oi.* into v_item from public.orcamento_itens oi
      where oi.id = v_item_id and oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id for update;
    if v_item.id is null or not v_item.aprovado then raise exception 'item_nao_aprovado'; end if;
    if exists (select 1 from public.orcamento_cobranca_itens ci join public.orcamento_cobrancas c on c.id = ci.cobranca_id
      where ci.orcamento_item_id = v_item.id and ci.ativo and c.situacao = 'aberta') then raise exception 'item_ja_cobrado'; end if;
    v_subtotal := v_subtotal + coalesce(v_item.preco_total, 0);
  end loop;
  if v_subtotal <= 0 then raise exception 'subtotal_invalido'; end if;
  if p_desconto > v_subtotal then raise exception 'desconto_acima_subtotal'; end if;
  v_valor_final := v_subtotal - p_desconto;
  if p_entrada_valor > v_valor_final then raise exception 'entrada_acima_total'; end if;
  v_valor_parcelado := v_valor_final - p_entrada_valor;
  if v_valor_parcelado = 0 and p_numero_parcelas > 1 then raise exception 'numero_parcelas_invalido'; end if;

  insert into public.orcamento_cobrancas (
    clinica_id, orcamento_id, paciente_id, dentista_id, subtotal, desconto, valor_final,
    numero_parcelas, primeiro_vencimento, observacoes, entrada_valor, entrada_forma,
    entrada_registrada, parcelas_forma
  ) values (
    v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, v_subtotal, p_desconto, v_valor_final,
    p_numero_parcelas, v_primeiro_vencimento, nullif(btrim(p_observacoes), ''), p_entrada_valor,
    p_entrada_forma, coalesce(p_entrada_registrada, false), coalesce(p_parcelas_forma, 'acordo')
  ) returning * into v_cobranca;
  foreach v_item_id in array p_item_ids loop
    select oi.* into v_item from public.orcamento_itens oi where oi.id = v_item_id;
    insert into public.orcamento_cobranca_itens (cobranca_id, orcamento_item_id, clinica_id, preco_total_snapshot)
      values (v_cobranca.id, v_item.id, v_clinica_id, coalesce(v_item.preco_total, 0));
  end loop;

  if p_entrada_valor > 0 then
    insert into public.pagamentos (clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status, forma_pagamento, data_vencimento, data_pagamento, marcado_por_id, observacoes)
    values (v_clinica_id, v_orc.id, v_cobranca.id, v_orc.paciente_id, v_orc.dentista_id, p_entrada_valor,
      case when p_entrada_registrada then 'pago' else 'pendente' end, p_entrada_forma, (now() at time zone 'America/Sao_Paulo')::date,
      case when p_entrada_registrada then (now() at time zone 'America/Sao_Paulo')::date else null end,
      case when p_entrada_registrada then v_actor_id else null end, 'Entrada da etapa');
  end if;

  if v_valor_parcelado > 0 then
    v_total_centavos := round(v_valor_parcelado * 100)::bigint;
    v_base_centavos := v_total_centavos / p_numero_parcelas;
    v_resto_centavos := v_total_centavos - v_base_centavos * p_numero_parcelas;
    for i in 1..p_numero_parcelas loop
      v_valor_parcela := (v_base_centavos + case when i = p_numero_parcelas then v_resto_centavos else 0 end) / 100.0;
      insert into public.pagamentos (clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status, forma_pagamento, data_vencimento, data_pagamento, marcado_por_id, parcela_numero, total_parcelas, observacoes)
      values (v_clinica_id, v_orc.id, v_cobranca.id, v_orc.paciente_id, v_orc.dentista_id, v_valor_parcela,
        case when p_parcelas_forma = 'cartao_credito' then 'pago' else 'pendente' end,
        case when p_parcelas_forma = 'cartao_credito' then 'cartao_credito' else null end,
        (v_primeiro_vencimento + (i - 1) * interval '1 month')::date,
        case when p_parcelas_forma = 'cartao_credito' then (v_primeiro_vencimento + (i - 1) * interval '1 month')::date else null end,
        case when p_parcelas_forma = 'cartao_credito' then v_actor_id else null end, i, p_numero_parcelas,
        case when p_parcelas_forma = 'cartao_credito' then 'Parcela confirmada no cartão' else null end);
    end loop;
  end if;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_actor_id;
  insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_actor_id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'cobranca.etapa_criada', jsonb_build_object('cobranca_id', v_cobranca.id, 'item_ids', p_item_ids,
      'subtotal', v_subtotal, 'desconto', p_desconto, 'valor_final', v_valor_final,
      'entrada_valor', p_entrada_valor, 'entrada_registrada', p_entrada_registrada,
      'numero_parcelas', p_numero_parcelas, 'parcelas_forma', p_parcelas_forma));
  return v_cobranca;
end;
$$;
revoke all on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text,numeric,text,boolean,text) from public, anon;
grant execute on function public.criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text,numeric,text,boolean,text) to authenticated;
