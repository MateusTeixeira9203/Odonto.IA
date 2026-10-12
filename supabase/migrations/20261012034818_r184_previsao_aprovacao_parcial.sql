-- R-184 — na primeira previsão, congelar o devido canônico após aprovação parcial.
-- Parte da guarda R-188 vigente: não altera assinatura, papéis, escopo de clínica ou R-189.
-- A definição viva verificada em 2026-10-11 tem este fingerprint. Não sobrescrever uma guarda
-- diferente sem nova revisão de autorização.
do $r184_guard$
declare
  v_definicao text;
begin
  select pg_get_functiondef(
    'public.gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)'::regprocedure
  ) into v_definicao;

  if md5(v_definicao) <> 'b05d239c7cb52339e6fa7e3de33e22e8'
     or position('v_auth_user_id' in v_definicao) = 0
     or position('cu.status = ''ativo''' in v_definicao) = 0
     or position('d.ativo = true' in v_definicao) = 0
     or position('v_orc.dentista_id is distinct from v_caller.id' in v_definicao) = 0
     or position('v_valor_acordado := coalesce(p_valor_acordado, v_orc.valor_acordado, v_orc.total, 0);' in v_definicao) = 0 then
    raise exception 'R184: definição inesperada de gerar_parcelas_orcamento; revisar guarda antes de aplicar';
  end if;
end;
$r184_guard$;

create or replace function public.gerar_parcelas_orcamento(
  p_orcamento_id        uuid,
  p_numero_parcelas     smallint,
  p_primeiro_vencimento date,
  p_valor_acordado      numeric default null,
  p_entrada_valor       numeric default null,
  p_entrada_forma       text default null,
  p_parcelas_forma      text default null
) returns setof public.pagamentos
language plpgsql security definer set search_path = public as $$
declare
  v_auth_user_id   uuid := auth.uid();
  v_clinica_id     uuid;
  v_membership_role text;
  v_caller         record;
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
  -- SECURITY DEFINER bypassa RLS: autorizar antes de ler, escrever ou devolver pagamentos.
  if v_auth_user_id is null then
    raise exception 'sem_permissao';
  end if;

  select u.active_clinica_id into v_clinica_id
    from public.users u
   where u.id = v_auth_user_id;

  if v_clinica_id is null then
    raise exception 'sem_permissao';
  end if;

  select cu.role into v_membership_role
    from public.clinica_usuarios cu
   where cu.usuario_id = v_auth_user_id
     and cu.clinica_id = v_clinica_id
     and cu.status = 'ativo';

  if v_membership_role is null
     or v_membership_role not in ('admin', 'dentista', 'secretaria') then
    raise exception 'sem_permissao';
  end if;

  select d.id, d.role into v_caller
    from public.dentistas d
   where d.user_id = v_auth_user_id
     and d.clinica_id = v_clinica_id
     and d.ativo = true;

  if v_caller.id is null
     or v_caller.role not in ('admin', 'dentista', 'secretaria')
     or v_caller.role is distinct from v_membership_role then
    raise exception 'sem_permissao';
  end if;

  select o.id, o.paciente_id, o.dentista_id, o.plano_forma, o.total, o.valor_acordado into v_orc
    from public.orcamentos o
   where o.id = p_orcamento_id
     and o.clinica_id = v_clinica_id
   for update;

  if v_orc.id is null then
    raise exception 'sem_permissao';
  end if;

  if v_caller.role in ('admin', 'dentista')
     and v_orc.dentista_id is distinct from v_caller.id then
    raise exception 'sem_permissao';
  end if;

  if p_numero_parcelas is null or p_numero_parcelas < 2 or p_numero_parcelas > 24 then
    raise exception 'numero_parcelas_invalido';
  end if;
  if p_primeiro_vencimento is null then
    raise exception 'vencimento_invalido';
  end if;

  if v_orc.plano_forma is not null then
    raise exception 'plano_ja_definido';
  end if;
  if exists (
    select 1 from public.pagamentos
     where orcamento_id = p_orcamento_id and parcela_numero is not null
  ) then
    raise exception 'plano_ja_definido';
  end if;

  if p_valor_acordado is null then
    select e.valor_devido into strict v_valor_acordado
      from public.orcamentos_com_estado e
     where e.id = p_orcamento_id
       and e.clinica_id = v_clinica_id;

    if v_valor_acordado <= 0 then
      raise exception 'orcamento_sem_aprovacao';
    end if;
  else
    v_valor_acordado := p_valor_acordado;
    if v_valor_acordado <= 0 then
      raise exception 'valor_invalido';
    end if;
  end if;

  select coalesce(sum(valor), 0) into v_ja_pago
    from public.pagamentos
   where orcamento_id = p_orcamento_id and status = 'pago';

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
         plano_definido_por_id = v_caller.id
   where id = p_orcamento_id;

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
     where orcamento_id = p_orcamento_id and parcela_numero is not null
     order by parcela_numero;
end;
$$;

revoke execute on function public.gerar_parcelas_orcamento(uuid, smallint, date, numeric, numeric, text, text) from anon, public;
grant execute on function public.gerar_parcelas_orcamento(uuid, smallint, date, numeric, numeric, text, text) to authenticated;
