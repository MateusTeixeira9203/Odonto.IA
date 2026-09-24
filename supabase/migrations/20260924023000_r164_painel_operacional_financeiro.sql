-- R-164 v2: leituras operacionais separadas para clínica e profissional.
-- Nenhum lançamento histórico é reclassificado nesta migração.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.despesas
  add column if not exists origem_lancamento text not null default 'automatico'
  check (origem_lancamento in ('automatico', 'clinica', 'pessoal'));

alter table public.receitas_manuais
  add column if not exists origem_lancamento text not null default 'automatico'
  check (origem_lancamento in ('automatico', 'clinica', 'pessoal'));

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
    select o.titular_financeiro into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id and o.clinica_id = new.clinica_id;
    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  elsif tg_table_name = 'orcamento_cobrancas' then
    select o.titular_financeiro into v_titular
    from public.orcamentos o
    where o.id = new.orcamento_id and o.clinica_id = new.clinica_id;
    if v_titular is null then
      raise exception 'orcamento financeiro ausente ou fora da clinica';
    end if;
  elsif tg_table_name in ('despesas', 'receitas_manuais') and new.origem_lancamento = 'pessoal' then
    if new.dentista_id is null or not exists (
      select 1 from public.dentistas d
      where d.id = new.dentista_id and d.clinica_id = new.clinica_id
        and d.user_id = auth.uid() and d.ativo and d.role in ('admin', 'dentista')
    ) then
      raise exception 'lancamento pessoal exige o perfil clinico do usuario';
    end if;
    v_titular := 'dentista';
  elsif tg_table_name in ('despesas', 'receitas_manuais') and new.origem_lancamento = 'clinica' then
    v_titular := 'clinica';
  else
    v_titular := private.titular_financeiro_modalidade(new.clinica_id);
  end if;
  new.titular_financeiro := v_titular;
  return new;
end;
$$;

create or replace function public.registrar_lancamento_pessoal(
  p_clinica_id_esperada uuid,
  p_tipo text,
  p_valor numeric,
  p_data date,
  p_descricao text,
  p_categoria text default null,
  p_forma text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid();
  v_clinica_id uuid;
  v_dentista_id uuid;
  v_id uuid;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_tipo not in ('entrada', 'saida')
    or p_valor is null or p_valor <= 0 or p_data is null
    or char_length(btrim(coalesce(p_descricao, ''))) not between 2 and 160 then
    return jsonb_build_object('ok', false, 'codigo', 'INVALIDO', 'mensagem', 'Revise os dados do lançamento.');
  end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  select d.id into v_dentista_id from public.dentistas d
  where d.clinica_id = v_clinica_id and d.user_id = v_ator_id and d.ativo and d.role in ('admin', 'dentista')
  limit 1;
  if v_dentista_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Perfil clínico obrigatório para lançar no financeiro pessoal.');
  end if;
  if p_tipo = 'saida' then
    insert into public.despesas (clinica_id, dentista_id, valor, categoria, tipo, data, descricao, origem_lancamento)
    values (v_clinica_id, v_dentista_id, p_valor, coalesce(nullif(btrim(p_categoria), ''), 'outro'), 'variavel', p_data, btrim(p_descricao), 'pessoal')
    returning id into v_id;
  else
    insert into public.receitas_manuais (clinica_id, dentista_id, valor, forma, data, descricao, origem_lancamento)
    values (v_clinica_id, v_dentista_id, p_valor, coalesce(nullif(btrim(p_forma), ''), 'outro'), p_data, btrim(p_descricao), 'pessoal')
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_id::text));
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível registrar o lançamento pessoal agora.');
end;
$$;

