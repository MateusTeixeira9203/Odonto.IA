-- R-177: autoriza lançamentos financeiros por permissão delegada, não por cargo.
-- Preserva fatos e tabelas legados. O saldo manual deixa de ser uma operação exposta.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function private.r177_tem_permissao_financeira_clinica(
  p_clinica_id uuid,
  p_ator_id uuid,
  p_permissao text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinica_vinculos_governanca v
    join public.clinica_usuarios m on m.id = v.membro_id
    where v.clinica_id = p_clinica_id
      and m.usuario_id = p_ator_id
      and m.status = 'ativo'
      and v.estado = 'ativo'
      and v.papel in ('proprietario', 'gestor')
  ) or exists (
    select 1
    from public.clinica_usuarios m
    join public.clinica_acessos a
      on a.clinica_id = m.clinica_id
      and a.membro_id = m.id
    cross join lateral jsonb_array_elements(a.acessos) acesso
    where m.clinica_id = p_clinica_id
      and m.usuario_id = p_ator_id
      and m.status = 'ativo'
      and acesso ->> 'permissao' = p_permissao
      and acesso -> 'escopo' ->> 'tipo' = 'clinica'
  );
$$;

create or replace function public.obter_acoes_financeiras_clinica(
  p_clinica_id_esperada uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
begin
  if v_ator_id is null or p_clinica_id_esperada is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso às ações financeiras.');
  end if;
  select u.active_clinica_id into v_clinica_id
  from public.users u
  where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not exists (
    select 1
    from public.clinica_governanca g
    where g.clinica_id = v_clinica_id and g.modalidade = 'gerida'
  ) then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('podeRegistrarEntrada', false, 'podeRegistrarCusto', false));
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'podeRegistrarEntrada', private.r177_tem_permissao_financeira_clinica(v_clinica_id, v_ator_id, 'recebimentos.registrar'),
    'podeRegistrarCusto', private.r177_tem_permissao_financeira_clinica(v_clinica_id, v_ator_id, 'despesas.gerir')
  ));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar as ações financeiras.');
end;
$$;

create or replace function public.registrar_lancamento_clinica(
  p_clinica_id_esperada uuid,
  p_tipo text,
  p_valor numeric,
  p_data date,
  p_descricao text,
  p_categoria text default null,
  p_forma text default null,
  p_dentista_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_id uuid;
  v_permissao text;
begin
  if v_ator_id is null
    or p_clinica_id_esperada is null
    or p_tipo not in ('entrada', 'saida')
    or p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100
    or p_data is null
    or char_length(btrim(coalesce(p_descricao, ''))) not between 2 and 160
    or (p_tipo = 'entrada' and coalesce(p_forma, 'outro') not in ('pix', 'dinheiro', 'transferencia', 'cartao_credito', 'cartao_debito', 'boleto', 'outro'))
    or (p_tipo = 'saida' and char_length(btrim(coalesce(p_categoria, ''))) not between 2 and 80) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise os dados do lançamento.');
  end if;

  select u.active_clinica_id into v_clinica_id
  from public.users u
  where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not exists (
    select 1
    from public.clinica_governanca g
    where g.clinica_id = v_clinica_id and g.modalidade = 'gerida'
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'O caixa da clínica é usado somente na modalidade gerida.');
  end if;

  v_permissao := case when p_tipo = 'entrada' then 'recebimentos.registrar' else 'despesas.gerir' end;
  if not private.r177_tem_permissao_financeira_clinica(v_clinica_id, v_ator_id, v_permissao) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não tem permissão para este lançamento.');
  end if;

  if p_dentista_id is not null and not exists (
    select 1
    from public.dentistas d
    where d.id = p_dentista_id
      and d.clinica_id = v_clinica_id
      and d.ativo
      and d.role in ('admin', 'dentista')
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'O profissional selecionado não pertence à clínica.');
  end if;

  if p_tipo = 'entrada' then
    insert into public.receitas_manuais (
      clinica_id, dentista_id, valor, forma, data, descricao, origem_lancamento
    ) values (
      v_clinica_id, p_dentista_id, p_valor, coalesce(p_forma, 'outro'), p_data,
      btrim(p_descricao), 'clinica'
    ) returning id into v_id;
  else
    insert into public.despesas (
      clinica_id, valor, categoria, tipo, data, descricao, origem_lancamento,
      situacao, competencia, data_vencimento, pago_em
    ) values (
      v_clinica_id, p_valor, btrim(p_categoria), 'variavel', p_data,
      btrim(p_descricao), 'clinica', 'pago', date_trunc('month', p_data)::date,
      p_data, p_data
    ) returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id::text));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível registrar o lançamento agora.');
end;
$$;

