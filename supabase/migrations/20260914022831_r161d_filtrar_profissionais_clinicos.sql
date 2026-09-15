-- R-161d incremental: modelos, cartões e candidatos só usam profissionais clínicos ativos.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function private.listar_pendencias_contatos(p_clinica_id_esperada uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_contexto jsonb; v_clinica uuid; v_membro uuid; v_ator uuid; v_board jsonb; v_clinica_nome text;
begin
  v_contexto := private.pendencias_contexto(p_clinica_id_esperada);
  if coalesce((v_contexto->>'ok')::boolean,false) is not true then return v_contexto; end if;
  v_clinica := (v_contexto#>>'{data,clinicaId}')::uuid;
  v_membro := (v_contexto#>>'{data,membroId}')::uuid;
  v_ator := (v_contexto#>>'{data,atorId}')::uuid;
  perform private.materializar_pendencias_contatos(v_clinica,v_membro);
  select nome into v_clinica_nome from public.clinicas where id=v_clinica;
  if v_clinica_nome is null then
    return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Clínica indisponível.');
  end if;

  select jsonb_build_object(
    'clinicaId',v_clinica::text,
    'clinicaNome',v_clinica_nome,
    'items',coalesce(jsonb_agg(item order by ordem_tipo, ordem_data nulls last, paciente_nome), '[]'::jsonb),
    'modelos',coalesce((
      select jsonb_agg(modelo order by dentista_nome, tipo)
      from (
        select jsonb_build_object(
          'dentistaId',d.id::text,'dentistaNome',left(d.nome,200),'tipo',t.tipo,
          'ativo',coalesce(m.ativo,true),'template',coalesce(m.template,private.pendencias_template_padrao(t.tipo)),
          'versao',coalesce(m.versao,0),'podeEditar',(
            d.user_id=v_ator or private.pendencias_tem_permissao_clinica(v_clinica,v_membro,'configuracoes.gerir')
          )
        ) as modelo, d.nome as dentista_nome, t.tipo
        from public.dentistas d
        join public.clinica_usuarios du on du.usuario_id=d.user_id and du.clinica_id=d.clinica_id
          and du.status='ativo' and du.role in ('admin','dentista')
        cross join (values ('confirmar_presenca'::text),('reativar_paciente'::text)) t(tipo)
        left join public.pendencias_mensagens m on m.clinica_id=v_clinica and m.dentista_id=d.id and m.tipo=t.tipo
        where d.clinica_id=v_clinica and d.ativo and d.role in ('admin','dentista')
          and private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',d.id)
          and (private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.ler',d.id)
            or private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'pacientes.ler',d.id))
        order by dentista_nome, tipo
        limit 500
      ) modelos
    ),'[]'::jsonb)
  ) into v_board
  from (
    select
      jsonb_build_object(
        'id',p.id::text,'tipo',p.tipo,'status',p.status,
        'pacienteId',p.paciente_id::text,'pacienteNome',left(pa.nome,200),
        'temTelefone',(private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',p.dentista_id)
          and private.pendencias_telefone(v_clinica,p.paciente_id) is not null),
        'dentistaId',p.dentista_id::text,'dentistaNome',left(d.nome,200),
        'agendamentoId',p.agendamento_id::text,'dataHora',a.data_hora,'duracaoMinutos',a.duracao_minutos,
        'ultimaVisitaEm',case when p.tipo='reativar_paciente' then ac.data_atendimento::text else null end,
        'responsavelUsuarioId',p.responsavel_usuario_id::text,'envioConfirmado',p.envio_confirmado,
        'adiadoAte',p.adiado_ate,'resolucao',p.resolucao,'versao',p.versao,
        'mensagem',case when private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',p.dentista_id)
          then private.pendencias_renderizar_template(coalesce(m.template,private.pendencias_template_padrao(p.tipo)),pa.nome,d.nome,v_clinica_nome,a.data_hora)
          else 'Mensagem indisponível.' end,
        'capabilities',jsonb_build_object(
          'podeVerContato',private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',p.dentista_id),
          'podeAbrirWhatsApp',private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',p.dentista_id)
            and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id),
          'podeGerirAcompanhamento',private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id),
          'podeRegistrarEnvio',private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',p.dentista_id)
            and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id),
          'podeConfirmarAgenda',p.tipo='confirmar_presenca'
            and private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.confirmar',p.dentista_id)
            and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id),
          'podeCancelarAgenda',p.tipo='confirmar_presenca'
            and private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.editar',p.dentista_id)
            and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id),
          'podeConcluirAgendamento',private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.editar',p.dentista_id)
            and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',p.responsavel_usuario_id)
        )
      ) as item,
      case p.tipo when 'confirmar_presenca' then 0 else 1 end as ordem_tipo,
      coalesce(a.data_hora,ac.data_atendimento::timestamptz) as ordem_data, pa.nome as paciente_nome
    from public.pendencias_contatos p
    join public.pacientes pa on pa.id=p.paciente_id and pa.clinica_id=p.clinica_id
    join public.dentistas d on d.id=p.dentista_id and d.clinica_id=p.clinica_id
      and d.ativo and d.role in ('admin','dentista')
    join public.clinica_usuarios du on du.usuario_id=d.user_id and du.clinica_id=d.clinica_id
      and du.status='ativo' and du.role in ('admin','dentista')
    left join public.agendamentos a on a.id=p.agendamento_id and a.clinica_id=p.clinica_id
    left join public.atendimentos_clinicos ac on ac.id::text=p.origem_versao and ac.clinica_id=p.clinica_id
    left join public.pendencias_mensagens m on m.clinica_id=p.clinica_id and m.dentista_id=p.dentista_id and m.tipo=p.tipo
    where p.clinica_id=v_clinica
      and (p.status <> 'resolvido' or p.resolved_at >= date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
      and (p.status <> 'a_contatar' or coalesce(m.ativo,true))
      and ((p.tipo='confirmar_presenca' and private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.ler',p.dentista_id))
        or (p.tipo='reativar_paciente'
          and private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'pacientes.ler',p.dentista_id)
          and private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.ler',p.responsavel_usuario_id)))
    order by ordem_tipo, ordem_data nulls last, paciente_nome
    limit 500
  ) itens;
  return jsonb_build_object('ok',true,'data',v_board);
exception when lock_not_available or query_canceled then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível carregar as pendências.');
when others then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível carregar as pendências.');
end;
$$;

create or replace function private.materializar_pendencias_contatos(
  p_clinica_id uuid, p_membro_id uuid
) returns void language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
begin
  -- Um adiamento não cria nova origem; quando vence, o mesmo ciclo volta à fila.
  with alvo as (
    select p.id,p.status,p.versao from public.pendencias_contatos p
    where p.clinica_id=p_clinica_id and p.status='resolvido' and p.resolucao='adiado'
      and p.adiado_ate <= now()
      and private.pendencias_tem_acompanhamento(p.clinica_id,p_membro_id,'acompanhamentos.ler',p.responsavel_usuario_id)
    for update
  ), alteradas as (
    update public.pendencias_contatos p set status='a_contatar', adiado_ate=null,
      resolucao=null, resolved_at=null, resolved_by=null, versao=p.versao+1, updated_at=now()
    from alvo where p.id=alvo.id returning p.id,p.versao,alvo.status as estado_anterior
  ) insert into public.pendencias_contatos_historico(clinica_id,pendencia_id,ator_usuario_id,acao,estado_anterior,estado_novo,versao_anterior,versao_nova)
    select p_clinica_id,id,(select auth.uid()),'reconciliar',estado_anterior,'a_contatar',versao-1,versao from alteradas;

  -- Uma nova agenda futura encerra a reativação daquele atendimento, inclusive se a UI caiu após salvar.
  with alvo as (
    select p.id,p.status,p.versao from public.pendencias_contatos p
    where p.clinica_id=p_clinica_id and p.tipo='reativar_paciente' and p.status <> 'resolvido'
      and (exists (select 1 from public.agendamentos a where a.clinica_id=p.clinica_id
        and a.paciente_id=p.paciente_id and a.data_hora > now()
        and a.status in ('scheduled','confirmed','checked_in','in_progress'))
        or exists (select 1 from public.atendimentos_clinicos novo
          join public.atendimentos_clinicos origem on origem.id::text=p.origem_versao and origem.clinica_id=p.clinica_id
          where novo.clinica_id=p.clinica_id and novo.paciente_id=p.paciente_id and novo.estado='finalizado'
            and (novo.data_atendimento,novo.created_at,novo.id::text) > (origem.data_atendimento,origem.created_at,origem.id::text)))
      and private.pendencias_tem_permissao_profissional(p.clinica_id,p_membro_id,'pacientes.ler',p.dentista_id)
      and private.pendencias_tem_acompanhamento(p.clinica_id,p_membro_id,'acompanhamentos.ler',p.responsavel_usuario_id)
    for update
  ), alteradas as (
    update public.pendencias_contatos p set status='resolvido', resolucao=case when exists (
      select 1 from public.atendimentos_clinicos novo
      join public.atendimentos_clinicos origem on origem.id::text=p.origem_versao and origem.clinica_id=p.clinica_id
      where novo.clinica_id=p.clinica_id and novo.paciente_id=p.paciente_id and novo.estado='finalizado'
        and (novo.data_atendimento,novo.created_at,novo.id::text) > (origem.data_atendimento,origem.created_at,origem.id::text)
    ) then 'novo_atendimento' else 'agendamento_criado' end,
      adiado_ate=null, resolved_at=now(), resolved_by=(select auth.uid()), versao=p.versao+1, updated_at=now()
    from alvo where p.id=alvo.id returning p.id,p.versao,alvo.status as estado_anterior
  ) insert into public.pendencias_contatos_historico(clinica_id,pendencia_id,ator_usuario_id,acao,estado_anterior,estado_novo,versao_anterior,versao_nova)
    select p_clinica_id,id,(select auth.uid()),'reconciliar',estado_anterior,'resolvido',versao-1,versao from alteradas;

  -- Confirmação registrada pela Agenda fora desta tela também fecha o cartão correspondente.
  with alvo as (
    select p.id,p.status,p.versao from public.pendencias_contatos p
    join public.agendamentos a on a.id=p.agendamento_id and a.clinica_id=p.clinica_id
    where p.clinica_id=p_clinica_id and p.tipo='confirmar_presenca' and p.status <> 'resolvido'
      and (a.status in ('confirmed','cancelled','completed','no_show','checked_in','in_progress') or a.data_hora::text <> p.origem_versao)
      and private.pendencias_tem_permissao_profissional(p.clinica_id,p_membro_id,'agenda.ler',p.dentista_id)
    for update of p
  ), alteradas as (
    update public.pendencias_contatos p set status='resolvido', resolucao=case a.status
      when 'confirmed' then 'confirmado' when 'cancelled' then 'cancelado' when 'completed' then 'agenda_realizada'
      when 'no_show' then 'nao_compareceu' when 'checked_in' then 'confirmado'
      when 'in_progress' then 'confirmado' else 'reagendado' end,
      resolved_at=now(),resolved_by=(select auth.uid()),versao=p.versao+1,updated_at=now()
    from alvo, public.agendamentos a
    where a.id=p.agendamento_id and a.clinica_id=p.clinica_id and p.id=alvo.id
    returning p.id,p.versao,alvo.status as estado_anterior
  ) insert into public.pendencias_contatos_historico(clinica_id,pendencia_id,ator_usuario_id,acao,estado_anterior,estado_novo,versao_anterior,versao_nova)
    select p_clinica_id,id,(select auth.uid()),'reconciliar',estado_anterior,'resolvido',versao-1,versao from alteradas;

  insert into public.pendencias_contatos(
    clinica_id,tipo,paciente_id,dentista_id,agendamento_id,origem_versao,responsavel_usuario_id
  )
  select a.clinica_id,'confirmar_presenca',a.paciente_id,a.dentista_id,a.id,
    a.data_hora::text,d.user_id
  from public.agendamentos a
  join public.dentistas d on d.id=a.dentista_id and d.clinica_id=a.clinica_id
    and d.ativo and d.role in ('admin','dentista')
  join public.clinica_usuarios du on du.usuario_id=d.user_id and du.clinica_id=d.clinica_id
    and du.status='ativo' and du.role in ('admin','dentista')
  left join public.pendencias_mensagens m on m.clinica_id=a.clinica_id and m.dentista_id=a.dentista_id
    and m.tipo='confirmar_presenca'
  where a.clinica_id=p_clinica_id and a.status='scheduled' and coalesce(m.ativo,true)
    and a.data_hora >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'
    and a.data_hora < (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '2 days') at time zone 'America/Sao_Paulo'
    and private.pendencias_tem_permissao_profissional(a.clinica_id,p_membro_id,'agenda.ler',a.dentista_id)
  on conflict (clinica_id,tipo,paciente_id,dentista_id,origem_versao) do nothing;

  insert into public.pendencias_contatos(
    clinica_id,tipo,paciente_id,dentista_id,agendamento_id,origem_versao,responsavel_usuario_id
  )
  select p.clinica_id,'reativar_paciente',p.id,ultimo.dentista_id,null,
    ultimo.id::text,d.user_id
  from public.pacientes p
  join lateral (
    select ac.id,ac.dentista_id,ac.data_atendimento,ac.created_at from public.atendimentos_clinicos ac
    where ac.clinica_id=p.clinica_id and ac.paciente_id=p.id
      and ac.estado='finalizado'
    order by ac.data_atendimento desc, ac.created_at desc, ac.id desc limit 1
  ) ultimo on true
  join public.dentistas d on d.id=ultimo.dentista_id and d.clinica_id=p.clinica_id
    and d.ativo and d.role in ('admin','dentista')
  join public.clinica_usuarios du on du.usuario_id=d.user_id and du.clinica_id=d.clinica_id
    and du.status='ativo' and du.role in ('admin','dentista')
  left join public.pendencias_mensagens m on m.clinica_id=p.clinica_id and m.dentista_id=ultimo.dentista_id
    and m.tipo='reativar_paciente'
  where p.clinica_id=p_clinica_id and coalesce(m.ativo,true)
    and ultimo.data_atendimento <= ((now() at time zone 'America/Sao_Paulo')::date - 30)
    and not exists (select 1 from public.agendamentos a where a.clinica_id=p.clinica_id
      and a.paciente_id=p.id and a.data_hora > now()
      and a.status in ('scheduled','confirmed','checked_in','in_progress'))
    and private.pendencias_tem_permissao_profissional(p.clinica_id,p_membro_id,'pacientes.ler',ultimo.dentista_id)
    and private.pendencias_tem_acompanhamento(p.clinica_id,p_membro_id,'acompanhamentos.ler',d.user_id)
  on conflict (clinica_id,tipo,paciente_id,dentista_id,origem_versao) do nothing;
end;
$$;
