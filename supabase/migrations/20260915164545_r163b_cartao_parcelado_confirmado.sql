-- R163b: confirmação única do cartão; caixa distribuído pelas datas mensais.
-- Sem DML no legado, novas policies ou integração bancária.
set local lock_timeout='1500ms';
set local statement_timeout='15s';

create function private.travar_orcamento_cartao(p_orcamento_id uuid)
returns public.orcamentos language plpgsql security invoker set search_path='' as $$
declare v_orc public.orcamentos%rowtype; v_clinica uuid:=public.get_my_clinica_id();
begin
  if auth.uid() is null or not exists(select 1 from public.clinica_usuarios cu
    where cu.clinica_id=v_clinica and cu.usuario_id=auth.uid() and cu.status='ativo') then
    raise exception 'sem_permissao';
  end if;
  select * into v_orc from public.orcamentos where id=p_orcamento_id and clinica_id=v_clinica for update;
  if v_orc.id is null or public.can_act_as_dentista(v_orc.dentista_id) is not true then raise exception 'sem_permissao'; end if;
  return v_orc;
end $$;

create or replace function public.gerar_parcelas_orcamento(
  p_orcamento_id        uuid,
  p_numero_parcelas     smallint,
  p_primeiro_vencimento date,
  p_valor_acordado      numeric default null,  -- null = mantém coalesce(valor_acordado, total)
  p_entrada_valor       numeric default null,
  p_entrada_forma       text default null,
  p_parcelas_forma      text default null
) returns setof public.pagamentos
language plpgsql security definer set search_path = '' as $$
declare
  v_clinica_id     uuid := public.get_my_clinica_id();
  v_caller         uuid := public.get_my_dentista_id();
  v_orc            record;
  v_ja_pago        numeric;
  v_valor_acordado numeric;
  v_a_parcelar     numeric;
  v_total_centavos bigint;
  v_base_centavos  bigint;
  v_resto_centavos bigint;
  v_valor_parcela  numeric;
  i                smallint;
begin
  if p_numero_parcelas is null or p_numero_parcelas < 2 or p_numero_parcelas > 24 then
    raise exception 'numero_parcelas_invalido';
  end if;
  if p_primeiro_vencimento is null then
    raise exception 'vencimento_invalido';
  end if;

  -- O endpoint legado e o cartão disputam o mesmo lock antes de ler o plano.
  select * into v_orc from private.travar_orcamento_cartao(p_orcamento_id);

  if v_orc.plano_forma is not null then raise exception 'plano_ja_definido'; end if;
  if exists (
    select 1 from public.pagamentos
     where clinica_id = v_clinica_id and orcamento_id = p_orcamento_id and parcela_numero is not null
  ) then
    raise exception 'plano_ja_definido';
  end if;

  v_valor_acordado := coalesce(p_valor_acordado, v_orc.valor_acordado, v_orc.total, 0);
  if v_valor_acordado <= 0 then raise exception 'valor_invalido'; end if;

  -- Já pago é somado AQUI — nunca recebido do client (evita duplicar receita se o
  -- caller calculou saldo restante com dado desatualizado).
  select coalesce(sum(valor), 0) into v_ja_pago
    from public.pagamentos
   where clinica_id = v_clinica_id and orcamento_id = p_orcamento_id and status = 'pago';

  v_a_parcelar := v_valor_acordado - v_ja_pago - coalesce(p_entrada_valor, 0);
  if v_a_parcelar <= 0 then raise exception 'valor_invalido'; end if;

  update public.orcamentos
     set plano_forma           = 'parcelado',
         plano_parcelas        = p_numero_parcelas,
         plano_entrada_valor   = p_entrada_valor,
         plano_entrada_forma   = p_entrada_forma,
         plano_parcelas_forma  = p_parcelas_forma,
         valor_acordado        = v_valor_acordado,
         plano_definido_em     = now(),
         plano_definido_por_id = v_caller
   where id = p_orcamento_id and clinica_id = v_clinica_id;

  v_total_centavos := round(v_a_parcelar * 100)::bigint;
  v_base_centavos  := v_total_centavos / p_numero_parcelas;
  v_resto_centavos := v_total_centavos - v_base_centavos * p_numero_parcelas;

  for i in 1..p_numero_parcelas loop
    v_valor_parcela := (v_base_centavos
      + case when i = p_numero_parcelas then v_resto_centavos else 0 end) / 100.0;

    insert into public.pagamentos
      (clinica_id, orcamento_id, paciente_id, dentista_id, valor, status,
       data_vencimento, parcela_numero, total_parcelas)
    values
      (v_clinica_id, p_orcamento_id, v_orc.paciente_id, v_orc.dentista_id, v_valor_parcela,
       'pendente', (p_primeiro_vencimento + (i - 1) * interval '1 month')::date, i, p_numero_parcelas);
  end loop;

  return query
    select * from public.pagamentos
     where clinica_id = v_clinica_id and orcamento_id = p_orcamento_id and parcela_numero is not null
     order by parcela_numero;
end;
$$;

