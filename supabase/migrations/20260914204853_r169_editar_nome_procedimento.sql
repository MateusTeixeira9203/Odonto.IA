begin;
set local lock_timeout = '5s';

-- R169 lote 2: uma assinatura com defaults mantém os clientes de cinco argumentos.
-- DROP sem CASCADE: dependência inesperada aborta toda a migration.
drop function public.editar_detalhes_evento_odontograma(uuid, jsonb, boolean, text, boolean);
create function public.editar_detalhes_evento_odontograma(
  p_evento_id uuid,
  p_detalhe jsonb default null,
  p_alterar_detalhe boolean default false,
  p_observacao text default null,
  p_alterar_observacao boolean default false,
  p_procedimento_nome text default null,
  p_alterar_nome boolean default false,
  p_original jsonb default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_role text := public.get_my_role();
  v_evento public.odontograma_eventos%rowtype;
  v_ficha_id uuid;
  v_ficha_assinada_em timestamptz;
  v_actor_nome text;
begin
  if v_clinica_id is null or v_caller is null or coalesce(v_role, '') not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;
  if not (coalesce(p_alterar_detalhe, false) or coalesce(p_alterar_observacao, false) or coalesce(p_alterar_nome, false)) then
    raise exception 'nenhuma_alteracao';
  end if;
  if p_alterar_nome and (nullif(btrim(p_procedimento_nome), '') is null or char_length(btrim(p_procedimento_nome)) > 500) then
    raise exception 'nome_invalido';
  end if;
  if p_alterar_observacao and char_length(btrim(p_observacao)) > 4000 then
    raise exception 'observacao_invalida';
  end if;
  if p_alterar_nome and p_original is null then
    raise exception 'snapshot_obrigatorio';
  end if;

  select e.ficha_id into v_ficha_id from public.odontograma_eventos e
  where e.id = p_evento_id and e.clinica_id = v_clinica_id;
  if not found then raise exception 'registro_bloqueado'; end if;

  -- Mesma ordem do salvamento clínico: ficha antes de evento; assinatura não passa no meio.
  if v_ficha_id is not null then
    select f.assinado_em into v_ficha_assinada_em from public.fichas f
    where f.id = v_ficha_id and f.clinica_id = v_clinica_id for update;
    if not found or v_ficha_assinada_em is not null then raise exception 'registro_bloqueado'; end if;
  end if;
  select e.* into v_evento from public.odontograma_eventos e
  where e.id = p_evento_id and e.clinica_id = v_clinica_id for update;
  if not found or v_evento.assinatura_id is not null or (to_jsonb(v_evento)->>'retirado_em') is not null then raise exception 'registro_bloqueado'; end if;
  if v_evento.ficha_id is distinct from v_ficha_id then raise exception 'conflito_edicao'; end if;

  -- NULL no encaminhamento não pode conceder acesso ao colega.
  if v_caller is distinct from v_evento.dentista_id and v_caller is distinct from v_evento.encaminhado_para then
    raise exception 'sem_permissao';
  end if;
  if v_caller is distinct from v_evento.dentista_id and (p_alterar_nome or p_alterar_observacao) then
    raise exception 'sem_permissao';
  end if;
  if p_alterar_detalhe and v_evento.tipo not in ('endodontia', 'implante') then
    raise exception 'tipo_nao_suportado';
  end if;

  -- Cliente antigo pode omitir snapshot. Cliente novo compara somente o que editou.
  if p_original is not null then
    if jsonb_typeof(p_original) is distinct from 'object'
       or not (p_original ?& array['procedimentoNome','observacao','detalhe']) then
      raise exception 'snapshot_invalido';
    end if;
    if (p_alterar_nome and v_evento.procedimento_nome is distinct from (p_original->>'procedimentoNome'))
       or (p_alterar_observacao and nullif(btrim(v_evento.observacao), '') is distinct from nullif(btrim(p_original->>'observacao'), ''))
       or (p_alterar_detalhe and coalesce(v_evento.detalhe, 'null'::jsonb) is distinct from (p_original->'detalhe')) then
      raise exception 'conflito_edicao';
    end if;
  end if;

  select d.nome into v_actor_nome from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;

  update public.odontograma_eventos
  set procedimento_nome = case when p_alterar_nome then btrim(p_procedimento_nome) else procedimento_nome end,
      detalhe = case when p_alterar_detalhe then p_detalhe else detalhe end,
      observacao = case when p_alterar_observacao then nullif(btrim(p_observacao), '') else observacao end
  where id = p_evento_id and clinica_id = v_clinica_id;

  if v_ficha_id is not null and (p_alterar_nome or p_alterar_observacao) then
    -- Equivalente a derivarV2DosEventos: nome livre, fallback outro e observações por dente.
    -- Só campos textuais derivados: não muda status, datas clínicas ou seleção de dentes.
    with eventos as (
      select e.dente, row_number() over (order by e.created_at, e.id) as ordem,
        nullif(btrim(e.observacao), '') as observacao,
        coalesce(nullif(btrim(e.procedimento_nome), ''),
          case when e.tipo = 'outro' then nullif(btrim(e.observacao), '') end,
          case e.tipo
            when 'carie_restauracao' then 'Restauração' when 'exodontia' then 'Extração'
            when 'endodontia' then 'Canal' when 'lesao_periapical' then 'Lesão periapical'
            when 'implante' then 'Implante' when 'coroa' then 'Coroa total' when 'ponte' then 'Ponte'
            when 'selante' then 'Selante' when 'inclusao' then 'Incluso' when 'esfoliacao' then 'Esfoliado'
            when 'fratura' then 'Fratura' when 'pino_nucleo' then 'Pino/núcleo' when 'profilaxia' then 'Profilaxia'
            when 'raspagem' then 'Raspagem' when 'clareamento' then 'Clareamento' when 'fluor' then 'Flúor'
            when 'exame_periodontal' then 'Exame periodontal' else 'Outro procedimento' end) as rotulo
      from public.odontograma_eventos e
      where e.ficha_id = v_ficha_id and e.clinica_id = v_clinica_id
        and (to_jsonb(e)->>'retirado_em') is null
    ), rotulos as (
      select rotulo, min(ordem) as ordem from eventos group by rotulo
    ), por_dente as (
      select dente, string_agg(case when observacao is not null and observacao <> rotulo
        then rotulo || ' (' || observacao || ')' else rotulo end, E'\n' order by ordem) as texto
      from eventos where dente is not null group by dente
    )
    update public.fichas
    set procedimentos = array(select rotulo from rotulos order by ordem),
        dentes_observacoes = coalesce((select jsonb_object_agg(dente::text, texto) from por_dente), '{}'::jsonb),
        updated_at = now()
    where id = v_ficha_id and clinica_id = v_clinica_id;
  end if;

  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id, v_caller, v_actor_nome, v_evento.paciente_id, 'odontograma_evento', p_evento_id::text,
    'odontograma_evento.detalhe_alterado', jsonb_build_object(
      'tipo', v_evento.tipo, 'detalhe_alterado', p_alterar_detalhe,
      'observacao_alterada', p_alterar_observacao, 'nome_alterado', p_alterar_nome,
      'nome_anterior', case when p_alterar_nome then v_evento.procedimento_nome end,
      'nome_atual', case when p_alterar_nome then btrim(p_procedimento_nome) end
    )
  );
end;
$$;
revoke all on function public.editar_detalhes_evento_odontograma(uuid,jsonb,boolean,text,boolean,text,boolean,jsonb) from public, anon;
grant execute on function public.editar_detalhes_evento_odontograma(uuid,jsonb,boolean,text,boolean,text,boolean,jsonb) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