create or replace function public.obter_meu_financeiro_gerido(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_membro_id uuid; v_dentista_id uuid;
  v_inicio date; v_fim date; v_horas_disponiveis numeric := 0; v_horas_atendidas numeric := 0;
  v_custos_fixos numeric := 0; v_entradas numeric := 0; v_custos numeric := 0;
  v_repasses jsonb := '[]'::jsonb; v_chart jsonb := '[]'::jsonb;
begin
  if v_ator_id is null or p_clinica_id_esperada is null or p_mes_referencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao seu financeiro.');
  end if;
  select active_clinica_id into v_clinica_id from public.users where id = v_ator_id;
  if v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada then
    return jsonb_build_object('ok', false, 'codigo', 'CONTEXTO_ALTERADO', 'mensagem', 'A clínica ativa foi alterada.');
  end if;
  select id into v_membro_id from public.clinica_usuarios where usuario_id = v_ator_id and clinica_id = v_clinica_id and status = 'ativo' limit 1;
  select id into v_dentista_id from public.dentistas where clinica_id = v_clinica_id and user_id = v_ator_id and ativo and role in ('admin', 'dentista') limit 1;
  if v_membro_id is null or v_dentista_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Perfil clínico obrigatório.');
  end if;
  v_inicio := date_trunc('month', p_mes_referencia)::date; v_fim := (v_inicio + interval '1 month')::date;
  select coalesce(sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345, 0) into v_horas_disponiveis
  from public.horarios_disponiveis h where h.clinica_id = v_clinica_id and h.dentista_id = v_dentista_id and h.ativo;
  select coalesce(sum(a.duracao_minutos) / 60.0, 0) into v_horas_atendidas
  from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = v_dentista_id and a.status = 'realizado' and a.data_hora >= v_inicio and a.data_hora < v_fim;
  select coalesce(sum(d.valor), 0), coalesce(sum(d.valor) filter (where d.tipo = 'fixo'), 0) into v_custos, v_custos_fixos
  from public.despesas d where d.clinica_id = v_clinica_id and d.dentista_id = v_dentista_id and d.titular_financeiro = 'dentista' and d.data >= v_inicio and d.data < v_fim;
  select coalesce(sum(r.valor), 0) into v_entradas from public.receitas_manuais r
  where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.titular_financeiro = 'dentista' and r.data >= v_inicio and r.data < v_fim;
  select v_entradas + coalesce(sum(r.valor), 0) into v_entradas from public.repasses r
  where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'pago' and r.pago_em >= v_inicio and r.pago_em < v_fim;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id::text, 'origem', r.origem, 'competencia', to_char(r.competencia, 'YYYY-MM-DD'), 'valor', r.valor, 'status', r.status, 'pagoEm', case when r.pago_em is null then null else to_char(r.pago_em, 'YYYY-MM-DD') end) order by r.competencia desc), '[]'::jsonb)
  into v_repasses from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.competencia >= v_inicio and r.competencia < v_fim;
  select coalesce(jsonb_agg(jsonb_build_object('mesISO', to_char(m.mes, 'YYYY-MM'), 'mes', trim(to_char(m.mes, 'Mon')), 'entradas', coalesce((select sum(rm.valor) from public.receitas_manuais rm where rm.clinica_id = v_clinica_id and rm.dentista_id = v_dentista_id and rm.titular_financeiro = 'dentista' and rm.data >= m.mes::date and rm.data < (m.mes + interval '1 month')::date),0) + coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'pago' and r.pago_em >= m.mes::date and r.pago_em < (m.mes + interval '1 month')::date),0), 'despesas', coalesce((select sum(d.valor) from public.despesas d where d.clinica_id = v_clinica_id and d.dentista_id = v_dentista_id and d.titular_financeiro = 'dentista' and d.data >= m.mes::date and d.data < (m.mes + interval '1 month')::date),0)) order by m.mes), '[]'::jsonb)
  into v_chart from generate_series(v_inicio - interval '5 months', v_inicio, interval '1 month') m(mes);
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'clinicaId', v_clinica_id::text, 'mes', to_char(v_inicio, 'YYYY-MM'),
    'entradasPessoais', v_entradas, 'custosProfissionais', v_custos, 'resultadoPessoal', v_entradas - v_custos,
    'horasAtendidas', v_horas_atendidas, 'horasDisponiveisConfiguradas', v_horas_disponiveis,
    'custosFixosProprios', v_custos_fixos, 'custosFixosEstruturaAtribuidos', 0,
    'custoPorHoraClinica', case when v_horas_disponiveis > 0 then round(v_custos_fixos / v_horas_disponiveis, 2) else null end,
    'orcamentosAprovados', coalesce((select sum(coalesce(o.valor_acordado, o.total, 0)) from public.orcamentos o where o.clinica_id = v_clinica_id and o.dentista_id = v_dentista_id and o.status = 'aprovado' and o.updated_at >= v_inicio and o.updated_at < v_fim), 0),
    'atendimentosRealizados', coalesce((select count(*) from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = v_dentista_id and a.status = 'realizado' and a.data_hora >= v_inicio and a.data_hora < v_fim), 0),
    'recebidoVinculado', coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = v_dentista_id and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim), 0),
    'repassePrevisto', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'previsto' and r.competencia >= v_inicio and r.competencia < v_fim), 0),
    'repassePago', coalesce((select sum(r.valor) from public.repasses r where r.clinica_id = v_clinica_id and r.dentista_id = v_dentista_id and r.status = 'pago' and r.competencia >= v_inicio and r.competencia < v_fim), 0),
    'serieMensal', v_chart, 'repasses', v_repasses
  ));
exception when others then return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar seu financeiro agora.');
end;
$$;

