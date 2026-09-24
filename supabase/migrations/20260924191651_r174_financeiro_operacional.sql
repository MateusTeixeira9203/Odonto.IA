-- R-174: fatos financeiros da clínica, lançamentos manuais controlados e
-- competências de custos recorrentes. Nenhum fato histórico é reclassificado.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.despesas
  add column if not exists situacao text not null default 'pago'
    check (situacao in ('previsto', 'pago', 'cancelado')),
  add column if not exists competencia date,
  add column if not exists data_vencimento date,
  add column if not exists pago_em date;

create index if not exists despesas_clinica_situacao_competencia_idx
  on public.despesas (clinica_id, titular_financeiro, situacao, competencia);

create table if not exists public.despesas_recorrentes_competencias (
  id uuid primary key default gen_random_uuid(),
  recorrencia_id uuid not null references public.despesas_recorrentes(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  competencia date not null,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 160),
  categoria text not null check (char_length(btrim(categoria)) between 1 and 80),
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  situacao text not null default 'previsto' check (situacao in ('previsto', 'pago', 'cancelado')),
  despesa_id uuid unique references public.despesas(id) on delete restrict,
  criado_por_usuario_id uuid not null references auth.users(id),
  pago_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recorrencia_id, competencia),
  check (
    (situacao = 'pago' and despesa_id is not null and pago_em is not null)
    or (situacao in ('previsto', 'cancelado') and despesa_id is null and pago_em is null)
  )
);

create index if not exists despesas_recorrentes_competencias_clinica_idx
  on public.despesas_recorrentes_competencias (clinica_id, competencia, situacao);

alter table public.despesas_recorrentes_competencias enable row level security;
revoke all on table public.despesas_recorrentes_competencias from public, anon, authenticated;

create or replace function private.r174_materializar_competencias_recorrentes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ativo then
    insert into public.despesas_recorrentes_competencias (
      recorrencia_id, clinica_id, competencia, descricao, categoria, valor,
      data_vencimento, situacao, criado_por_usuario_id
    )
    select
      new.id, new.clinica_id, mes.competencia, new.descricao, new.categoria,
      new.valor, (mes.competencia + (new.dia_vencimento - 1) * interval '1 day')::date,
      'previsto', new.criado_por_usuario_id
    from generate_series(date_trunc('month', current_date)::date, date_trunc('month', current_date)::date + interval '11 months', interval '1 month') mes(competencia)
    on conflict (recorrencia_id, competencia) do update
      set descricao = excluded.descricao,
          categoria = excluded.categoria,
          valor = excluded.valor,
          data_vencimento = excluded.data_vencimento,
          updated_at = now()
      where public.despesas_recorrentes_competencias.situacao = 'previsto';
  else
    update public.despesas_recorrentes_competencias
      set situacao = 'cancelado', updated_at = now()
    where recorrencia_id = new.id
      and competencia >= date_trunc('month', current_date)::date
      and situacao = 'previsto';
  end if;
  return new;
end;
$$;

drop trigger if exists r174_despesas_recorrentes_competencias on public.despesas_recorrentes;
create trigger r174_despesas_recorrentes_competencias
after insert or update of descricao, categoria, valor, dia_vencimento, ativo
on public.despesas_recorrentes
for each row execute function private.r174_materializar_competencias_recorrentes();

create table if not exists public.saldos_bancarios_informados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  data_referencia date not null,
  saldo numeric(12,2) not null,
  informado_por_usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (clinica_id, data_referencia, informado_por_usuario_id)
);

create index if not exists saldos_bancarios_informados_ultimos_idx
  on public.saldos_bancarios_informados (clinica_id, data_referencia desc, created_at desc);

alter table public.saldos_bancarios_informados enable row level security;
revoke all on table public.saldos_bancarios_informados from public, anon, authenticated;

create or replace function private.r174_definir_aprovado_em()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aprovado' and new.aprovado_em is null then
    if tg_op = 'UPDATE' then
      new.aprovado_em := coalesce(old.aprovado_em, now());
    else
      new.aprovado_em := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists r174_orcamentos_aprovado_em on public.orcamentos;
create trigger r174_orcamentos_aprovado_em
before insert or update of status on public.orcamentos
for each row execute function private.r174_definir_aprovado_em();

