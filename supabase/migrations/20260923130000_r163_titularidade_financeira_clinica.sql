-- R-163: separa o caixa da unidade dos silos financeiros pessoais.
-- Não reatribui fatos históricos: tudo que já existia permanece como titular dentista.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.orcamentos
  add column if not exists titular_financeiro text not null default 'dentista'
  check (titular_financeiro in ('dentista', 'clinica'));

alter table public.orcamento_cobrancas
  add column if not exists titular_financeiro text not null default 'dentista'
  check (titular_financeiro in ('dentista', 'clinica'));

alter table public.pagamentos
  add column if not exists titular_financeiro text not null default 'dentista'
  check (titular_financeiro in ('dentista', 'clinica'));

alter table public.despesas
  add column if not exists titular_financeiro text not null default 'dentista'
  check (titular_financeiro in ('dentista', 'clinica'));

alter table public.receitas_manuais
  add column if not exists titular_financeiro text not null default 'dentista'
  check (titular_financeiro in ('dentista', 'clinica'));

create index if not exists orcamentos_financeiro_clinica_idx
  on public.orcamentos (clinica_id, titular_financeiro, status, updated_at desc);
create index if not exists pagamentos_financeiro_clinica_idx
  on public.pagamentos (clinica_id, titular_financeiro, status, data_pagamento, dentista_id);
create index if not exists despesas_financeiro_clinica_idx
  on public.despesas (clinica_id, titular_financeiro, data, tipo);
create index if not exists receitas_manuais_financeiro_clinica_idx
  on public.receitas_manuais (clinica_id, titular_financeiro, data);

