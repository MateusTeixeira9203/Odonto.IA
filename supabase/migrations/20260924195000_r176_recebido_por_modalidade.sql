-- R-176: modalidades de recebimento para a gestão do caixa da clínica.

alter table public.receitas_manuais
  drop constraint if exists receitas_manuais_forma_check;

alter table public.receitas_manuais
  add constraint receitas_manuais_forma_check
  check (forma in ('pix', 'dinheiro', 'transferencia', 'cartao_credito', 'cartao_debito', 'boleto', 'outro'));

create or replace function public.obter_recebido_por_modalidade_clinica(
  p_clinica_id_esperada uuid,
  p_mes_referencia date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator_id uuid := auth.uid(); v_clinica_id uuid; v_inicio date; v_fim date;
begin
  select u.active_clinica_id into v_clinica_id from public.users u where u.id = v_ator_id;
  if v_ator_id is null or v_clinica_id is null or v_clinica_id <> p_clinica_id_esperada
    or not private.r174_pode_gerir_financeiro_clinica(v_clinica_id, v_ator_id) then
    return jsonb_build_object('ok', false, 'codigo', 'SEM_ACESSO', 'mensagem', 'Sem acesso às modalidades de recebimento.');
  end if;
  v_inicio := date_trunc('month', p_mes_referencia)::date; v_fim := (v_inicio + interval '1 month')::date;
  return jsonb_build_object('ok', true, 'data', coalesce((
    select jsonb_agg(jsonb_build_object('forma', totais.forma, 'valor', totais.valor) order by totais.ordem)
    from (
      select forma, sum(valor)::numeric as valor, case forma when 'pix' then 1 when 'cartao_credito' then 2 when 'cartao_debito' then 3 when 'dinheiro' then 4 when 'boleto' then 5 when 'transferencia' then 6 else 7 end as ordem
      from (
        select p.forma_pagamento as forma, p.valor from public.pagamentos p
        where p.clinica_id = v_clinica_id and p.titular_financeiro = 'clinica' and p.status = 'pago' and p.data_pagamento >= v_inicio and p.data_pagamento < v_fim
        union all
        select r.forma, r.valor from public.receitas_manuais r
        where r.clinica_id = v_clinica_id and r.titular_financeiro = 'clinica' and r.data >= v_inicio and r.data < v_fim
      ) recebimentos where forma is not null group by forma
    ) totais
  ), '[]'::jsonb));
end; $$;

revoke all on function public.obter_recebido_por_modalidade_clinica(uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.obter_recebido_por_modalidade_clinica(uuid, date) to authenticated;
