-- R-194: registra o pagamento rápido inteiro em uma única transação idempotente.
-- Depende de pagamentos.operacao_id e uq_pagamentos_clinica_operacao, ambos da R-189.

create or replace function public.registrar_pagamento_rapido_idempotente(
  p_operacao_id uuid,
  p_orcamento_id uuid,
  p_forma text,
  p_data date
)
returns table (
  pagamento_id uuid,
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
$$;

revoke all on function public.registrar_pagamento_rapido_idempotente(uuid, uuid, text, date)
  from public, anon;
grant execute on function public.registrar_pagamento_rapido_idempotente(uuid, uuid, text, date)
  to authenticated;
