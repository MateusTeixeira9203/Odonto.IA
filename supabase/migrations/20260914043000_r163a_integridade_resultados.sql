-- R163a revisão: modelo clínico independente do estoque; origem financeira e histórico.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';
alter table public.clinica_governanca add column modelo_clinica text not null default 'colaborativa' check (modelo_clinica in ('colaborativa','gerida'));
-- Migração única do modelo previamente configurado. Futuras alterações de estoque não mudam propriedade.
update public.clinica_governanca set modelo_clinica='gerida' where modelo_estoque='gerida';
create or replace function private.validar_titular_recebimento() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_titular text; v_orcamento public.orcamentos%rowtype;
begin
  if tg_table_name='orcamentos' then
    if tg_op='UPDATE' and new.titular_recebimento is distinct from old.titular_recebimento then
      if old.status<>'rascunho' or old.enviado_em is not null or old.aprovado_em is not null or old.plano_definido_em is not null
        or exists(select 1 from public.orcamento_itens where clinica_id=old.clinica_id and orcamento_id=old.id and aprovado)
        or exists(select 1 from public.pagamentos where clinica_id=old.clinica_id and orcamento_id=old.id)
        or exists(select 1 from public.orcamento_cobrancas where clinica_id=old.clinica_id and orcamento_id=old.id) then
        raise exception 'TITULAR_BLOQUEADO';
      end if;
    end if;
    if new.titular_recebimento='clinica' and not exists(select 1 from public.clinica_governanca g where g.clinica_id=new.clinica_id and g.responsavel_usuario_id is not null and g.modelo_clinica='gerida') then
      raise exception 'TITULAR_CLINICA_INDISPONIVEL';
    end if;
  else
    select o.* into v_orcamento from public.orcamentos o where o.clinica_id=new.clinica_id and o.id=new.orcamento_id for update;
    if not found then raise exception 'ORCAMENTO_ORIGEM_INVALIDO'; end if;
    if tg_op='UPDATE' and (old.orcamento_id is distinct from new.orcamento_id or old.clinica_id is distinct from new.clinica_id) then raise exception 'ORIGEM_FINANCEIRA_IMUTAVEL'; end if;
    if new.paciente_id is distinct from v_orcamento.paciente_id or new.dentista_id is distinct from v_orcamento.dentista_id then
      raise exception 'ORIGEM_FINANCEIRA_INCONSISTENTE';
    end if;
    if tg_table_name='pagamentos' then
      if new.cobranca_id is not null and not exists(select 1 from public.orcamento_cobrancas c
        where c.clinica_id=new.clinica_id and c.id=new.cobranca_id and c.orcamento_id=new.orcamento_id
          and c.paciente_id=new.paciente_id and c.dentista_id=new.dentista_id) then
        raise exception 'COBRANCA_ORIGEM_INVALIDA';
      end if;
    end if;
    new.titular_recebimento:=v_orcamento.titular_recebimento;
  end if;
  return new;
end $$;

create or replace function private.obter_contexto_clinica(p_clinica_id_esperada uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_membro public.clinica_usuarios%rowtype; v_clinica uuid; v_dentista uuid; v_owner boolean; v_gerida boolean; v_nome text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Entre na sua conta.'); end if;
  select active_clinica_id into v_clinica from public.users where id=auth.uid();
  if v_clinica is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Clínica ativa não encontrada.'); end if;
  if v_clinica is distinct from p_clinica_id_esperada then return jsonb_build_object('ok',false,'codigo','CONTEXTO_ALTERADO','mensagem','A clínica ativa mudou.'); end if;
  select * into v_membro from public.clinica_usuarios where clinica_id=v_clinica and usuario_id=auth.uid() and status='ativo';
  if not found then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Vínculo ativo obrigatório.'); end if;
  select d.id into v_dentista from public.dentistas d where d.clinica_id=v_clinica and d.user_id=auth.uid() and d.ativo and d.role in ('admin','dentista') and v_membro.role in ('admin','dentista');
  select exists(select 1 from public.clinica_governanca g where g.clinica_id=v_clinica and g.responsavel_usuario_id=auth.uid() and g.modelo_clinica='gerida'),
         exists(select 1 from public.clinica_governanca g where g.clinica_id=v_clinica and g.responsavel_usuario_id is not null and g.modelo_clinica='gerida') into v_owner,v_gerida;
  select nome into v_nome from public.clinicas where id=v_clinica;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('clinicaId',v_clinica,'nome',v_nome,'proprietario',v_owner,'dentistaId',v_dentista,'gestaoDisponivel',v_owner,'recebimentoMisto',v_gerida));
end $$;