create or replace function private.r174_pode_lancar_caixa_clinica(
  p_clinica_id uuid,
  p_ator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinica_usuarios cu
    where cu.clinica_id = p_clinica_id
      and cu.usuario_id = p_ator_id
      and cu.status = 'ativo'
      and cu.role in ('secretaria', 'admin', 'gestor')
  )
  or exists (
    select 1
    from public.clinica_vinculos_governanca cv
    join public.clinica_usuarios cu on cu.id = cv.membro_id
    where cv.clinica_id = p_clinica_id
      and cu.usuario_id = p_ator_id
      and cu.status = 'ativo'
      and cv.estado = 'ativo'
      and cv.papel in ('proprietario', 'gestor')
  );
$$;

create or replace function private.r174_pode_gerir_financeiro_clinica(
  p_clinica_id uuid,
  p_ator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinica_vinculos_governanca cv
    join public.clinica_usuarios cu on cu.id = cv.membro_id
    where cv.clinica_id = p_clinica_id
      and cu.usuario_id = p_ator_id
      and cu.status = 'ativo'
      and cv.estado = 'ativo'
      and cv.papel in ('proprietario', 'gestor')
  );
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
begin
  if v_ator_id is null
    or p_clinica_id_esperada is null
    or p_tipo not in ('entrada', 'saida')
    or p_valor is null or p_valor <= 0 or round(p_valor * 100) <> p_valor * 100
    or p_data is null
    or char_length(btrim(coalesce(p_descricao, ''))) not between 2 and 160 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise os dados do lançamento.');
  end if;

  select u.active_clinica_id into v_clinica_id
  from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not private.r174_pode_lancar_caixa_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Você não pode lançar no caixa desta clínica.');
  end if;
  if not exists (
    select 1 from public.clinica_governanca cg
    where cg.clinica_id = v_clinica_id and cg.modalidade = 'gerida'
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'O caixa da clínica é usado somente na modalidade gerida.');
  end if;
  if p_dentista_id is not null and not exists (
    select 1 from public.dentistas d
    where d.id = p_dentista_id and d.clinica_id = v_clinica_id
      and d.ativo and d.role in ('admin', 'dentista')
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'O profissional selecionado não pertence à clínica.');
  end if;

  if p_tipo = 'entrada' then
    insert into public.receitas_manuais (
      clinica_id, dentista_id, valor, forma, data, descricao, origem_lancamento
    ) values (
      v_clinica_id, p_dentista_id, p_valor,
      coalesce(nullif(btrim(p_forma), ''), 'outro'), p_data,
      btrim(p_descricao), 'clinica'
    ) returning id into v_id;
  else
    insert into public.despesas (
      clinica_id, valor, categoria, tipo, data, descricao, origem_lancamento,
      situacao, competencia, data_vencimento, pago_em
    ) values (
      v_clinica_id, p_valor, coalesce(nullif(btrim(p_categoria), ''), 'outro'),
      'variavel', p_data, btrim(p_descricao), 'clinica',
      'pago', date_trunc('month', p_data)::date, p_data, p_data
    ) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id::text));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível registrar o lançamento agora.');
end;
$$;

revoke all on function private.r174_pode_lancar_caixa_clinica(uuid, uuid) from public;
revoke all on function private.r174_pode_gerir_financeiro_clinica(uuid, uuid) from public;
revoke all on function private.r174_materializar_competencias_recorrentes() from public;
revoke all on function private.r174_definir_aprovado_em() from public;
revoke all on function public.registrar_lancamento_clinica(uuid, text, numeric, date, text, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.registrar_lancamento_clinica(uuid, text, numeric, date, text, text, text, uuid) to authenticated;

create or replace function public.informar_saldo_bancario_clinica(
  p_clinica_id_esperada uuid,
  p_data_referencia date,
  p_saldo numeric
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
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_data_referencia is null
    or p_saldo is null or round(p_saldo * 100) <> p_saldo * 100 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise o saldo informado.');
  end if;
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not private.r174_pode_gerir_financeiro_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Apenas proprietário ou gestor informa o saldo da conta.');
  end if;
  insert into public.saldos_bancarios_informados (
    clinica_id, data_referencia, saldo, informado_por_usuario_id
  ) values (
    v_clinica_id, p_data_referencia, p_saldo, v_ator_id
  ) on conflict (clinica_id, data_referencia, informado_por_usuario_id) do update
    set saldo = excluded.saldo,
        created_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id::text));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível informar o saldo agora.');
end;
$$;

