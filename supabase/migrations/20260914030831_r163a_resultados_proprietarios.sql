-- R163a: aditivo; legado continua no dentista. Executar somente no Free neste piloto.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

alter table public.orcamentos add column titular_recebimento text not null default 'dentista' check (titular_recebimento in ('dentista','clinica'));
alter table public.pagamentos add column titular_recebimento text not null default 'dentista' check (titular_recebimento in ('dentista','clinica'));
alter table public.orcamento_cobrancas add column titular_recebimento text not null default 'dentista' check (titular_recebimento in ('dentista','clinica'));

create function private.validar_titular_recebimento() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_titular text;
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
    if new.titular_recebimento='clinica' and not exists(select 1 from public.clinica_governanca g where g.clinica_id=new.clinica_id and g.responsavel_usuario_id is not null and g.modelo_estoque is distinct from 'colaborativa') then
      raise exception 'TITULAR_CLINICA_INDISPONIVEL';
    end if;
  else
    select o.titular_recebimento into v_titular from public.orcamentos o where o.clinica_id=new.clinica_id and o.id=new.orcamento_id for update;
    if not found then raise exception 'ORCAMENTO_ORIGEM_INVALIDO'; end if;
    if tg_op='UPDATE' and (old.orcamento_id is distinct from new.orcamento_id or old.clinica_id is distinct from new.clinica_id) then raise exception 'ORIGEM_FINANCEIRA_IMUTAVEL'; end if;
    new.titular_recebimento:=v_titular;
  end if;
  return new;
end $$;
create trigger r163_titular_orcamento before insert or update of titular_recebimento on public.orcamentos for each row execute function private.validar_titular_recebimento();
create trigger r163_titular_pagamento before insert or update on public.pagamentos for each row execute function private.validar_titular_recebimento();
create trigger r163_titular_cobranca before insert or update on public.orcamento_cobrancas for each row execute function private.validar_titular_recebimento();
revoke all on function private.validar_titular_recebimento() from public,anon,authenticated;

create function public.criar_orcamento_com_titular(p_paciente_id uuid,p_dentista_id uuid,p_ficha_id uuid,p_desconto numeric,p_itens jsonb,p_titular text)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
  if auth.uid() is null or p_titular is null or p_titular not in ('clinica','dentista') then raise exception 'TITULAR_INVALIDO'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) i where i->'composicao' is not null and i->'composicao'<>'null'::jsonb) then
    v_id:=public.criar_orcamento_com_eventos_r157(p_paciente_id,p_dentista_id,p_ficha_id,p_desconto,p_itens);
  else
    v_id:=public.criar_orcamento_com_eventos(p_paciente_id,p_dentista_id,p_ficha_id,p_desconto,p_itens);
  end if;
  update public.orcamentos set titular_recebimento=p_titular where id=v_id and clinica_id=public.get_my_clinica_id();
  if not found then raise exception 'TITULAR_NAO_SALVO'; end if;
  return v_id;
end $$;
revoke all on function public.criar_orcamento_com_titular(uuid,uuid,uuid,numeric,jsonb,text) from public,anon;
grant execute on function public.criar_orcamento_com_titular(uuid,uuid,uuid,numeric,jsonb,text) to authenticated;

create function private.obter_contexto_clinica(p_clinica_id_esperada uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_membro public.clinica_usuarios%rowtype; v_clinica uuid; v_dentista uuid; v_owner boolean; v_gerida boolean; v_nome text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Entre na sua conta.'); end if;
  select active_clinica_id into v_clinica from public.users where id=auth.uid();
  if v_clinica is null then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Clínica ativa não encontrada.'); end if;
  if v_clinica is distinct from p_clinica_id_esperada then return jsonb_build_object('ok',false,'codigo','CONTEXTO_ALTERADO','mensagem','A clínica ativa mudou.'); end if;
  select * into v_membro from public.clinica_usuarios where clinica_id=v_clinica and usuario_id=auth.uid() and status='ativo';
  if not found then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Vínculo ativo obrigatório.'); end if;
  select d.id into v_dentista from public.dentistas d where d.clinica_id=v_clinica and d.user_id=auth.uid() and d.ativo and d.role in ('admin','dentista') and v_membro.role in ('admin','dentista');
  select exists(select 1 from public.clinica_governanca g where g.clinica_id=v_clinica and g.responsavel_usuario_id=auth.uid() and g.modelo_estoque is distinct from 'colaborativa'),
         exists(select 1 from public.clinica_governanca g where g.clinica_id=v_clinica and g.responsavel_usuario_id is not null and g.modelo_estoque is distinct from 'colaborativa') into v_owner,v_gerida;
  select nome into v_nome from public.clinicas where id=v_clinica;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('clinicaId',v_clinica,'nome',v_nome,'proprietario',v_owner,'dentistaId',v_dentista,'gestaoDisponivel',v_owner,'recebimentoMisto',v_gerida));