create function private.confirmar_parcelas_cartao(p_orcamento_id uuid,p_ids uuid[])
returns setof public.pagamentos language plpgsql security invoker set search_path='' as $$
declare v_orc public.orcamentos%rowtype; v_actor uuid:=public.get_my_dentista_id(); v_nome text; v_count integer;
begin
  v_orc:=private.travar_orcamento_cartao(p_orcamento_id);
  if coalesce(cardinality(p_ids),0)<2 or cardinality(p_ids)>24 then raise exception 'numero_parcelas_invalido'; end if;
  if exists(select 1 from public.pagamentos p where p.clinica_id=v_orc.clinica_id and p.id=any(p_ids)
    and (p.orcamento_id is distinct from v_orc.id or p.status<>'pendente' or p.valor<=0
      or p.data_vencimento is null or p.parcela_numero is null)) then raise exception 'parcelas_invalidas'; end if;
  update public.pagamentos set status='pago',forma_pagamento='cartao_credito',
    data_pagamento=data_vencimento,marcado_por_id=v_actor,
    observacoes=concat_ws(E'\n',observacoes,'Cartão confirmado com lançamento mensal programado.')
    where clinica_id=v_orc.clinica_id and orcamento_id=v_orc.id and id=any(p_ids) and status='pendente';
  get diagnostics v_count=row_count;
  if v_count<>cardinality(p_ids) then raise exception 'parcelas_invalidas'; end if;
  select nome into v_nome from public.dentistas where clinica_id=v_orc.clinica_id and id=v_actor;
  insert into public.activity_logs(clinica_id,actor_id,actor_nome,paciente_id,entity_type,entity_id,action,metadata)
    values(v_orc.clinica_id,v_actor,v_nome,v_orc.paciente_id,'orcamento',v_orc.id::text,
      'cartao.parcelamento_confirmado',jsonb_build_object('pagamento_ids',p_ids,'criterio','lancamento_mensal_programado'));
  return query select * from public.pagamentos where clinica_id=v_orc.clinica_id and id=any(p_ids) order by parcela_numero;
end $$;

create function public.gerar_parcelas_cartao(p_orcamento_id uuid,p_numero_parcelas smallint,p_primeiro_vencimento date,
 p_valor_acordado numeric default null,p_entrada_valor numeric default null,p_entrada_forma text default null,p_parcelas_forma text default 'cartao_credito')
returns setof public.pagamentos language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];
begin
  perform private.travar_orcamento_cartao(p_orcamento_id);
  if p_parcelas_forma is distinct from 'cartao_credito' then raise exception 'forma_invalida'; end if;
  select array_agg(p.id) into v_ids from public.gerar_parcelas_orcamento(p_orcamento_id,p_numero_parcelas,p_primeiro_vencimento,
    p_valor_acordado,p_entrada_valor,p_entrada_forma,p_parcelas_forma) p;
  return query select * from private.confirmar_parcelas_cartao(p_orcamento_id,v_ids);
end $$;

create function public.reorganizar_parcelas_cartao(p_orcamento_id uuid,p_valor_acordado numeric,p_parcelas jsonb)
returns setof public.pagamentos language plpgsql security definer set search_path='' as $$
declare v_ids uuid[];
begin
  perform private.travar_orcamento_cartao(p_orcamento_id);
  select array_agg(p.id) into v_ids from public.reorganizar_parcelas_orcamento(p_orcamento_id,p_valor_acordado,p_parcelas) p where p.status='pendente';
  return query select * from private.confirmar_parcelas_cartao(p_orcamento_id,v_ids);
end $$;

create function public.criar_cobranca_cartao(p_orcamento_id uuid,p_item_ids uuid[],p_desconto numeric default 0,
 p_numero_parcelas smallint default 2,p_primeiro_vencimento date default null,p_observacoes text default null)
returns public.orcamento_cobrancas language plpgsql security definer set search_path='' as $$
declare v_cobranca public.orcamento_cobrancas%rowtype; v_ids uuid[];
begin
  perform private.travar_orcamento_cartao(p_orcamento_id);
  if p_numero_parcelas is null or p_numero_parcelas<2 or p_numero_parcelas>24 then raise exception 'numero_parcelas_invalido'; end if;
  v_cobranca:=public.criar_cobranca_orcamento(p_orcamento_id,p_item_ids,p_desconto,p_numero_parcelas,p_primeiro_vencimento,p_observacoes);
  select array_agg(p.id) into v_ids from public.pagamentos p
    where p.clinica_id=v_cobranca.clinica_id and p.cobranca_id=v_cobranca.id and p.status='pendente';
  perform private.confirmar_parcelas_cartao(p_orcamento_id,v_ids);
  return v_cobranca;
end $$;

revoke all on function private.travar_orcamento_cartao(uuid),private.confirmar_parcelas_cartao(uuid,uuid[]) from public,anon,authenticated;
revoke all on function
 public.gerar_parcelas_cartao(uuid,smallint,date,numeric,numeric,text,text),
 public.reorganizar_parcelas_cartao(uuid,numeric,jsonb),
 public.criar_cobranca_cartao(uuid,uuid[],numeric,smallint,date,text) from public,anon;
grant execute on function
 public.gerar_parcelas_cartao(uuid,smallint,date,numeric,numeric,text,text),
 public.reorganizar_parcelas_cartao(uuid,numeric,jsonb),
 public.criar_cobranca_cartao(uuid,uuid[],numeric,smallint,date,text) to authenticated;
notify pgrst,'reload schema';
