-- R-174: fatos legados já eram despesas pagas. Apenas completa metadados
-- aditivos, sem mudar valor, clínica, titular ou data histórica.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

update public.despesas
set competencia = coalesce(competencia, date_trunc('month', data)::date),
    pago_em = coalesce(pago_em, data)
where competencia is null or pago_em is null;

insert into public.despesas_recorrentes_competencias (
  recorrencia_id, clinica_id, competencia, descricao, categoria, valor,
  data_vencimento, situacao, criado_por_usuario_id
)
select
  r.id, r.clinica_id, mes.competencia::date, r.descricao, r.categoria, r.valor,
  (mes.competencia + (r.dia_vencimento - 1) * interval '1 day')::date,
  'previsto', r.criado_por_usuario_id
from public.despesas_recorrentes r
cross join generate_series(date_trunc('month', current_date)::date, date_trunc('month', current_date)::date + interval '11 months', interval '1 month') mes(competencia)
where r.ativo
on conflict (recorrencia_id, competencia) do nothing;