-- Regra de projeção, nunca um lançamento de caixa. O lançamento efetivo continua em despesas.
create table if not exists public.despesas_recorrentes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 160),
  categoria text not null check (char_length(btrim(categoria)) between 1 and 80),
  valor numeric(12,2) not null check (valor > 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  ativo boolean not null default true,
  criado_por_usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists despesas_recorrentes_clinica_ativas_idx
  on public.despesas_recorrentes (clinica_id, ativo, categoria, created_at desc);

alter table public.despesas_recorrentes enable row level security;
revoke all on table public.despesas_recorrentes from public, anon, authenticated;

create or replace function private.titular_financeiro_modalidade(
  p_clinica_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select case
    when exists (
      select 1
      from public.clinica_governanca g
      where g.clinica_id = p_clinica_id
        and g.modalidade = 'gerida'
    ) then 'clinica'
    else 'dentista'
  end;
$$;

create or replace function private.definir_titular_financeiro()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_titular text;
begin
  if tg_table_name = 'pagamentos' then
    select o.titular_financeiro
      into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id
      and o.clinica_id = new.clinica_id;

    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  elsif tg_table_name = 'orcamento_cobrancas' then
    select o.titular_financeiro
      into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id
      and o.clinica_id = new.clinica_id;

    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  else
    v_titular := private.titular_financeiro_modalidade(new.clinica_id);
  end if;

  new.titular_financeiro := v_titular;
  return new;
end;
$$;

drop trigger if exists r163_orcamentos_titular_financeiro on public.orcamentos;
create trigger r163_orcamentos_titular_financeiro
before insert on public.orcamentos
for each row execute function private.definir_titular_financeiro();

drop trigger if exists r163_orcamento_cobrancas_titular_financeiro on public.orcamento_cobrancas;
create trigger r163_orcamento_cobrancas_titular_financeiro
before insert on public.orcamento_cobrancas
for each row execute function private.definir_titular_financeiro();

drop trigger if exists r163_pagamentos_titular_financeiro on public.pagamentos;
create trigger r163_pagamentos_titular_financeiro
before insert on public.pagamentos
for each row execute function private.definir_titular_financeiro();

drop trigger if exists r163_despesas_titular_financeiro on public.despesas;
create trigger r163_despesas_titular_financeiro
before insert on public.despesas
for each row execute function private.definir_titular_financeiro();

drop trigger if exists r163_receitas_manuais_titular_financeiro on public.receitas_manuais;
create trigger r163_receitas_manuais_titular_financeiro
before insert on public.receitas_manuais
for each row execute function private.definir_titular_financeiro();

create or replace function public.obter_financeiro_clinica(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_pode_ler boolean := false;
  v_inicio date;
  v_fim date;
  v_recebido numeric := 0;
  v_despesas numeric := 0;
  v_despesas_fixas numeric := 0;
  v_a_receber numeric := 0;
  v_vencido numeric := 0;
  v_resultado numeric := 0;
  v_saldo_caixa numeric := 0;
  v_margem numeric;
  v_folego numeric;
  v_despesas_fixas_previstas numeric := 0;
  v_pode_gerir_custos boolean := false;
  v_recorrencias jsonb := '[]'::jsonb;
  v_chart jsonb := '[]'::jsonb;
  v_profissionais jsonb := '[]'::jsonb;
  v_extrato jsonb := '[]'::jsonb;
begin
  perform set_config('lock_timeout', '1500ms', true);
  perform set_config('statement_timeout', '15s', true);

  if v_ator_id is null or p_clinica_id_esperada is null or p_mes_referencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao financeiro desta clínica.');
  end if;

  select u.active_clinica_id
    into v_clinica_id
  from public.users u
  where u.id = v_ator_id;

  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select cu.id
    into v_membro_id
  from public.clinica_usuarios cu
  where cu.usuario_id = v_ator_id
    and cu.clinica_id = v_clinica_id
    and cu.status = 'ativo'
  limit 1;

  if v_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao financeiro desta clínica.');
  end if;

  select
    exists (
      select 1
      from public.clinica_vinculos_governanca v
      where v.clinica_id = v_clinica_id
        and v.membro_id = v_membro_id
        and v.papel = 'proprietario'
        and v.estado = 'ativo'
    )
    or exists (
      select 1
      from public.clinica_acessos a
      cross join lateral jsonb_array_elements(a.acessos) item
      where a.clinica_id = v_clinica_id
        and a.membro_id = v_membro_id
        and item ->> 'permissao' = 'financeiro.ler'
        and item -> 'escopo' ->> 'tipo' = 'clinica'
    )
  into v_pode_ler;

  if not v_pode_ler then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não tem acesso ao financeiro desta clínica.');
  end if;

  select
    exists (
      select 1
      from public.clinica_vinculos_governanca v
      where v.clinica_id = v_clinica_id
        and v.membro_id = v_membro_id
        and v.papel = 'proprietario'
        and v.estado = 'ativo'
    )
    or exists (
      select 1
      from public.clinica_acessos a
      cross join lateral jsonb_array_elements(a.acessos) item
      where a.clinica_id = v_clinica_id
        and a.membro_id = v_membro_id
        and item ->> 'permissao' = 'despesas.gerir'
        and item -> 'escopo' ->> 'tipo' = 'clinica'
    )
  into v_pode_gerir_custos;

  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;

  select
    coalesce(sum(r.valor) filter (where r.ativo), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id::text,
      'descricao', r.descricao,
      'categoria', r.categoria,
      'valor', r.valor,
      'diaVencimento', r.dia_vencimento,
      'ativo', r.ativo
    ) order by r.ativo desc, r.descricao), '[]'::jsonb)
  into v_despesas_fixas_previstas, v_recorrencias
  from public.despesas_recorrentes r
  where r.clinica_id = v_clinica_id;

  select coalesce(sum(p.valor), 0)
    into v_recebido
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.titular_financeiro = 'clinica'
    and p.status = 'pago'
    and p.data_pagamento >= v_inicio
    and p.data_pagamento < v_fim;

  select v_recebido + coalesce(sum(r.valor), 0)
    into v_recebido
  from public.receitas_manuais r
  where r.clinica_id = v_clinica_id
    and r.titular_financeiro = 'clinica'
    and r.data >= v_inicio
    and r.data < v_fim;

  select
    coalesce(sum(d.valor), 0),
    coalesce(sum(d.valor) filter (where d.tipo = 'fixo'), 0)
  into v_despesas, v_despesas_fixas
  from public.despesas d
  where d.clinica_id = v_clinica_id
    and d.titular_financeiro = 'clinica'
    and d.data >= v_inicio
    and d.data < v_fim;

  select
    coalesce(sum(p.valor), 0),
    coalesce(sum(p.valor) filter (where p.data_vencimento is not null and p.data_vencimento < current_date), 0)
  into v_a_receber, v_vencido
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.titular_financeiro = 'clinica'
    and p.status = 'pendente';

  v_resultado := v_recebido - v_despesas;
  v_margem := case when v_recebido > 0 then round((v_resultado / v_recebido) * 100, 1) else null end;

  select
    coalesce(sum(p.valor) filter (where p.status = 'pago'), 0)
    + coalesce((
      select sum(r.valor)
      from public.receitas_manuais r
      where r.clinica_id = v_clinica_id
        and r.titular_financeiro = 'clinica'
    ), 0)
    - coalesce((
      select sum(d.valor)
      from public.despesas d
      where d.clinica_id = v_clinica_id
        and d.titular_financeiro = 'clinica'
    ), 0)
  into v_saldo_caixa
  from public.pagamentos p
  where p.clinica_id = v_clinica_id
    and p.titular_financeiro = 'clinica';

  v_folego := case when v_despesas_fixas_previstas > 0 then round(v_saldo_caixa / v_despesas_fixas_previstas, 1) else null end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'mesISO', to_char(m.mes, 'YYYY-MM'),
    'mes', trim(to_char(m.mes, 'Mon')),
    'recebido', coalesce((
      select sum(p.valor)
      from public.pagamentos p
      where p.clinica_id = v_clinica_id
        and p.titular_financeiro = 'clinica'
        and p.status = 'pago'
        and p.data_pagamento >= m.mes::date
        and p.data_pagamento < (m.mes + interval '1 month')::date
    ), 0) + coalesce((
      select sum(r.valor)
      from public.receitas_manuais r
      where r.clinica_id = v_clinica_id
        and r.titular_financeiro = 'clinica'
        and r.data >= m.mes::date
        and r.data < (m.mes + interval '1 month')::date
    ), 0),
    'despesas', coalesce((
      select sum(d.valor)
      from public.despesas d
      where d.clinica_id = v_clinica_id
        and d.titular_financeiro = 'clinica'
        and d.data >= m.mes::date
        and d.data < (m.mes + interval '1 month')::date
    ), 0)
  ) order by m.mes), '[]'::jsonb)
  into v_chart
  from generate_series(v_inicio - interval '5 months', v_inicio, interval '1 month') as m(mes);

  select coalesce(jsonb_agg(jsonb_build_object(
    'dentistaId', linha.id::text,
    'nome', linha.nome,
    'producaoAprovada', linha.producao_aprovada,
    'recebidoVinculado', linha.recebido_vinculado,
    'aReceber', linha.a_receber
  ) order by linha.nome), '[]'::jsonb)
  into v_profissionais
  from (
    select
      d.id,
      d.nome,
      coalesce((
        select sum(coalesce(o.valor_acordado, o.total, 0))
        from public.orcamentos o
        where o.clinica_id = v_clinica_id
          and o.dentista_id = d.id
          and o.titular_financeiro = 'clinica'
          and o.status = 'aprovado'
          and o.updated_at >= v_inicio
          and o.updated_at < v_fim
      ), 0) as producao_aprovada,
      coalesce((
        select sum(p.valor)
        from public.pagamentos p
        where p.clinica_id = v_clinica_id
          and p.dentista_id = d.id
          and p.titular_financeiro = 'clinica'
          and p.status = 'pago'
          and p.data_pagamento >= v_inicio
          and p.data_pagamento < v_fim
      ), 0) as recebido_vinculado,
      coalesce((
        select sum(p.valor)
        from public.pagamentos p
        where p.clinica_id = v_clinica_id
          and p.dentista_id = d.id
          and p.titular_financeiro = 'clinica'
          and p.status = 'pendente'
      ), 0) as a_receber
    from public.dentistas d
    where d.clinica_id = v_clinica_id
      and d.ativo
      and d.role in ('admin', 'dentista')
  ) linha;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', linha.id::text,
    'tipo', linha.tipo,
    'descricao', linha.descricao,
    'data', to_char(linha.data, 'YYYY-MM-DD'),
    'valor', linha.valor
  ) order by linha.data desc, linha.id desc), '[]'::jsonb)
  into v_extrato
  from (
    select p.id, 'recebimento'::text as tipo,
      coalesce(pa.nome, 'Recebimento de tratamento') as descricao,
      p.data_pagamento::date as data, p.valor
    from public.pagamentos p
    left join public.pacientes pa on pa.id = p.paciente_id and pa.clinica_id = p.clinica_id
    where p.clinica_id = v_clinica_id and p.titular_financeiro = 'clinica'
      and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim
    union all
    select r.id, 'receita_manual'::text, coalesce(r.descricao, 'Receita manual'), r.data, r.valor
    from public.receitas_manuais r
    where r.clinica_id = v_clinica_id and r.titular_financeiro = 'clinica'
      and r.data >= v_inicio and r.data < v_fim
    union all
    select d.id, 'despesa'::text, coalesce(d.descricao, d.categoria), d.data, -d.valor
    from public.despesas d
    where d.clinica_id = v_clinica_id and d.titular_financeiro = 'clinica'
      and d.data >= v_inicio and d.data < v_fim
    order by data desc
    limit 8
  ) linha;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'clinicaId', v_clinica_id::text,
      'mes', to_char(v_inicio, 'YYYY-MM'),
      'recebido', v_recebido,
      'despesas', v_despesas,
      'resultadoOperacional', v_resultado,
      'margemOperacional', v_margem,
      'saldoCaixa', v_saldo_caixa,
      'aReceber', v_a_receber,
      'vencido', v_vencido,
      'despesasFixas', v_despesas_fixas,
      'despesasFixasPrevistas', v_despesas_fixas_previstas,
      'folegoCaixaMeses', v_folego,
      'temBaseDeCustos', v_despesas > 0 or v_despesas_fixas_previstas > 0,
      'podeGerirCustos', v_pode_gerir_custos,
      'recorrencias', v_recorrencias,
      'chart', v_chart,
      'profissionais', v_profissionais,
      'extrato', v_extrato
    )
  );
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o financeiro agora.');
  when others then
    return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o financeiro agora.');
