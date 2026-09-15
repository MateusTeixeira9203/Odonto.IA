-- R-161d incremental: corrige execução de reconciliação, escopo profissional e privacidade.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

create or replace function private.pendencias_tem_permissao_profissional(
  p_clinica_id uuid, p_membro_id uuid, p_permissao text, p_dentista_id uuid
) returns boolean language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from public.clinica_acessos ca
    cross join lateral jsonb_array_elements(ca.acessos) a(value)
    where ca.clinica_id=p_clinica_id and ca.membro_id=p_membro_id
      and a.value->>'permissao'=p_permissao
      and (
        a.value->'escopo'->>'tipo'='clinica'
        or (a.value->'escopo'->>'tipo'='selecionados'
          and a.value->'escopo'->'dentistaIds' @> jsonb_build_array(to_jsonb(p_dentista_id::text)))
        or (a.value->'escopo'->>'tipo'='proprio' and exists (
          select 1 from public.dentistas d
          join public.clinica_usuarios cu on cu.usuario_id=d.user_id and cu.clinica_id=d.clinica_id
          where d.id=p_dentista_id and d.clinica_id=p_clinica_id and cu.id=p_membro_id
            and d.ativo and d.role in ('admin','dentista')
        ))
      )
  );
$$;

create or replace function private.pendencias_telefone(p_clinica_id uuid, p_paciente_id uuid)
returns text language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select nullif(btrim(coalesce(
    nullif(btrim(p.numero_whatsapp),''),
    nullif(btrim(p.whatsapp),''),
    nullif(btrim(p.telefone),''),
    nullif(btrim(p.responsavel_telefone),'')
  )), '')
  from public.pacientes p where p.id=p_paciente_id and p.clinica_id=p_clinica_id;
$$;

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
        cross join (values ('confirmar_presenca'::text),('reativar_paciente'::text)) t(tipo)
        left join public.pendencias_mensagens m on m.clinica_id=v_clinica and m.dentista_id=d.id and m.tipo=t.tipo
        where d.clinica_id=v_clinica and d.ativo
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
  join public.dentistas d on d.id=a.dentista_id and d.clinica_id=a.clinica_id and d.ativo
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
  join public.dentistas d on d.id=ultimo.dentista_id and d.clinica_id=p.clinica_id and d.ativo
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

