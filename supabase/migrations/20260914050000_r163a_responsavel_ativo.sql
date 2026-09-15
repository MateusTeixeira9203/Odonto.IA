-- Novos recebimentos clínicos exigem responsável ativo. Histórico continua preservado.
set local lock_timeout='1500ms';
create or replace function private.validar_titular_recebimento() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_orcamento public.orcamentos%rowtype;
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
    if new.titular_recebimento='clinica' and not exists(select 1 from public.clinica_governanca g where g.clinica_id=new.clinica_id and g.modelo_clinica='gerida' and exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=g.clinica_id and cu.usuario_id=g.responsavel_usuario_id and cu.status='ativo')) then
      raise exception 'TITULAR_CLINICA_INDISPONIVEL';
    end if;
  else
    select o.* into v_orcamento from public.orcamentos o where o.clinica_id=new.clinica_id and o.id=new.orcamento_id for update;
    if not found then raise exception 'ORCAMENTO_ORIGEM_INVALIDO'; end if;
    if tg_op='UPDATE' and (old.orcamento_id is distinct from new.orcamento_id or old.clinica_id is distinct from new.clinica_id) then raise exception 'ORIGEM_FINANCEIRA_IMUTAVEL'; end if;
    -- Caminhos legados permitiam dentista nulo. Derivar do orçamento sem aceitar outro titular clínico.
    if new.dentista_id is null then new.dentista_id:=v_orcamento.dentista_id; end if;
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
         exists(select 1 from public.clinica_governanca g where g.clinica_id=v_clinica and g.modelo_clinica='gerida' and exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=g.clinica_id and cu.usuario_id=g.responsavel_usuario_id and cu.status='ativo')) into v_owner,v_gerida;
  select nome into v_nome from public.clinicas where id=v_clinica;
  return jsonb_build_object('ok',true,'data',jsonb_build_object('clinicaId',v_clinica,'nome',v_nome,'proprietario',v_owner,'dentistaId',v_dentista,'gestaoDisponivel',v_owner,'recebimentoMisto',v_gerida));
end $$;
notify pgrst,'reload schema';
