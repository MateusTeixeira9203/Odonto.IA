-- R163c: corrige o leitor já publicado sem alterar sua assinatura pública.
-- A view canônica incorpora R166/R169; a função precisa ser VOLATILE porque o contexto
-- financeiro trava membership/clinica com FOR SHARE e PostgREST abre STABLE como read-only.
create or replace function public.listar_recebimentos_operacionais(
  p_clinica_id_esperada uuid,
  p_limite integer default 25,
  p_offset integer default 0
)
returns jsonb language sql volatile security definer
set search_path=pg_catalog,public,private
as $$
  with parametros as (
    select least(greatest(coalesce(p_limite,25),1),50) as limite,
      greatest(coalesce(p_offset,0),0) as deslocamento
  ), contexto as (
    select private.financeiro_clinica_ativa() as clinica_id
  ), linhas as (
    select o.id as orcamento_id,o.paciente_id,o.dentista_id,o.titular_recebimento,
      pa.nome as paciente_nome,d.nome as dentista_nome,
      round(e.valor_devido*100)::bigint as devido_centavos,
      round(e.valor_pago*100)::bigint as pago_centavos,
      private.financeiro_pode_operar(o.clinica_id,o.dentista_id,'recebimentos.registrar') as pode_registrar,
      private.financeiro_pode_operar(o.clinica_id,o.dentista_id,'recebimentos.corrigir') as pode_corrigir,
      private.financeiro_pode_operar(o.clinica_id,o.dentista_id,'recebimentos.estornar') as pode_estornar
    from public.orcamentos o
    join public.orcamentos_com_estado e on e.id=o.id and e.clinica_id=o.clinica_id
    join public.pacientes pa on pa.id=o.paciente_id and pa.clinica_id=o.clinica_id
    join public.dentistas d on d.id=o.dentista_id and d.clinica_id=o.clinica_id
    cross join contexto c
    where o.clinica_id=c.clinica_id and c.clinica_id=p_clinica_id_esperada
      and e.estado in ('aceito','quitado')
      and (private.financeiro_pode_operar(o.clinica_id,o.dentista_id,'recebimentos.registrar')
        or private.membro_tem_permissao_operacional(o.clinica_id,'cobrancas.ler',o.dentista_id))
  ), pagina as (
    select linhas.* from linhas,parametros
    order by paciente_nome,orcamento_id
    limit (select limite+1 from parametros) offset (select deslocamento from parametros)
  ), itens as (
    select * from pagina limit (select limite from parametros)
  ) select jsonb_build_object(
    'itens',coalesce((select jsonb_agg(jsonb_build_object(
      'orcamentoId',orcamento_id::text,'pacienteId',paciente_id::text,'dentistaId',dentista_id::text,
      'pacienteNome',paciente_nome,'dentistaNome',dentista_nome,'titular',titular_recebimento,
      'devidoCentavos',devido_centavos,'pagoCentavos',pago_centavos,
      'saldoCentavos',greatest(0,devido_centavos-pago_centavos),
      'capacidades',jsonb_build_object('podeRegistrar',pode_registrar,'podeConfirmar',pode_registrar,
        'podeCorrigir',pode_corrigir,'podeEstornar',pode_estornar),
      'pagamentos',coalesce((select jsonb_agg(jsonb_build_object(
        'id',p.id::text,'valorCentavos',round(p.valor*100)::bigint,'status',p.status,
        'formaPagamento',p.forma_pagamento,'data',(p.data_pagamento)::text,'atualizadoEm',p.updated_at
      ) order by p.created_at desc) from public.pagamentos p
      where p.clinica_id=p_clinica_id_esperada and p.orcamento_id=itens.orcamento_id and p.status<>'cancelado'),'[]'::jsonb)
    ) order by paciente_nome,orcamento_id) from itens),'[]'::jsonb),
    'proximoOffset',case when (select count(*) from pagina) > (select limite from parametros)
      then (select deslocamento+limite from parametros) else null end
  );
$$;

revoke all on function public.listar_recebimentos_operacionais(uuid,integer,integer) from public,anon;
grant execute on function public.listar_recebimentos_operacionais(uuid,integer,integer) to authenticated;