revoke all on function public.informar_saldo_bancario_clinica(uuid, date, numeric) from public, anon, authenticated, service_role;
grant execute on function public.informar_saldo_bancario_clinica(uuid, date, numeric) to authenticated;

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
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  if not exists (
    select 1 from public.clinica_vinculos_governanca cv
    join public.clinica_usuarios cu on cu.id = cv.membro_id
    where cv.clinica_id = v_clinica_id and cu.usuario_id = v_ator_id and cu.status = 'ativo'
      and cv.estado = 'ativo' and cv.papel in ('proprietario', 'gestor')
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Apenas proprietário ou gestor confirma custo recorrente.');
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

revoke all on function public.confirmar_competencia_recorrente_paga(uuid, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.confirmar_competencia_recorrente_paga(uuid, uuid, date) to authenticated;

create or replace function public.obter_meu_financeiro_gerido(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_dentista_id uuid;
  v_inicio date;
  v_fim date;
  v_horas_disponiveis numeric := 0;
  v_horas_atendidas numeric := 0;
  v_producao_aprovada numeric := 0;
  v_recebido_vinculado numeric := 0;
  v_atendimentos integer := 0;
  v_orcamentos_aprovados integer := 0;
  v_pacientes_pagantes integer := 0;
  v_orcamentos_enviados integer := 0;
  v_orcamentos_convertidos integer := 0;
  v_repasses jsonb := '[]'::jsonb;
  v_serie jsonb := '[]'::jsonb;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_mes_referencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao resultado profissional.');
  end if;
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  select d.id into v_dentista_id
  from public.dentistas d
  join public.clinica_usuarios cu on cu.usuario_id = d.user_id and cu.clinica_id = d.clinica_id
  where d.clinica_id = v_clinica_id and d.user_id = v_ator_id and d.ativo
    and d.role in ('admin', 'dentista') and cu.status = 'ativo'
  limit 1;
  if v_dentista_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Perfil clínico obrigatório.');
  end if;

  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  select coalesce(sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345, 0)
    into v_horas_disponiveis
  from public.horarios_disponiveis h
  where h.clinica_id = v_clinica_id and h.dentista_id = v_dentista_id and h.ativo;
  select coalesce(sum(a.duracao_minutos) / 60.0, 0), count(*)
    into v_horas_atendidas, v_atendimentos
  from public.agendamentos a
  where a.clinica_id = v_clinica_id and a.dentista_id = v_dentista_id
    and a.status = 'completed' and a.data_hora >= v_inicio and a.data_hora < v_fim;
  select coalesce(sum(coalesce(o.valor_acordado, o.total, 0)), 0), count(*)
    into v_producao_aprovada, v_orcamentos_aprovados
  from public.orcamentos o
  where o.clinica_id = v_clinica_id and o.dentista_id = v_dentista_id
    and o.status = 'aprovado' and o.aprovado_em >= v_inicio and o.aprovado_em < v_fim;
  select coalesce(sum(p.valor), 0), count(distinct p.paciente_id)
    into v_recebido_vinculado, v_pacientes_pagantes
  from public.pagamentos p
  where p.clinica_id = v_clinica_id and p.dentista_id = v_dentista_id
    and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim;
  select v_recebido_vinculado + coalesce(sum(r.valor), 0)
    into v_recebido_vinculado
  from public.receitas_manuais r
  where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id
    and r.titular_financeiro = 'clinica'
    and r.data >= v_inicio and r.data < v_fim;
  select count(*), count(*) filter (where o.status = 'aprovado')
    into v_orcamentos_enviados, v_orcamentos_convertidos
  from public.orcamentos o
  where o.clinica_id = v_clinica_id and o.dentista_id = v_dentista_id
    and o.enviado_em >= v_inicio and o.enviado_em < v_fim;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id::text, 'origem', r.origem, 'competencia', to_char(r.competencia, 'YYYY-MM-DD'),
    'valor', r.valor, 'status', r.status,
    'pagoEm', case when r.pago_em is null then null else to_char(r.pago_em, 'YYYY-MM-DD') end
  ) order by r.competencia desc), '[]'::jsonb)
    into v_repasses
  from public.repasses r
  where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id
    and r.competencia >= v_inicio and r.competencia < v_fim;
  select coalesce(jsonb_agg(jsonb_build_object(
    'mesISO', to_char(m.mes, 'YYYY-MM'), 'mes', trim(to_char(m.mes, 'Mon')),
    'entradas', coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = v_dentista_id and p.status = 'pago' and p.data_pagamento >= m.mes::date and p.data_pagamento < (m.mes + interval '1 month')::date), 0) + coalesce((select sum(r.valor) from public.receitas_manuais r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.titular_financeiro = 'clinica' and r.data >= m.mes::date and r.data < (m.mes + interval '1 month')::date), 0),
    'despesas', 0
  ) order by m.mes), '[]'::jsonb)
    into v_serie
  from generate_series(v_inicio - interval '5 months', v_inicio, interval '1 month') m(mes);

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'clinicaId', v_clinica_id::text, 'mes', to_char(v_inicio, 'YYYY-MM'),
    'entradasPessoais', v_recebido_vinculado, 'custosProfissionais', 0,
    'resultadoPessoal', v_recebido_vinculado, 'horasAtendidas', v_horas_atendidas,
    'horasDisponiveisConfiguradas', v_horas_disponiveis, 'custosFixosProprios', 0,
    'custosFixosEstruturaAtribuidos', 0, 'custoPorHoraClinica', null,
    'orcamentosAprovados', v_producao_aprovada, 'atendimentosRealizados', v_atendimentos,
    'recebidoVinculado', v_recebido_vinculado,
    'recebidoPorHora', case when v_horas_atendidas > 0 then round(v_recebido_vinculado / v_horas_atendidas, 2) else null end,
    'producaoPorHora', case when v_horas_atendidas > 0 then round(v_producao_aprovada / v_horas_atendidas, 2) else null end,
    'ocupacaoRealizada', case when v_horas_disponiveis > 0 then round((v_horas_atendidas / v_horas_disponiveis) * 100, 1) else null end,
    'ticketAprovado', case when v_orcamentos_aprovados > 0 then round(v_producao_aprovada / v_orcamentos_aprovados, 2) else null end,
    'ticketRecebidoPorPaciente', case when v_pacientes_pagantes > 0 then round(v_recebido_vinculado / v_pacientes_pagantes, 2) else null end,
    'conversaoOrcamentos', case when v_orcamentos_enviados > 0 then round((v_orcamentos_convertidos::numeric / v_orcamentos_enviados) * 100, 1) else null end,
    'repassePrevisto', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'previsto' and r.competencia >= v_inicio and r.competencia < v_fim), 0),
    'repassePago', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'pago' and r.competencia >= v_inicio and r.competencia < v_fim), 0),
    'serieMensal', v_serie, 'repasses', v_repasses
  ));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o resultado profissional agora.');