end $$;
create function public.obter_contexto_clinica(p_clinica_id_esperada uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.obter_contexto_clinica(p_clinica_id_esperada) $$;
revoke all on function private.obter_contexto_clinica(uuid),public.obter_contexto_clinica(uuid) from public,anon;
grant execute on function private.obter_contexto_clinica(uuid),public.obter_contexto_clinica(uuid) to authenticated;

create function private.listar_resultados_clinica(p_clinica_id_esperada uuid,p_mes text,p_dentista_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_ctx jsonb; v_inicio date; v_fim date; v_resultado jsonb;
begin
  v_ctx:=private.obter_contexto_clinica(p_clinica_id_esperada);
  if not (v_ctx->>'ok')::boolean then return v_ctx; end if;
  if not (v_ctx->'data'->>'proprietario')::boolean then return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Somente o proprietário pode consultar estes resultados.'); end if;
  if p_mes is null or p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or substring(p_mes,1,4)::int not between 2000 and 2100 then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Escolha um mês válido.'); end if;
  v_inicio:=(p_mes||'-01')::date; v_fim:=(v_inicio+interval '1 month')::date;
  if p_dentista_id is not null and not exists(select 1 from public.dentistas where clinica_id=p_clinica_id_esperada and id=p_dentista_id and role in ('admin','dentista')) then return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Profissional inválido.'); end if;
  with profissionais as (
    select id,nome from public.dentistas where clinica_id=p_clinica_id_esperada and role in ('admin','dentista')
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
    where o.clinica_id=p_clinica_id_esperada and e.estado='aceito' and not exists(select 1 from public.orcamento_cobrancas c where c.clinica_id=o.clinica_id and c.orcamento_id=o.id and c.situacao='aberta')
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
    'recebidoClinicaCentavos',coalesce(sum(l.clinica),0),'recebidoDiretoCentavos',coalesce(sum(l.direto),0),
    'receitasManuaisCentavos',coalesce((select sum(round(valor*100)) from public.receitas_manuais where clinica_id=p_clinica_id_esperada and dentista_id is null and data>=v_inicio and data<v_fim),0),
    'despesasClinicaCentavos',coalesce((select sum(round(valor*100)) from public.despesas where clinica_id=p_clinica_id_esperada and dentista_id is null and data>=v_inicio and data<v_fim),0),
    'aReceberClinicaCentavos',coalesce(sum(l.receber),0),'realizados',coalesce(sum(l.realizados),0),'faltas',coalesce(sum(l.faltas),0),'cancelados',coalesce(sum(l.cancelados),0),
    'confirmacoesAmanha',(select count(*) from public.agendamentos a where a.clinica_id=p_clinica_id_esperada and (p_dentista_id is null or a.dentista_id=p_dentista_id) and a.status='scheduled' and (a.data_hora at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date+1),
    'porProfissional',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'nome',l.nome,'recebidoClinicaCentavos',l.clinica,'recebidoDiretoCentavos',l.direto,'aReceberClinicaCentavos',l.receber,'realizados',l.realizados,'faltas',l.faltas,'cancelados',l.cancelados) order by l.nome,l.id) filter(where l.id is not null),'[]'::jsonb)
  ) into v_resultado from linhas l;
  return jsonb_build_object('ok',true,'data',v_resultado);
end $$;
create function public.listar_resultados_clinica(p_clinica_id_esperada uuid,p_mes text,p_dentista_id uuid default null) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.listar_resultados_clinica(p_clinica_id_esperada,p_mes,p_dentista_id) $$;
revoke all on function private.listar_resultados_clinica(uuid,text,uuid),public.listar_resultados_clinica(uuid,text,uuid) from public,anon;
grant execute on function private.listar_resultados_clinica(uuid,text,uuid),public.listar_resultados_clinica(uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
