-- REJEITADA / NÃO APLICAR — evidência do candidato R-194 reprovado em 11/10/2026.
-- Falhas S1/S2: replay sem autorização/contexto de orçamento e parcela nula rejeitada antes de replay.
-- Preservada fora de supabase/migrations para impedir aplicação acidental.
-- R-194 — confirmação idempotente exclusiva do atalho de pagamento rápido.
-- Depende de R-189: pagamentos.operacao_id e uq_pagamentos_clinica_operacao.
create or replace function public.confirmar_previsao_orcamento_idempotente(
  p_operacao_id uuid,
  p_pagamento_id uuid,
  p_forma text,
  p_data date
) returns table (pagamento_id uuid, dentista_id uuid, repetida boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membership_role text;
  v_caller record;
  v_pagamento public.pagamentos%rowtype;
  v_replay public.pagamentos%rowtype;
  v_orc public.orcamentos%rowtype;
  v_valor_devido numeric;
  v_valor_pago numeric;
  v_actor_nome text;
begin
  if v_auth_user_id is null then raise exception 'sem_permissao'; end if;
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_auth_user_id;
  if v_clinica_id is null then raise exception 'sem_permissao'; end if;
  select cu.role into v_membership_role from public.clinica_usuarios cu
   where cu.usuario_id = v_auth_user_id and cu.clinica_id = v_clinica_id and cu.status = 'ativo';
  if v_membership_role is null or v_membership_role not in ('admin', 'dentista', 'secretaria') then raise exception 'sem_permissao'; end if;
  select d.id, d.role into v_caller from public.dentistas d
   where d.user_id = v_auth_user_id and d.clinica_id = v_clinica_id and d.ativo = true;
  if v_caller.id is null or v_caller.role not in ('admin', 'dentista', 'secretaria')
     or v_caller.role is distinct from v_membership_role then raise exception 'sem_permissao'; end if;
  if p_operacao_id is null then raise exception 'operacao_id_invalida'; end if;
  if p_pagamento_id is null then raise exception 'previsao_indisponivel'; end if;
  if p_data is null then raise exception 'data_invalida'; end if;
  if p_forma is null or p_forma not in ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') then raise exception 'forma_invalida'; end if;

  -- Replay vem antes de escolher/verificar a próxima parcela: o ID sugerido pode ter mudado.
  select p.* into v_replay from public.pagamentos p
   where p.clinica_id = v_clinica_id and p.operacao_id = p_operacao_id;
  if v_replay.id is not null then
    if v_replay.marcado_por_id is distinct from v_caller.id
       or v_replay.forma_pagamento is distinct from p_forma
       or v_replay.data_pagamento is distinct from p_data then
      raise exception 'chave_idempotencia_reutilizada';
    end if;
    return query select v_replay.id, v_replay.dentista_id, true;
    return;
  end if;

  select p.* into v_pagamento from public.pagamentos p
   where p.id = p_pagamento_id and p.clinica_id = v_clinica_id;
  if v_pagamento.id is null or v_pagamento.status <> 'pendente' then raise exception 'previsao_indisponivel'; end if;
  select o.* into v_orc from public.orcamentos o
   where o.id = v_pagamento.orcamento_id and o.clinica_id = v_clinica_id for update;
  if v_orc.id is null then raise exception 'sem_permissao'; end if;
  if v_caller.role in ('admin', 'dentista') and v_orc.dentista_id is distinct from v_caller.id then raise exception 'sem_permissao'; end if;

  select p.* into v_replay from public.pagamentos p
   where p.clinica_id = v_clinica_id and p.operacao_id = p_operacao_id;
  if v_replay.id is not null then
    if v_replay.marcado_por_id is distinct from v_caller.id
       or v_replay.forma_pagamento is distinct from p_forma
       or v_replay.data_pagamento is distinct from p_data then raise exception 'chave_idempotencia_reutilizada'; end if;
    return query select v_replay.id, v_replay.dentista_id, true;
    return;
  end if;

  select e.valor_devido into strict v_valor_devido from public.orcamentos_com_estado e
   where e.id = v_orc.id and e.clinica_id = v_clinica_id;
  select coalesce(sum(p.valor), 0) into v_valor_pago from public.pagamentos p
   where p.orcamento_id = v_orc.id and p.clinica_id = v_clinica_id and p.status = 'pago';
  if round((v_valor_pago + v_pagamento.valor) * 100) > round(v_valor_devido * 100) then raise exception 'valor_acima_do_saldo'; end if;

  begin
    update public.pagamentos set status = 'pago', forma_pagamento = p_forma, data_pagamento = p_data,
      marcado_por_id = v_caller.id, operacao_id = p_operacao_id
     where id = v_pagamento.id and clinica_id = v_clinica_id and status = 'pendente'
     returning * into v_pagamento;
  exception when unique_violation then
    select p.* into v_replay from public.pagamentos p where p.clinica_id = v_clinica_id and p.operacao_id = p_operacao_id;
    if v_replay.id is not null and v_replay.marcado_por_id = v_caller.id
       and v_replay.forma_pagamento = p_forma and v_replay.data_pagamento = p_data then
      return query select v_replay.id, v_replay.dentista_id, true;
      return;
    end if;
    raise exception 'chave_idempotencia_reutilizada';
  end;
  if v_pagamento.id is null then raise exception 'previsao_indisponivel'; end if;

  select d.nome into v_actor_nome from public.dentistas d where d.id = v_caller.id and d.clinica_id = v_clinica_id;
  insert into public.activity_logs (clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller.id, v_actor_nome, v_orc.paciente_id, 'orcamento', v_orc.id::text,
    'pagamento.registrado', jsonb_build_object('valor', v_pagamento.valor, 'forma', p_forma, 'orcamento_id', v_orc.id, 'origem', 'previsao', 'operacao_id', p_operacao_id));
  return query select v_pagamento.id, v_pagamento.dentista_id, false;
end;
$$;

revoke all on function public.confirmar_previsao_orcamento_idempotente(uuid, uuid, text, date) from public, anon;
grant execute on function public.confirmar_previsao_orcamento_idempotente(uuid, uuid, text, date) to authenticated;