end;
$$;

revoke all on function public.obter_meu_financeiro_gerido(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_meu_financeiro_gerido(uuid, date) to authenticated;

create or replace function public.obter_financeiro_clinica_painel(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_dados jsonb;
  v_clinica_id uuid;
  v_inicio date;
  v_fim date;
  v_profissionais jsonb := '[]'::jsonb;
  v_saldo_informado numeric;
  v_saldo_informado_em date;
  v_media_despesas numeric := 0;
begin
  v_resultado := public.obter_financeiro_clinica(p_clinica_id_esperada, p_mes_referencia);
  if coalesce((v_resultado ->> 'ok')::boolean, false) is false then
    return v_resultado;
  end if;
  v_dados := v_resultado -> 'data';
  v_clinica_id := (v_dados ->> 'clinicaId')::uuid;
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  v_dados := jsonb_set(v_dados, '{movimentoLiquido}', to_jsonb(coalesce((v_dados ->> 'resultadoOperacional')::numeric, 0)), true);
  v_dados := jsonb_set(v_dados, '{baseDeCustosValidada}', to_jsonb(coalesce((v_dados ->> 'temBaseDeCustos')::boolean, false)), true);
  v_dados := jsonb_set(v_dados, '{pontoEquilibrio}', 'null'::jsonb, true);

  select s.saldo, s.data_referencia into v_saldo_informado, v_saldo_informado_em
  from public.saldos_bancarios_informados s
  where s.clinica_id = v_clinica_id and s.data_referencia <= current_date
  order by s.data_referencia desc, s.created_at desc
  limit 1;
  select coalesce(avg(linha.valor), 0) into v_media_despesas
  from (
    select coalesce(sum(d.valor), 0) as valor
    from generate_series(v_inicio - interval '2 months', v_inicio, interval '1 month') m(mes)
    left join public.despesas d on d.clinica_id = v_clinica_id
      and d.titular_financeiro = 'clinica' and d.situacao = 'pago'
      and d.pago_em >= m.mes::date and d.pago_em < (m.mes + interval '1 month')::date
    group by m.mes
  ) linha;

  select coalesce(jsonb_agg(jsonb_build_object(
    'dentistaId', d.id::text,
    'nome', d.nome,
    'producaoAprovada', coalesce(valores.producao_aprovada, 0),
    'recebidoVinculado', coalesce(valores.recebido_vinculado, 0),
    'aReceber', coalesce(valores.a_receber, 0),
    'atendimentosRealizados', coalesce(valores.atendimentos_realizados, 0),
    'horasAtendidas', coalesce(valores.horas_atendidas, 0),
    'horasDisponiveis', coalesce(valores.horas_disponiveis, 0),
    'custoDireto', null,
    'custoPorHoraClinica', null,
    'recebidoPorHora', case when coalesce(valores.horas_atendidas, 0) > 0 then round(valores.recebido_vinculado / valores.horas_atendidas, 2) else null end,
    'ocupacaoRealizada', case when coalesce(valores.horas_disponiveis, 0) > 0 then round((valores.horas_atendidas / valores.horas_disponiveis) * 100, 1) else null end,
    'ticketAprovado', case when coalesce(valores.orcamentos_aprovados, 0) > 0 then round(valores.producao_aprovada / valores.orcamentos_aprovados, 2) else null end,
    'ticketRecebidoPorPaciente', case when coalesce(valores.pacientes_pagantes, 0) > 0 then round(valores.recebido_vinculado / valores.pacientes_pagantes, 2) else null end
  ) order by d.nome), '[]'::jsonb)
  into v_profissionais
  from public.dentistas d
  left join lateral (
    select
      coalesce((select sum(coalesce(o.valor_acordado, o.total, 0)) from public.orcamentos o where o.clinica_id = v_clinica_id and o.dentista_id = d.id and o.status = 'aprovado' and o.aprovado_em >= v_inicio and o.aprovado_em < v_fim), 0) as producao_aprovada,
      coalesce((select count(*) from public.orcamentos o where o.clinica_id = v_clinica_id and o.dentista_id = d.id and o.status = 'aprovado' and o.aprovado_em >= v_inicio and o.aprovado_em < v_fim), 0) as orcamentos_aprovados,
      coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = d.id and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim), 0) + coalesce((select sum(r.valor) from public.receitas_manuais r where r.clinica_id = v_clinica_id and r.dentista_id = d.id and r.titular_financeiro = 'clinica' and r.data >= v_inicio and r.data < v_fim), 0) as recebido_vinculado,
      coalesce((select count(distinct p.paciente_id) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = d.id and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim), 0) as pacientes_pagantes,
      coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = d.id and p.status = 'pendente'), 0) as a_receber,
      coalesce((select count(*) from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = d.id and a.status = 'completed' and a.data_hora >= v_inicio and a.data_hora < v_fim), 0) as atendimentos_realizados,
      coalesce((select sum(a.duracao_minutos) / 60.0 from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = d.id and a.status = 'completed' and a.data_hora >= v_inicio and a.data_hora < v_fim), 0) as horas_atendidas,
      coalesce((select sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345 from public.horarios_disponiveis h where h.clinica_id = v_clinica_id and h.dentista_id = d.id and h.ativo), 0) as horas_disponiveis
  ) valores on true
  where d.clinica_id = v_clinica_id and d.ativo and d.role in ('admin', 'dentista');

  v_dados := jsonb_set(v_dados, '{profissionais}', v_profissionais, true);
  v_dados := v_dados - 'saldoBancarioConciliado';
  v_dados := jsonb_set(v_dados, '{saldoBancarioInformado}', coalesce(to_jsonb(v_saldo_informado), 'null'::jsonb), true);
  v_dados := jsonb_set(v_dados, '{saldoBancarioInformadoEm}', coalesce(to_jsonb(case when v_saldo_informado_em is null then null else to_char(v_saldo_informado_em, 'YYYY-MM-DD') end), 'null'::jsonb), true);
  v_dados := jsonb_set(v_dados, '{folegoCaixaMeses}', coalesce(to_jsonb(case when v_saldo_informado is not null and v_media_despesas > 0 then round(v_saldo_informado / v_media_despesas, 1) else null end), 'null'::jsonb), true);
  return jsonb_build_object('ok', true, 'data', v_dados);
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o financeiro agora.');
end;
$$;

revoke all on function public.obter_financeiro_clinica_painel(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_financeiro_clinica_painel(uuid, date) to authenticated;
