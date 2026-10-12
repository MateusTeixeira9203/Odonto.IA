-- R-189 — caminho novo e aditivo para recebimento manual idempotente.
-- A RPC antiga continua disponível até todos os consumidores adotarem operacao_id.
alter table public.pagamentos
  add column if not exists operacao_id uuid null;

create unique index if not exists uq_pagamentos_clinica_operacao
  on public.pagamentos (clinica_id, operacao_id)
  where operacao_id is not null;

create or replace function public.registrar_recebimento_orcamento_idempotente(
  p_operacao_id uuid,
  p_orcamento_id uuid,
  p_valor numeric,
  p_forma text,
  p_data date
) returns table (
  pagamento_id uuid,
  dentista_id uuid,
  repetida boolean
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.registrar_recebimento_orcamento_idempotente(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.registrar_recebimento_orcamento_idempotente(uuid, uuid, numeric, text, date) to authenticated;