create or replace function public.salvar_despesa_recorrente(
  p_clinica_id_esperada uuid,
  p_id uuid,
  p_descricao text,
  p_categoria text,
  p_valor numeric,
  p_dia_vencimento smallint,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_registro public.despesas_recorrentes%rowtype;
begin
  if v_ator_id is null or p_clinica_id_esperada is null
    or char_length(btrim(coalesce(p_descricao, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_categoria, ''))) not between 1 and 80
    or p_valor is null or p_valor <= 0
    or p_dia_vencimento is null or p_dia_vencimento not between 1 and 28 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise os dados do custo fixo.');
  end if;

  select u.active_clinica_id into v_clinica_id
  from public.users u
  where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not private.r177_tem_permissao_financeira_clinica(v_clinica_id, v_ator_id, 'despesas.gerir') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode alterar os custos fixos.');
  end if;

  if p_id is null then
    insert into public.despesas_recorrentes (
      clinica_id, descricao, categoria, valor, dia_vencimento, ativo, criado_por_usuario_id
    ) values (
      v_clinica_id, btrim(p_descricao), btrim(p_categoria), p_valor, p_dia_vencimento, p_ativo, v_ator_id
    ) returning * into v_registro;
  else
    update public.despesas_recorrentes
    set descricao = btrim(p_descricao), categoria = btrim(p_categoria), valor = p_valor,
      dia_vencimento = p_dia_vencimento, ativo = p_ativo, updated_at = now()
    where id = p_id and clinica_id = v_clinica_id
    returning * into v_registro;
    if v_registro.id is null then
      return jsonb_build_object('ok', false, 'codigo', 'AUSENTE', 'mensagem', 'Esse custo fixo não existe nesta clínica.');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'id', v_registro.id::text,
    'descricao', v_registro.descricao,
    'categoria', v_registro.categoria,
    'valor', v_registro.valor,
    'diaVencimento', v_registro.dia_vencimento,
    'ativo', v_registro.ativo
  ));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível salvar o custo fixo agora.');
end;
$$;

create or replace function public.confirmar_competencia_recorrente_paga(
  p_clinica_id_esperada uuid,
  p_competencia_id uuid,
  p_pago_em date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_competencia public.despesas_recorrentes_competencias%rowtype;
  v_despesa_id uuid;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_competencia_id is null or p_pago_em is null then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise o pagamento do custo fixo.');
  end if;
  select u.active_clinica_id into v_clinica_id
  from public.users u
  where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not private.r177_tem_permissao_financeira_clinica(v_clinica_id, v_ator_id, 'despesas.gerir') then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode confirmar este custo fixo.');
  end if;

  select * into v_competencia
  from public.despesas_recorrentes_competencias c
  where c.id = p_competencia_id and c.clinica_id = v_clinica_id
  for update;
  if v_competencia.id is null then
    return jsonb_build_object('ok', false, 'codigo', 'AUSENTE', 'mensagem', 'Essa competência não existe nesta clínica.');
  end if;
  if v_competencia.situacao = 'pago' then
    return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_competencia.despesa_id::text, 'jaConfirmado', true));
  end if;
  if v_competencia.situacao <> 'previsto' then
    return jsonb_build_object('ok', false, 'codigo', 'CONFLITO', 'mensagem', 'Essa competência não pode ser confirmada.');
  end if;

  insert into public.despesas (
    clinica_id, valor, categoria, tipo, data, descricao, origem_lancamento,
    situacao, competencia, data_vencimento, pago_em
  ) values (
    v_clinica_id, v_competencia.valor, v_competencia.categoria, 'fixo', p_pago_em,
    v_competencia.descricao, 'clinica', 'pago', v_competencia.competencia,
    v_competencia.data_vencimento, p_pago_em
  ) returning id into v_despesa_id;
  update public.despesas_recorrentes_competencias
  set situacao = 'pago', despesa_id = v_despesa_id, pago_em = p_pago_em, updated_at = now()
  where id = v_competencia.id;

  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_despesa_id::text, 'jaConfirmado', false));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível confirmar o custo fixo agora.');
end;
$$;

-- Os dados de saldo histórico são preservados para auditoria, mas a operação deixa de
-- ser chamável até existir integração bancária e conciliação de verdade.
revoke execute on function public.informar_saldo_bancario_clinica(uuid, date, numeric) from authenticated;

revoke all on function private.r177_tem_permissao_financeira_clinica(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.obter_acoes_financeiras_clinica(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_acoes_financeiras_clinica(uuid) to authenticated;
revoke all on function public.registrar_lancamento_clinica(uuid, text, numeric, date, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.registrar_lancamento_clinica(uuid, text, numeric, date, text, text, text, uuid) to authenticated;
revoke all on function public.salvar_despesa_recorrente(uuid, uuid, text, text, numeric, smallint, boolean) from public, anon, authenticated, service_role;
grant execute on function public.salvar_despesa_recorrente(uuid, uuid, text, text, numeric, smallint, boolean) to authenticated;
revoke all on function public.confirmar_competencia_recorrente_paga(uuid, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.confirmar_competencia_recorrente_paga(uuid, uuid, date) to authenticated;
