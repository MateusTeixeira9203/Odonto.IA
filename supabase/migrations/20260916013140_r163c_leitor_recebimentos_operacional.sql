-- R163c sublote 2: DTO operacional, sem reabrir a gerência /clinica.
drop function if exists public.listar_recebimentos_operacionais(uuid);

create or replace function public.listar_recebimentos_operacionais(
  p_clinica_id_esperada uuid,
  p_limite integer default 25,
  p_offset integer default 0
)
returns jsonb language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  with parametros as (
    select least(greatest(coalesce(p_limite,25),1),50) as limite,
      greatest(coalesce(p_offset,0),0) as deslocamento
  ), contexto as (select private.financeiro_clinica_ativa() as clinica_id), linhas as (
    select o.id as orcamento_id,o.paciente_id,o.dentista_id,o.titular_recebimento,
      pa.nome as paciente_nome,d.nome as dentista_nome,
      round(o.valor_acordado*100)::bigint as devido_centavos,
      coalesce((select sum(round(p.valor*100)) from public.pagamentos p where p.clinica_id=o.clinica_id and p.orcamento_id=o.id and p.status='pago'),0)::bigint as pago_centavos
    from public.orcamentos o join public.pacientes pa on pa.id=o.paciente_id and pa.clinica_id=o.clinica_id
      join public.dentistas d on d.id=o.dentista_id and d.clinica_id=o.clinica_id, contexto c
    where o.clinica_id=c.clinica_id and c.clinica_id=p_clinica_id_esperada
      and (private.financeiro_pode_operar(o.clinica_id,o.dentista_id,'recebimentos.registrar') or private.membro_tem_permissao_operacional(o.clinica_id,'cobrancas.ler',o.dentista_id))
  ), pagina as (
    select linhas.* from linhas,parametros
    order by paciente_nome,orcamento_id
    limit (select limite+1 from parametros) offset (select deslocamento from parametros)
  ), itens as (
    select * from pagina limit (select limite from parametros)
  ) select jsonb_build_object(
    'itens',coalesce((select jsonb_agg(jsonb_build_object('orcamentoId',orcamento_id::text,'pacienteId',paciente_id::text,'dentistaId',dentista_id::text,'pacienteNome',paciente_nome,'dentistaNome',dentista_nome,'titular',titular_recebimento,'devidoCentavos',devido_centavos,'pagoCentavos',pago_centavos,'saldoCentavos',greatest(0,devido_centavos-pago_centavos),'pagamentos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id::text,'valorCentavos',round(p.valor*100)::bigint,'status',p.status,'formaPagamento',p.forma_pagamento,'data',(p.data_pagamento)::text,'atualizadoEm',p.updated_at) order by p.created_at desc) from public.pagamentos p where p.clinica_id=p_clinica_id_esperada and p.orcamento_id=itens.orcamento_id),'[]'::jsonb)) order by paciente_nome,orcamento_id) from itens),'[]'::jsonb),
    'proximoOffset',case when (select count(*) from pagina) > (select limite from parametros) then (select deslocamento+limite from parametros) else null end
  );
$$;
revoke all on function public.listar_recebimentos_operacionais(uuid,integer,integer) from public,anon;
grant execute on function public.listar_recebimentos_operacionais(uuid,integer,integer) to authenticated;