-- A leitura existente já concentra autorização e os fatos do caixa. Este adaptador corrige
-- apenas a semântica exibida: movimento registrado não é saldo bancário conciliado.
create or replace function public.obter_financeiro_clinica_painel(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_resultado jsonb;
  v_dados jsonb;
  v_profissionais jsonb := '[]'::jsonb;
  v_clinica_id uuid;
  v_quantidade_dentistas integer := 0;
  v_custos_fixos_recorrentes numeric := 0;
begin
  v_resultado := public.obter_financeiro_clinica(p_clinica_id_esperada, p_mes_referencia);
  if coalesce((v_resultado ->> 'ok')::boolean, false) is false then
    return v_resultado;
  end if;
  v_dados := v_resultado -> 'data';
  v_clinica_id := (v_dados ->> 'clinicaId')::uuid;
  v_dados := jsonb_set(v_dados, '{movimentoLiquido}', to_jsonb(coalesce((v_dados ->> 'resultadoOperacional')::numeric, 0)), true);
  v_dados := jsonb_set(v_dados, '{saldoBancarioConciliado}', 'null'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{baseDeCustosValidada}', to_jsonb(coalesce((v_dados ->> 'temBaseDeCustos')::boolean, false)), true);
  v_dados := jsonb_set(v_dados, '{folegoCaixaMeses}', 'null'::jsonb, true);
  v_dados := jsonb_set(v_dados, '{pontoEquilibrio}', 'null'::jsonb, true);
  if coalesce((v_dados ->> 'temBaseDeCustos')::boolean, false) is false then
    v_dados := jsonb_set(v_dados, '{margemOperacional}', 'null'::jsonb, true);
  end if;
  select count(*) into v_quantidade_dentistas
  from public.dentistas d
  where d.clinica_id = v_clinica_id and d.ativo and d.role in ('admin', 'dentista');
  select coalesce(sum(r.valor) filter (where r.ativo), 0) into v_custos_fixos_recorrentes
  from public.despesas_recorrentes r where r.clinica_id = v_clinica_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'dentistaId', d.id::text,
    'nome', d.nome,
    'producaoAprovada', coalesce((select sum(coalesce(o.valor_acordado, o.total, 0)) from public.orcamentos o where o.clinica_id = v_clinica_id and o.dentista_id = d.id and o.titular_financeiro = 'clinica' and o.status = 'aprovado' and o.updated_at >= date_trunc('month', p_mes_referencia) and o.updated_at < date_trunc('month', p_mes_referencia) + interval '1 month'), 0),
    'recebidoVinculado', coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = d.id and p.titular_financeiro = 'clinica' and p.status = 'pago' and p.data_pagamento >= date_trunc('month', p_mes_referencia)::date and p.data_pagamento < (date_trunc('month', p_mes_referencia) + interval '1 month')::date), 0),
    'aReceber', coalesce((select sum(p.valor) from public.pagamentos p where p.clinica_id = v_clinica_id and p.dentista_id = d.id and p.titular_financeiro = 'clinica' and p.status = 'pendente'), 0),
    'atendimentosRealizados', coalesce((select count(*) from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = d.id and a.status = 'realizado' and a.data_hora >= date_trunc('month', p_mes_referencia) and a.data_hora < date_trunc('month', p_mes_referencia) + interval '1 month'), 0),
    'horasAtendidas', coalesce((select sum(a.duracao_minutos) / 60.0 from public.agendamentos a where a.clinica_id = v_clinica_id and a.dentista_id = d.id and a.status = 'realizado' and a.data_hora >= date_trunc('month', p_mes_referencia) and a.data_hora < date_trunc('month', p_mes_referencia) + interval '1 month'), 0),
    'horasDisponiveis', coalesce((select sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345 from public.horarios_disponiveis h where h.clinica_id = v_clinica_id and h.dentista_id = d.id and h.ativo), 0),
    'custoDireto', null,
    'custoPorHoraClinica', case when coalesce((select sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345 from public.horarios_disponiveis h where h.clinica_id = v_clinica_id and h.dentista_id = d.id and h.ativo), 0) > 0 then round((coalesce((select sum(x.valor) from public.despesas x where x.clinica_id = v_clinica_id and x.dentista_id = d.id and x.titular_financeiro = 'dentista' and x.tipo = 'fixo' and x.data >= date_trunc('month', p_mes_referencia)::date and x.data < (date_trunc('month', p_mes_referencia) + interval '1 month')::date), 0) + case when v_quantidade_dentistas = 1 then v_custos_fixos_recorrentes else 0 end) / (select sum(extract(epoch from (h.hora_fim - h.hora_inicio)) / 3600.0) * 4.345 from public.horarios_disponiveis h where h.clinica_id = v_clinica_id and h.dentista_id = d.id and h.ativo), 2) else null end
  ) order by d.nome), '[]'::jsonb) into v_profissionais
  from public.dentistas d
  where d.clinica_id = v_clinica_id and d.ativo and d.role in ('admin', 'dentista');
  v_dados := jsonb_set(v_dados, '{profissionais}', v_profissionais, true);
  return jsonb_build_object('ok', true, 'data', v_dados);
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o financeiro agora.');
end;
$$;

revoke all on function public.registrar_lancamento_pessoal(uuid, text, numeric, date, text, text, text), public.obter_meu_financeiro_gerido(uuid, date), public.obter_financeiro_clinica_painel(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.registrar_lancamento_pessoal(uuid, text, numeric, date, text, text, text), public.obter_meu_financeiro_gerido(uuid, date), public.obter_financeiro_clinica_painel(uuid, date) to authenticated;