create or replace function private.listar_resultados_clinica(p_clinica_id_esperada uuid,p_mes text,p_dentista_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_ctx jsonb; v_inicio date; v_fim date; v_resultado jsonb;
begin
  v_ctx:=private.obter_contexto_clinica(p_clinica_id_esperada);
  if not (v_ctx->>'ok')::boolean then return v_ctx; end if;
  if not (v_ctx->'data'->>'proprietario')::boolean then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Somente o proprietário pode consultar estes resultados.'); end if;
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or substring(p_mes,1,4)::int not between 2000 and 2100 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Escolha um mês válido.'); end if;
  v_inicio:=(p_mes||'-01')::date; v_fim:=(v_inicio+interval '1 month')::date;
  if p_dentista_id is not null and not exists(select 1 from public.dentistas where clinica_id=p_clinica_id_esperada and id=p_dentista_id and (role in ('admin','dentista') or exists(select 1 from public.pagamentos p where p.clinica_id=public.dentistas.clinica_id and p.dentista_id=public.dentistas.id) or exists(select 1 from public.orcamentos o where o.clinica_id=public.dentistas.clinica_id and o.dentista_id=public.dentistas.id))) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Profissional inválido.'); end if;
  with profissionais as (
    select id,nome from public.dentistas where clinica_id=p_clinica_id_esperada and (role in ('admin','dentista') or exists(select 1 from public.pagamentos p where p.clinica_id=public.dentistas.clinica_id and p.dentista_id=public.dentistas.id) or exists(select 1 from public.orcamentos o where o.clinica_id=public.dentistas.clinica_id and o.dentista_id=public.dentistas.id))
  ), recebidos as (
    select p.dentista_id,p.titular_recebimento,sum(round(p.valor*100)) as valor from public.pagamentos p
    where p.clinica_id=p_clinica_id_esperada and p.status='pago' and p.data_pagamento>=v_inicio and p.data_pagamento<v_fim
    group by p.dentista_id,p.titular_recebimento
  ), pendentes as (
    select c.dentista_id,c.titular_recebimento,greatest(0,round(c.valor_final*100)-coalesce((select sum(round(p.valor*100)) from public.pagamentos p where p.clinica_id=c.clinica_id and p.cobranca_id=c.id and p.status='pago'),0)) as valor
    from public.orcamento_cobrancas c where c.clinica_id=p_clinica_id_esperada and c.situacao='aberta'
    union all
    select o.dentista_id,o.titular_recebimento,greatest(0,round((e.valor_devido-e.valor_pago)*100))
    from public.orcamentos o join public.orcamentos_com_estado e on e.clinica_id=o.clinica_id and e.id=o.id
    where o.clinica_id=p_clinica_id_esperada and e.estado='aceito' and not exists(select 1 from public.orcamento_cobrancas c where c.clinica_id=o.clinica_id and c.orcamento_id=o.id)
  ), agenda as (
    select a.dentista_id,count(*) filter(where a.status='completed') as realizados,count(*) filter(where a.status='no_show') as faltas,count(*) filter(where a.status='cancelled') as cancelados
    from public.agendamentos a where a.clinica_id=p_clinica_id_esperada and a.data_hora >= (v_inicio::timestamp at time zone 'America/Sao_Paulo') and a.data_hora < (v_fim::timestamp at time zone 'America/Sao_Paulo') group by a.dentista_id
  ), linhas as (
    select d.id,d.nome,
      coalesce((select sum(valor) from recebidos r where r.dentista_id=d.id and titular_recebimento='clinica'),0) as clinica,
      coalesce((select sum(valor) from recebidos r where r.dentista_id=d.id and titular_recebimento='dentista'),0) as direto,
      coalesce((select sum(valor) from pendentes p where p.dentista_id=d.id and titular_recebimento='clinica'),0) as receber,
      coalesce(a.realizados,0) as realizados,coalesce(a.faltas,0) as faltas,coalesce(a.cancelados,0) as cancelados
    from profissionais d left join agenda a on a.dentista_id=d.id where p_dentista_id is null or d.id=p_dentista_id
  )
  select jsonb_build_object('contexto',v_ctx->'data','mes',p_mes,'dentistaFiltro',p_dentista_id,
    'profissionais',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome,id) from profissionais),'[]'::jsonb),
    'recebidoClinicaCentavos',coalesce((select sum(valor) from recebidos where titular_recebimento='clinica' and (p_dentista_id is null or dentista_id=p_dentista_id)),0),'recebidoDiretoCentavos',coalesce((select sum(valor) from recebidos where titular_recebimento='dentista' and (p_dentista_id is null or dentista_id=p_dentista_id)),0),
    'receitasManuaisCentavos',coalesce((select sum(round(valor*100)) from public.receitas_manuais where clinica_id=p_clinica_id_esperada and dentista_id is null and data>=v_inicio and data<v_fim),0),
    'despesasClinicaCentavos',coalesce((select sum(round(valor*100)) from public.despesas where clinica_id=p_clinica_id_esperada and dentista_id is null and data>=v_inicio and data<v_fim),0),
    'aReceberClinicaCentavos',coalesce((select sum(valor) from pendentes where titular_recebimento='clinica' and (p_dentista_id is null or dentista_id=p_dentista_id)),0),'realizados',coalesce((select sum(realizados) from agenda where p_dentista_id is null or dentista_id=p_dentista_id),0),'faltas',coalesce((select sum(faltas) from agenda where p_dentista_id is null or dentista_id=p_dentista_id),0),'cancelados',coalesce((select sum(cancelados) from agenda where p_dentista_id is null or dentista_id=p_dentista_id),0),
    'confirmacoesAmanha',(select count(*) from public.agendamentos a where a.clinica_id=p_clinica_id_esperada and (p_dentista_id is null or a.dentista_id=p_dentista_id) and a.status='scheduled' and (a.data_hora at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date+1),
    'porProfissional',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'nome',l.nome,'recebidoClinicaCentavos',l.clinica,'recebidoDiretoCentavos',l.direto,'aReceberClinicaCentavos',l.receber,'realizados',l.realizados,'faltas',l.faltas,'cancelados',l.cancelados) order by l.nome,l.id) filter(where l.id is not null),'[]'::jsonb)
  ) into v_resultado from linhas l;
  return jsonb_build_object('ok',true,'data',v_resultado);
end $$;
notify pgrst,'reload schema';