create or replace function private.operar_pendencia_contato(p_acao text, p_entrada jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_clinica uuid; v_pendencia_id uuid; v_versao integer; v_contexto jsonb;
  v_membro uuid; v_ator uuid; v_p public.pendencias_contatos%rowtype;
  v_agendamento public.agendamentos%rowtype; v_telefone text; v_numero text; v_mensagem text;
  v_estado_anterior text; v_side_effect jsonb := null; v_url text := null;
  v_data_esperada timestamptz; v_adiado timestamptz;
begin
  if p_acao is null or p_acao not in ('preparar_abertura','registrar_envio','nao_enviei','adiar','resolver','confirmar_agendamento','cancelar_agendamento','concluir_agendamento')
    or p_entrada is null or jsonb_typeof(p_entrada) <> 'object'
    or coalesce(p_entrada->>'clinicaIdEsperada','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_entrada->>'pendenciaId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(p_entrada->>'versaoEsperada','') !~ '^[1-9][0-9]{0,9}$' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Dados da pendência inválidos.');
  end if;
  v_clinica := (p_entrada->>'clinicaIdEsperada')::uuid;
  v_pendencia_id := (p_entrada->>'pendenciaId')::uuid;
  v_versao := (p_entrada->>'versaoEsperada')::integer;
  v_contexto := private.pendencias_contexto(v_clinica);
  if coalesce((v_contexto->>'ok')::boolean,false) is not true then return v_contexto; end if;
  v_membro := (v_contexto#>>'{data,membroId}')::uuid;
  v_ator := (v_contexto#>>'{data,atorId}')::uuid;
  select * into v_p from public.pendencias_contatos
    where id=v_pendencia_id and clinica_id=v_clinica for update;
  if not found then return jsonb_build_object('ok',false,'codigo','NAO_ENCONTRADO','mensagem','Pendência não encontrada.'); end if;
  if v_p.versao <> v_versao then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','A pendência foi alterada.'); end if;
  if v_p.status='resolvido' then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Esta pendência já foi resolvida.'); end if;
  if (v_p.tipo='confirmar_presenca' and not private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.ler',v_p.dentista_id))
    or (v_p.tipo='reativar_paciente' and (
      not private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'pacientes.ler',v_p.dentista_id)
      or not private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.ler',v_p.responsavel_usuario_id)
    )) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso para ler esta pendência.');
  end if;
  if not private.pendencias_tem_acompanhamento(v_clinica,v_membro,'acompanhamentos.gerir',v_p.responsavel_usuario_id) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso para alterar o acompanhamento.');
  end if;
  if exists (select 1 from public.pendencias_mensagens m where m.clinica_id=v_clinica and m.dentista_id=v_p.dentista_id
      and m.tipo=v_p.tipo and m.ativo=false) and p_acao='preparar_abertura' then
    return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Este tipo de contato foi desativado.');
  end if;
  v_estado_anterior := v_p.status;

  if p_acao in ('preparar_abertura','registrar_envio','nao_enviei')
    and not private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'contatos.whatsapp',v_p.dentista_id) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso ao contato do paciente.');
  end if;
  if p_acao='confirmar_agendamento' and (v_p.tipo <> 'confirmar_presenca'
    or not private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.confirmar',v_p.dentista_id)) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso para confirmar esta agenda.');
  end if;
  if p_acao in ('cancelar_agendamento','concluir_agendamento') and not private.pendencias_tem_permissao_profissional(v_clinica,v_membro,'agenda.editar',v_p.dentista_id) then
    return jsonb_build_object('ok',false,'codigo','SEM_ACESSO','mensagem','Sem acesso para alterar esta agenda.');
  end if;
  if p_acao='resolver' and v_p.tipo <> 'reativar_paciente' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Esta ação só encerra contatos de reativação.');
  end if;
  if p_acao='adiar' and v_p.tipo <> 'reativar_paciente' then
    return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Esta ação só adia contatos de reativação.');
  end if;

  if p_acao='preparar_abertura' then
    if v_p.status <> 'a_contatar' then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Este contato já foi aberto.'); end if;
    v_mensagem := btrim(coalesce(p_entrada->>'mensagem',''));
    if char_length(v_mensagem) not between 1 and 2000 then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Escreva uma mensagem de até 2000 caracteres.');
    end if;
    v_telefone := private.pendencias_telefone(v_clinica,v_p.paciente_id);
    v_numero := regexp_replace(coalesce(v_telefone,''),'[^0-9]','','g');
    if char_length(v_numero) in (10,11) then v_numero := '55' || v_numero; end if;
    if char_length(v_numero) not between 12 and 15 then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','O paciente não possui telefone para WhatsApp.');
    end if;
    update public.pendencias_contatos set status='esperando_resposta',envio_confirmado=false,
      resolucao=null,adiado_ate=null,resolved_at=null,resolved_by=null,versao=versao+1,updated_at=now()
      where id=v_p.id and clinica_id=v_clinica;
    v_url := 'https://wa.me/' || v_numero || '?text=' || private.pendencias_url_encode(v_mensagem);
  elsif p_acao='registrar_envio' then
    if v_p.status <> 'esperando_resposta' or v_p.envio_confirmado then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Abra o contato antes de registrar o envio.'); end if;
    update public.pendencias_contatos set envio_confirmado=true,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
  elsif p_acao='nao_enviei' then
    if v_p.status <> 'esperando_resposta' or v_p.envio_confirmado then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Este contato não está aguardando resposta.'); end if;
    update public.pendencias_contatos set status='a_contatar',envio_confirmado=false,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
  elsif p_acao='adiar' then
    begin v_adiado := (p_entrada->>'adiadoAte')::timestamptz; exception when others then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Informe uma data de adiamento válida.'); end;
    if v_adiado is null or not isfinite(v_adiado) or v_adiado <= now() then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','O adiamento deve ser futuro.');
    end if;
    update public.pendencias_contatos set status='resolvido',resolucao='adiado',adiado_ate=v_adiado,
      resolved_at=now(),resolved_by=v_ator,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
  elsif p_acao='resolver' then
    update public.pendencias_contatos set status='resolvido',resolucao='contato_encerrado',adiado_ate=null,
      resolved_at=now(),resolved_by=v_ator,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
  elsif p_acao in ('confirmar_agendamento','cancelar_agendamento') then
    if coalesce(p_entrada->>'agendamentoId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Agendamento inválido.');
    end if;
    begin v_data_esperada := (p_entrada->>'dataHoraEsperada')::timestamptz; exception when others then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Horário do agendamento inválido.'); end;
    if p_acao='cancelar_agendamento' and (p_entrada->>'confirmarCancelamento') is distinct from 'true' then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Confirme o cancelamento antes de continuar.');
    end if;
    select * into v_agendamento from public.agendamentos where id=(p_entrada->>'agendamentoId')::uuid
      and id=v_p.agendamento_id and clinica_id=v_clinica and paciente_id=v_p.paciente_id and dentista_id=v_p.dentista_id
      and data_hora=v_data_esperada and status='scheduled' for update;
    if not found then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O agendamento mudou. Atualize antes de continuar.'); end if;
    update public.agendamentos set status=case when p_acao='confirmar_agendamento' then 'confirmed' else 'cancelled' end,
      confirmado_em=case when p_acao='confirmar_agendamento' then now() else confirmado_em end,
      updated_at=now() where id=v_agendamento.id and clinica_id=v_clinica and status='scheduled';
    update public.pendencias_contatos set status='resolvido',resolucao=case when p_acao='confirmar_agendamento' then 'confirmado' else 'cancelado' end,
      adiado_ate=null,resolved_at=now(),resolved_by=v_ator,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
    v_side_effect := jsonb_build_object('tipo',case when p_acao='confirmar_agendamento' then 'confirmado' else 'cancelado' end,
      'googleEventId',v_agendamento.google_event_id,'dentistaId',v_agendamento.dentista_id::text);
  else
    if v_p.status <> 'esperando_resposta' or v_p.envio_confirmado is not true
      or coalesce(p_entrada->>'agendamentoId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok',false,'codigo','INVALIDO','mensagem','Agendamento de conclusão inválido.');
    end if;
    if not exists (select 1 from public.agendamentos a where a.id=(p_entrada->>'agendamentoId')::uuid
      and a.clinica_id=v_clinica and a.paciente_id=v_p.paciente_id and a.dentista_id=v_p.dentista_id
      and a.data_hora > now() and a.status in ('scheduled','confirmed','checked_in','in_progress')
      and (v_p.tipo='reativar_paciente' or (a.id=v_p.agendamento_id and a.data_hora::text <> v_p.origem_versao))) then
      return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','O novo agendamento não está disponível para este contato.');
    end if;
    update public.pendencias_contatos set status='resolvido',resolucao='agendamento_criado',adiado_ate=null,
      resolved_at=now(),resolved_by=v_ator,versao=versao+1,updated_at=now() where id=v_p.id and clinica_id=v_clinica;
  end if;
  select * into v_p from public.pendencias_contatos where id=v_p.id and clinica_id=v_clinica;
  insert into public.pendencias_contatos_historico(clinica_id,pendencia_id,ator_usuario_id,acao,estado_anterior,estado_novo,versao_anterior,versao_nova)
    values(v_clinica,v_p.id,v_ator,p_acao,v_estado_anterior,v_p.status,v_versao,v_p.versao);
  return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'pendenciaId',v_p.id::text,'versao',v_p.versao,'whatsappUrl',v_url,'mensagem',case when p_acao='preparar_abertura' then v_mensagem else null end,
    'agendaSideEffect',v_side_effect
  ));
exception when lock_not_available or query_canceled then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível atualizar a pendência.');
when others then
  return jsonb_build_object('ok',false,'codigo','INDISPONIVEL','mensagem','Não foi possível atualizar a pendência.');
end;
$$;
