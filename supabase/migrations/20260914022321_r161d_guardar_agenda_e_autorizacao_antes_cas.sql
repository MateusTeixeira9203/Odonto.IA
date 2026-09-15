-- R-161d incremental: autoriza antes de CAS e bloqueia agenda sem envio confirmado.
set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

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
  -- Autorize a origem e o acompanhamento antes de revelar versão ou estado do cartão.
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
  if v_p.versao <> v_versao then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','A pendência foi alterada.'); end if;
  if v_p.status='resolvido' then return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Esta pendência já foi resolvida.'); end if;
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
    if v_p.status <> 'esperando_resposta' or v_p.envio_confirmado is not true then
      return jsonb_build_object('ok',false,'codigo','CONFLITO','mensagem','Registre o envio antes de alterar a agenda.');
    end if;
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
