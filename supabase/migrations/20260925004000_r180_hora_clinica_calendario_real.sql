-- R-180: disponibilidade da hora clínica pelo calendário real, não por média semanal.
-- Considera expediente ativo, intervalo de almoço e bloqueios pessoais da agenda no BRT.

set local lock_timeout = '1500ms';
set local statement_timeout = '20s';

create or replace function private.r180_horas_disponiveis_no_mes(
  p_clinica_id uuid,
  p_dentista_id uuid,
  p_inicio date,
  p_fim date
)
returns numeric language sql stable security definer set search_path = '' as $$
  with dias as (
    select d::date as dia
    from generate_series(p_inicio, p_fim - 1, interval '1 day') d
  ), turnos as (
    select
      (dias.dia + h.hora_inicio) at time zone 'America/Sao_Paulo' as inicio,
      (dias.dia + h.hora_fim) at time zone 'America/Sao_Paulo' as fim,
      case when h.almoco_inicio is not null and h.almoco_fim is not null
        and h.almoco_inicio > h.hora_inicio and h.almoco_fim < h.hora_fim
        then (dias.dia + h.almoco_inicio) at time zone 'America/Sao_Paulo' end as inicio_almoco,
      case when h.almoco_inicio is not null and h.almoco_fim is not null
        and h.almoco_inicio > h.hora_inicio and h.almoco_fim < h.hora_fim
        then (dias.dia + h.almoco_fim) at time zone 'America/Sao_Paulo' end as fim_almoco
    from dias
    join public.horarios_disponiveis h
      on h.clinica_id = p_clinica_id and h.dentista_id = p_dentista_id and h.ativo
      and h.dia_semana = extract(dow from dias.dia)::integer
  ), slots as (
    select tstzrange(inicio, coalesce(inicio_almoco, fim), '[)') as intervalo from turnos
    union all
    select tstzrange(fim_almoco, fim, '[)') as intervalo from turnos where fim_almoco is not null
  ), disponivel as (
    select s.intervalo,
      coalesce((
        select sum(extract(epoch from upper(parte.intervalo) - lower(parte.intervalo)))
        from unnest(coalesce((
          select range_agg(tstzrange(
            greatest(b.data_hora, lower(s.intervalo)),
            least(b.data_hora + make_interval(mins => b.duracao_minutos), upper(s.intervalo)), '[)'
          ))
          from public.agenda_bloqueios b
          where b.clinica_id = p_clinica_id and b.dentista_id = p_dentista_id
            and tstzrange(b.data_hora, b.data_hora + make_interval(mins => b.duracao_minutos), '[)') && s.intervalo
        ), '{}'::tstzmultirange)) as parte(intervalo)
      ), 0) as segundos_bloqueados
    from slots s
  )
  select coalesce(round(sum(greatest(0, extract(epoch from upper(intervalo) - lower(intervalo)) - segundos_bloqueados)) / 3600.0, 2), 0)
  from disponivel;
$$;

-- Mantém a agregação e a autorização já validadas no R-174; troca somente a disponibilidade.
alter function public.obter_meu_financeiro_gerido(uuid, date)
  rename to obter_meu_financeiro_gerido_r174_legacy;

create function public.obter_meu_financeiro_gerido(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb; v_dados jsonb; v_dentista_id uuid; v_inicio date; v_fim date; v_horas numeric;
begin
  v_resultado := public.obter_meu_financeiro_gerido_r174_legacy(p_clinica_id_esperada, p_mes_referencia);
  if coalesce((v_resultado ->> 'ok')::boolean, false) is false then return v_resultado; end if;
  v_dados := v_resultado -> 'data';
  select d.id into v_dentista_id from public.dentistas d
    where d.clinica_id = p_clinica_id_esperada and d.user_id = auth.uid() and d.ativo
    and d.role in ('admin', 'dentista') limit 1;
  if v_dentista_id is null then return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Perfil clínico obrigatório.'); end if;
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  v_horas := private.r180_horas_disponiveis_no_mes(p_clinica_id_esperada, v_dentista_id, v_inicio, v_fim);
  v_dados := jsonb_set(v_dados, '{horasDisponiveisConfiguradas}', to_jsonb(v_horas), true);
  v_dados := jsonb_set(v_dados, '{ocupacaoRealizada}', case when v_horas > 0
    then to_jsonb(round(((v_dados ->> 'horasAtendidas')::numeric / v_horas) * 100, 1)) else 'null'::jsonb end, true);
  return jsonb_build_object('ok', true, 'data', v_dados);
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o resultado profissional agora.');
end;
$$;

alter function public.obter_financeiro_clinica_painel(uuid, date)
  rename to obter_financeiro_clinica_painel_r174_legacy;

create function public.obter_financeiro_clinica_painel(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb; v_dados jsonb; v_inicio date; v_fim date; v_profissionais jsonb;
begin
  v_resultado := public.obter_financeiro_clinica_painel_r174_legacy(p_clinica_id_esperada, p_mes_referencia);
  if coalesce((v_resultado ->> 'ok')::boolean, false) is false then return v_resultado; end if;
  v_dados := v_resultado -> 'data';
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  select coalesce(jsonb_agg(
    jsonb_set(
      jsonb_set(item, '{horasDisponiveis}', to_jsonb(horas.valor), true),
      '{ocupacaoRealizada}', case when horas.valor > 0
        then to_jsonb(round(((item ->> 'horasAtendidas')::numeric / horas.valor) * 100, 1)) else 'null'::jsonb end, true
    ) order by item ->> 'nome'
  ), '[]'::jsonb) into v_profissionais
  from jsonb_array_elements(v_dados -> 'profissionais') item
  cross join lateral (
    select private.r180_horas_disponiveis_no_mes(
      p_clinica_id_esperada, (item ->> 'dentistaId')::uuid, v_inicio, v_fim
    ) as valor
  ) horas;
  v_dados := jsonb_set(v_dados, '{profissionais}', v_profissionais, true);
  return jsonb_build_object('ok', true, 'data', v_dados);
exception when others then
  return jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Não foi possível consultar o financeiro agora.');
end;
$$;

revoke all on function private.r180_horas_disponiveis_no_mes(uuid, uuid, date, date) from public, anon, authenticated, service_role;
revoke all on function public.obter_meu_financeiro_gerido_r174_legacy(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obter_financeiro_clinica_painel_r174_legacy(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obter_meu_financeiro_gerido(uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.obter_financeiro_clinica_painel(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_meu_financeiro_gerido(uuid, date) to authenticated;
grant execute on function public.obter_financeiro_clinica_painel(uuid, date) to authenticated;