end;
$$;

revoke all on function public.obter_financeiro_clinica(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_financeiro_clinica(uuid, date) to authenticated;

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
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_membro_id uuid;
  v_pode_gerir boolean := false;
  v_registro public.despesas_recorrentes%rowtype;
begin
  if v_ator_id is null or p_clinica_id_esperada is null
    or char_length(btrim(coalesce(p_descricao, ''))) not between 1 and 160
    or char_length(btrim(coalesce(p_categoria, ''))) not between 1 and 80
    or p_valor is null or p_valor <= 0
    or p_dia_vencimento is null or p_dia_vencimento not between 1 and 28 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise os dados do custo fixo.');
  end if;

  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;

  select id into v_membro_id from public.clinica_usuarios
  where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  if v_membro_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso à clínica.');
  end if;

  select exists (
    select 1 from public.clinica_vinculos_governanca v
    where v.clinica_id = v_clinica_id and v.membro_id = v_membro_id
      and v.papel = 'proprietario' and v.estado = 'ativo'
  ) or exists (
    select 1 from public.clinica_acessos a
    cross join lateral jsonb_array_elements(a.acessos) item
    where a.clinica_id = v_clinica_id and a.membro_id = v_membro_id
      and item ->> 'permissao' = 'despesas.gerir'
      and item -> 'escopo' ->> 'tipo' = 'clinica'
  ) into v_pode_gerir;

  if not v_pode_gerir then
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
    'id', v_registro.id::text, 'descricao', v_registro.descricao, 'categoria', v_registro.categoria,
    'valor', v_registro.valor, 'diaVencimento', v_registro.dia_vencimento, 'ativo', v_registro.ativo
  ));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível salvar o custo fixo agora.');
end;
$$;

revoke all on function public.salvar_despesa_recorrente(uuid, uuid, text, text, numeric, smallint, boolean) from public, anon, authenticated, service_role;
grant execute on function public.salvar_despesa_recorrente(uuid, uuid, text, text, numeric, smallint, boolean) to authenticated;
