-- can_act_as_dentista(target_dentista_id uuid)
CREATE OR REPLACE FUNCTION public.can_act_as_dentista(target_dentista_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select target_dentista_id = public.get_my_dentista_id()
    or (
      public.get_my_role() = 'secretaria'
      and exists (
        select 1 from public.dentistas d
        where d.id = target_dentista_id
          and d.clinica_id = public.get_my_clinica_id()
          and d.ativo = true
          and d.role <> 'secretaria'
      )
    )
$function$
;

-- gerar_parcelas_orcamento(p_orcamento_id uuid, p_numero_parcelas smallint, p_primeiro_vencimento date, p_valor_acordado numeric, p_entrada_valor numeric, p_entrada_forma text, p_parcelas_forma text)
CREATE OR REPLACE FUNCTION public.gerar_parcelas_orcamento(p_orcamento_id uuid, p_numero_parcelas smallint, p_primeiro_vencimento date, p_valor_acordado numeric DEFAULT NULL::numeric, p_entrada_valor numeric DEFAULT NULL::numeric, p_entrada_forma text DEFAULT NULL::text, p_parcelas_forma text DEFAULT NULL::text)
 RETURNS SETOF pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

-- is_my_patient(patient_dentista_id uuid)
CREATE OR REPLACE FUNCTION public.is_my_patient(patient_dentista_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.dentistas d
    WHERE d.user_id = auth.uid()
      AND d.id = patient_dentista_id
  );
$function$
;

-- is_own_clinical_record(record_dentista_id uuid)
CREATE OR REPLACE FUNCTION public.is_own_clinical_record(record_dentista_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT record_dentista_id = public.get_my_dentista_id()
    OR public.get_my_role() = 'secretaria'
$function$
;

-- normalizar_nome(txt text)
CREATE OR REPLACE FUNCTION public.normalizar_nome(txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
  SELECT lower(regexp_replace(translate(btrim(txt),
    'áàâãäéèêëíìîïóòôõöúùûüñçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'), '\s+', ' ', 'g'))
$function$
;

-- registrar_pagamento_rapido_idempotente(p_operacao_id uuid, p_orcamento_id uuid, p_forma text, p_data date)
CREATE OR REPLACE FUNCTION public.registrar_pagamento_rapido_idempotente(p_operacao_id uuid, p_orcamento_id uuid, p_forma text, p_data date)
 RETURNS TABLE(pagamento_id uuid, repetida boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membership_role text;
  v_caller record;
  v_orcamento public.orcamentos%rowtype;
  v_pagamento public.pagamentos%rowtype;
  v_replay public.pagamentos%rowtype;
  v_valor_devido numeric;
  v_valor_pago numeric;
  v_saldo numeric;
  v_origem text;
  v_actor_nome text;
  v_paciente_nome text;
  v_forma_label text;
  v_valor_label text;
  v_notificacao_status text := 'nao_aplicavel';
  v_constraint_name text;
begin
  if v_auth_user_id is null then
    raise exception 'sem_permissao';
  end if;

  if p_operacao_id is null then
    raise exception 'operacao_id_invalida';
  end if;

  if p_orcamento_id is null then
    raise exception 'orcamento_invalido';
  end if;

  if p_forma is null
     or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then
    raise exception 'forma_invalida';
  end if;

  if p_data is null then
    raise exception 'data_invalida';
  end if;

  select u.active_clinica_id
    into v_clinica_id
  from public.users u
  where u.id = v_auth_user_id;

  if v_clinica_id is null then
    raise exception 'sem_permissao';
  end if;

  select cu.role
    into v_membership_role
  from public.clinica_usuarios cu
  where cu.clinica_id = v_clinica_id
    and cu.usuario_id = v_auth_user_id
    and cu.status = 'ativo';

  if v_membership_role is null
     or v_membership_role not in ('admin', 'dentista', 'secretaria') then
    raise exception 'sem_permissao';
  end if;

  select d.id, d.role
    into v_caller
  from public.dentistas d
  where d.user_id = v_auth_user_id
    and d.clinica_id = v_clinica_id
    and d.ativo = true;

  if v_caller.id is null
     or v_caller.role not in ('admin', 'dentista', 'secretaria')
     or v_caller.role is distinct from v_membership_role then
    raise exception 'sem_permissao';
  end if;

  select o.*
    into v_orcamento
  from public.orcamentos o
  where o.id = p_orcamento_id
    and o.clinica_id = v_clinica_id
  for update;

  if v_orcamento.id is null then
    raise exception 'sem_permissao';
  end if;

  if v_membership_role in ('admin', 'dentista')
     and v_orcamento.dentista_id is distinct from v_caller.id then
    raise exception 'sem_permissao';
  end if;

  select p.*
    into v_replay
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.operacao_id = p_operacao_id;

  if found then
    if v_replay.orcamento_id is distinct from p_orcamento_id
       or v_replay.marcado_por_id is distinct from v_caller.id
       or v_replay.forma_pagamento is distinct from p_forma
       or v_replay.data_pagamento is distinct from p_data then
      raise exception 'chave_idempotencia_reutilizada';
    end if;

    pagamento_id := v_replay.id;
    repetida := true;
    return next;
    return;
  end if;

  select p.*
    into v_pagamento
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.orcamento_id = p_orcamento_id
    and p.status = 'pendente'
  order by
    coalesce(p.data_vencimento::timestamp, p.created_at),
    p.parcela_numero nulls first,
    p.created_at,
    p.id
  limit 1
  for update;

  select e.valor_devido
    into v_valor_devido
  from public.orcamentos_com_estado e
  where e.id = p_orcamento_id
    and e.clinica_id = v_clinica_id;

  if v_valor_devido is null or v_valor_devido <= 0 then
    raise exception 'orcamento_sem_aprovacao';
  end if;

  select coalesce(sum(p.valor), 0)
    into v_valor_pago
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.orcamento_id = p_orcamento_id
    and p.status = 'pago';

  begin
    if v_pagamento.id is not null then
      if round((v_valor_pago + v_pagamento.valor) * 100) > round(v_valor_devido * 100) then
        raise exception 'valor_acima_do_saldo';
      end if;

      update public.pagamentos
      set status = 'pago',
          forma_pagamento = p_forma,
          data_pagamento = p_data,
          marcado_por_id = v_caller.id,
          operacao_id = p_operacao_id,
          updated_at = now()
      where id = v_pagamento.id
        and clinica_id = v_clinica_id
      returning * into v_pagamento;

      v_origem := 'previsao';
    else
      v_saldo := round((v_valor_devido - v_valor_pago) * 100) / 100;

      if v_saldo <= 0 then
        raise exception 'orcamento_quitado';
      end if;

      insert into public.pagamentos (
        clinica_id,
        orcamento_id,
        paciente_id,
        dentista_id,
        valor,
        status,
        forma_pagamento,
        data_pagamento,
        marcado_por_id,
        operacao_id
      ) values (
        v_clinica_id,
        v_orcamento.id,
        v_orcamento.paciente_id,
        v_orcamento.dentista_id,
        v_saldo,
        'pago',
        p_forma,
        p_data,
        v_caller.id,
        p_operacao_id
      )
      returning * into v_pagamento;

      v_origem := 'saldo';
    end if;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name is distinct from 'uq_pagamentos_clinica_operacao' then
        raise;
      end if;

      select p.*
        into v_replay
      from public.pagamentos p
      where p.clinica_id = v_clinica_id
        and p.operacao_id = p_operacao_id;

      if v_replay.id is null
         or v_replay.orcamento_id is distinct from p_orcamento_id
         or v_replay.marcado_por_id is distinct from v_caller.id
         or v_replay.forma_pagamento is distinct from p_forma
         or v_replay.data_pagamento is distinct from p_data then
        raise exception 'chave_idempotencia_reutilizada';
      end if;

      pagamento_id := v_replay.id;
      repetida := true;
      return next;
      return;
  end;

  if v_origem = 'saldo'
     and v_membership_role = 'secretaria'
     and v_orcamento.dentista_id is distinct from v_caller.id then
    begin
      select p.nome
        into v_paciente_nome
      from public.pacientes p
      where p.id = v_orcamento.paciente_id
        and p.clinica_id = v_clinica_id;

      v_paciente_nome := coalesce(v_paciente_nome, 'paciente');
      v_forma_label := case p_forma
        when 'pix' then 'PIX'
        when 'cartao_credito' then 'cartão de crédito'
        when 'cartao_debito' then 'cartão de débito'
        when 'boleto' then 'boleto'
        when 'dinheiro' then 'dinheiro'
        else 'outro'
      end;
      v_valor_label := 'R$ ' || translate(
        to_char(v_pagamento.valor, 'FM999G999G999G990D00'),
        '.,',
        ',.'
      );

      insert into public.notificacoes (
        clinica_id,
        para_role,
        para_dentista_id,
        de_dentista_id,
        tipo,
        titulo,
        mensagem,
        href
      ) values (
        v_clinica_id,
        'dentista',
        v_orcamento.dentista_id,
        v_caller.id,
        'pagamento_confirmado',
        'Pagamento recebido — ' || v_paciente_nome,
        'Secretária registrou ' || v_valor_label || ' (' || v_forma_label
          || ') do paciente ' || v_paciente_nome || '.',
        '/dashboard/pacientes/' || v_orcamento.paciente_id::text
      );

      v_notificacao_status := 'emitida';
    exception
      when others then
        v_notificacao_status := 'falhou';
    end;
  end if;

  select d.nome
    into v_actor_nome
  from public.dentistas d
  where d.id = v_caller.id
    and d.clinica_id = v_clinica_id;

  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id,
    v_caller.id,
    v_actor_nome,
    v_orcamento.paciente_id,
    'orcamento',
    v_orcamento.id::text,
    'pagamento.registrado',
    jsonb_build_object(
      'origem', 'pagamento_rapido',
      'efeito', v_origem,
      'orcamento_id', p_orcamento_id,
      'operacao_id', p_operacao_id,
      'valor', v_pagamento.valor,
      'forma_pagamento', p_forma,
      'data_pagamento', p_data,
      'notificacao_pagamento_confirmado', v_notificacao_status
    )
  );

  pagamento_id := v_pagamento.id;
  repetida := false;
  return next;
end;
$function$
;

-- registrar_recebimento_orcamento(p_orcamento_id uuid, p_valor numeric, p_forma text, p_data date)
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
$function$
;

-- registrar_recebimento_orcamento_idempotente(p_operacao_id uuid, p_orcamento_id uuid, p_valor numeric, p_forma text, p_data date)
CREATE OR REPLACE FUNCTION public.registrar_recebimento_orcamento_idempotente(p_operacao_id uuid, p_orcamento_id uuid, p_valor numeric, p_forma text, p_data date)
 RETURNS TABLE(pagamento_id uuid, dentista_id uuid, repetida boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membership_role text;
  v_caller record;
  v_orc public.orcamentos%rowtype;
  v_valor_devido numeric;
  v_valor_pago numeric;
  v_pagamento public.pagamentos%rowtype;
  v_replay public.pagamentos%rowtype;
  v_actor_nome text;
begin
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

  if p_operacao_id is null then raise exception 'operacao_id_invalida'; end if;
  if p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100 then
    raise exception 'valor_invalido';
  end if;
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then
    raise exception 'forma_invalida';
  end if;

  select o.* into v_orc
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

  select p.* into v_replay
    from public.pagamentos p
   where p.clinica_id = v_clinica_id
     and p.operacao_id = p_operacao_id;
  if v_replay.id is not null then
    if v_replay.marcado_por_id is distinct from v_caller.id
       or v_replay.orcamento_id is distinct from p_orcamento_id
       or round(v_replay.valor * 100) <> round(p_valor * 100)
       or v_replay.forma_pagamento is distinct from p_forma
       or v_replay.data_pagamento is distinct from p_data then
      raise exception 'chave_idempotencia_reutilizada';
    end if;
    return query select v_replay.id, v_replay.dentista_id, true;
    return;
  end if;

  select e.valor_devido into strict v_valor_devido
    from public.orcamentos_com_estado e
   where e.id = v_orc.id
     and e.clinica_id = v_clinica_id;
  if v_valor_devido <= 0 then raise exception 'orcamento_sem_aprovacao'; end if;

  select coalesce(sum(p.valor), 0) into v_valor_pago
    from public.pagamentos p
   where p.orcamento_id = v_orc.id
     and p.clinica_id = v_clinica_id
     and p.status = 'pago';
  if round((v_valor_pago + p_valor) * 100) > round(v_valor_devido * 100) then
    raise exception 'valor_acima_do_saldo';
  end if;

  begin
    insert into public.pagamentos (
      clinica_id, orcamento_id, paciente_id, dentista_id, valor, status,
      forma_pagamento, data_pagamento, marcado_por_id, operacao_id
    ) values (
      v_clinica_id, v_orc.id, v_orc.paciente_id, v_orc.dentista_id, p_valor, 'pago',
      p_forma, p_data, v_caller.id, p_operacao_id
    ) returning * into v_pagamento;
  exception when unique_violation then
    select p.* into v_replay
      from public.pagamentos p
     where p.clinica_id = v_clinica_id
       and p.operacao_id = p_operacao_id;
    if v_replay.id is not null
       and v_replay.marcado_por_id = v_caller.id
       and v_replay.orcamento_id = p_orcamento_id
       and round(v_replay.valor * 100) = round(p_valor * 100)
       and v_replay.forma_pagamento = p_forma
       and v_replay.data_pagamento = p_data then
      return query select v_replay.id, v_replay.dentista_id, true;
      return;
    end if;
    raise exception 'chave_idempotencia_reutilizada';
  end;

  select d.nome into v_actor_nome
    from public.dentistas d
   where d.id = v_caller.id
     and d.clinica_id = v_clinica_id;
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_caller.id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.registrado', jsonb_build_object(
      'valor', p_valor, 'forma', p_forma, 'orcamento_id', v_orc.id, 'operacao_id', p_operacao_id
    )
  );

  return query select v_pagamento.id, v_pagamento.dentista_id, false;
end;
$function$
;

-- trg_pacientes_nome_busca()
CREATE OR REPLACE FUNCTION public.trg_pacientes_nome_busca()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.nome_busca := public.normalizar_nome(NEW.nome);
  RETURN NEW;
END;
$function$
;

-- validar_evento_orcamento_da_ficha()
CREATE OR REPLACE FUNCTION public.validar_evento_orcamento_da_ficha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_orcamento public.orcamentos%rowtype;
begin
  select * into v_orcamento
  from public.orcamentos o
  where o.id = new.orcamento_id
    and o.clinica_id = new.clinica_id;

  if not found or v_orcamento.ficha_id is null or not exists (
    select 1
    from public.odontograma_eventos e
    join public.fichas f on f.id = e.ficha_id
    where e.id = new.evento_id
      and e.clinica_id = new.clinica_id
      and e.ficha_id = v_orcamento.ficha_id
      and f.paciente_id = v_orcamento.paciente_id
      and e.origem = 'clinica'
      and coalesce(e.encaminhado_para, e.dentista_id, f.dentista_id) = v_orcamento.dentista_id
  ) then
    raise exception 'orcamento_evento_ficha_invalido';
  end if;

  return new;
end;
$function$
;

-- validar_item_orcamento_catalogo_dono()
CREATE OR REPLACE FUNCTION public.validar_item_orcamento_catalogo_dono()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_orcamento public.orcamentos%rowtype;
begin
  if new.procedimento_id is null then
    return new;
  end if;

  select * into v_orcamento
  from public.orcamentos o
  where o.id = new.orcamento_id
    and o.clinica_id = new.clinica_id;

  if not found or not exists (
    select 1
    from public.procedimentos p
    where p.id = new.procedimento_id
      and p.clinica_id = new.clinica_id
      and p.dentista_id = v_orcamento.dentista_id
  ) then
    raise exception 'orcamento_procedimento_de_outro_dentista';
  end if;

  return new;
end;
$function$
;

