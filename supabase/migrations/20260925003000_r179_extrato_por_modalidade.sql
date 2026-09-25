-- R-179: extrato completo com forma de recebimento para filtro financeiro.
-- Leitura somente para a gestão da clínica; não altera lançamentos existentes.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function public.obter_extrato_financeiro_clinica(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_inicio date; v_fim date;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r174_pode_gerir_financeiro_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso ao extrato financeiro.');
  end if;
  v_inicio := date_trunc('month', p_mes_referencia)::date;
  v_fim := (v_inicio + interval '1 month')::date;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', linha.id::text, 'tipo', linha.tipo, 'descricao', linha.descricao,
      'data', to_char(linha.data, 'YYYY-MM-DD'), 'valor', linha.valor, 'forma', linha.forma
    ) order by linha.data desc, linha.id desc)
    from (
      select p.id, 'recebimento'::text as tipo, coalesce(pa.nome, 'Recebimento de tratamento') as descricao,
        p.data_pagamento::date as data, p.valor, p.forma_pagamento as forma
      from public.pagamentos p
      left join public.pacientes pa on pa.id = p.paciente_id and pa.clinica_id = p.clinica_id
      where p.clinica_id = v_clinica_id and p.titular_financeiro = 'clinica'
        and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim
      union all
      select r.id, 'receita_manual'::text, coalesce(r.descricao, 'Receita manual'), r.data, r.valor, r.forma
      from public.receitas_manuais r
      where r.clinica_id = v_clinica_id and r.titular_financeiro = 'clinica'
        and r.data >= v_inicio and r.data < v_fim
      union all
      select d.id, 'despesa'::text, coalesce(d.descricao, d.categoria), d.data, -d.valor, null::text
      from public.despesas d
      where d.clinica_id = v_clinica_id and d.titular_financeiro = 'clinica'
        and d.data >= v_inicio and d.data < v_fim
      order by data desc, id desc limit 200
    ) linha
  ), '[]'::jsonb));
end; $$;

revoke all on function public.obter_extrato_financeiro_clinica(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_extrato_financeiro_clinica(uuid, date) to authenticated;
