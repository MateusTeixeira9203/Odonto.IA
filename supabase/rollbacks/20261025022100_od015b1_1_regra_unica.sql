-- OD-015b1: somente escrita local para revisão; NÃO aplicado pelo Dev.
-- Base = definição efetiva de produção em 24/10/2026, lida no odonto-qa; igualdade informada pelo DIFF-banco.
-- Restaura exatamente os corpos efetivos salvos e a trava anterior.
-- Volta de 20261025022100_od015b1_1_regra_unica.sql (anterior à M2 20261025022141).
begin;
drop policy odontograma_eventos_select_own on public.odontograma_eventos;
drop policy odontograma_eventos_insert_own on public.odontograma_eventos;
drop policy odontograma_eventos_update_own on public.odontograma_eventos;
drop policy odontograma_eventos_delete_own on public.odontograma_eventos;
create policy odontograma_eventos_write_own on public.odontograma_eventos for all using (belongs_to_active_clinic(clinica_id) AND (dentista_id = get_my_dentista_id()) AND (NOT (EXISTS ( SELECT 1
   FROM fichas f
  WHERE ((f.id = odontograma_eventos.ficha_id) AND (f.assinado_em IS NOT NULL)))))) with check (belongs_to_active_clinic(clinica_id) AND is_clinic_dentista() AND (dentista_id = get_my_dentista_id()) AND (NOT (EXISTS ( SELECT 1
   FROM fichas f
  WHERE ((f.id = odontograma_eventos.ficha_id) AND (f.assinado_em IS NOT NULL))))));

CREATE OR REPLACE FUNCTION public.adicionar_procedimentos_ficha(p_ficha_id uuid, p_paciente_id uuid, p_captura_id uuid, p_eventos jsonb)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_role text := public.get_my_role();
  v_ficha public.fichas%rowtype;
  v_actor_nome text;
  v_evento_ids uuid[];
  v_inseridos integer := 0;
begin
  if v_clinica_id is null or v_caller is null or coalesce(v_role, '') not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;
  if p_captura_id is null then
    raise exception 'evento_invalido';
  end if;
  if jsonb_typeof(p_eventos) is distinct from 'array' or jsonb_array_length(p_eventos) = 0 then
    raise exception 'evento_invalido';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_eventos) evento
    where not (evento ?& array[
      'id', 'clinica_id', 'paciente_id', 'dentista_id', 'ficha_id', 'tipo', 'status',
      'origem', 'momento_planejado', 'nivel', 'faces', 'observacao', 'realizado_em'
    ])
  ) then
    raise exception 'evento_invalido';
  end if;

  select f.* into v_ficha
  from public.fichas f
  where f.id = p_ficha_id
    and f.clinica_id = v_clinica_id
    and f.paciente_id = p_paciente_id
  for update;

  if not found then
    raise exception 'ficha_nao_encontrada';
  end if;
  if v_ficha.dentista_id is distinct from v_caller
     and not exists (
       select 1 from public.odontograma_eventos e
       where e.ficha_id = p_ficha_id
         and e.clinica_id = v_clinica_id
         and e.encaminhado_para = v_caller
         and e.retirado_em is null
     ) then
    raise exception 'sem_permissao';
  end if;
  if v_ficha.assinado_em is not null then
    raise exception 'ficha_assinada';
  end if;

  -- `jsonb_populate_recordset` tipa o payload antes do INSERT. A action compõe
  -- clínica/ator/ficha no servidor; estes guards impedem que uma chamada direta
  -- atravesse esse contexto ou use a RPC como update implícito.
  if exists (
    with payload as (
      select * from jsonb_populate_recordset(null::public.odontograma_eventos, p_eventos)
    )
    select 1 from payload p
    where p.id is null
      or p.clinica_id is distinct from v_clinica_id
      or p.paciente_id is distinct from p_paciente_id
      or p.dentista_id is distinct from v_caller
      or p.ficha_id is distinct from p_ficha_id
      or p.tipo is null or p.tipo not in (
        'carie_restauracao', 'exodontia', 'endodontia', 'lesao_periapical', 'implante', 'coroa',
        'ponte', 'selante', 'inclusao', 'esfoliacao', 'fratura', 'pino_nucleo', 'profilaxia',
        'raspagem', 'clareamento', 'fluor', 'exame_periodontal', 'outro'
      )
      or p.status is null or p.status not in ('indicado', 'realizado')
      or p.origem is null or p.origem not in ('clinica', 'preexistente')
      or p.momento_planejado is null or p.momento_planejado not in ('sessao_atual', 'proxima_sessao')
      or (p.status = 'indicado' and p.realizado_em is not null)
      or (p.status = 'realizado' and p.momento_planejado <> 'sessao_atual')
      or p.nivel is null or p.nivel not in ('geral', 'boca', 'arcada', 'quadrante', 'dente', 'face')
      or p.faces is null
      or (p.nivel in ('geral', 'boca') and (p.arcada is not null or p.quadrante is not null or p.dente is not null or p.faces <> '{}'))
      or (p.nivel = 'arcada' and (p.arcada not in ('superior', 'inferior') or p.quadrante is not null or p.dente is not null or p.faces <> '{}'))
      or (p.nivel = 'quadrante' and (p.arcada is not null or p.quadrante not between 1 and 8 or p.dente is not null or p.faces <> '{}'))
      or (p.nivel = 'dente' and (p.arcada is not null or p.quadrante is not null or p.faces <> '{}' or not (
        p.dente between 11 and 18 or p.dente between 21 and 28 or p.dente between 31 and 38 or p.dente between 41 and 48
        or p.dente between 51 and 55 or p.dente between 61 and 65 or p.dente between 71 and 75 or p.dente between 81 and 85
      )))
      or (p.nivel = 'face' and (p.arcada is not null or p.quadrante is not null or p.faces = '{}' or not (
        p.dente between 11 and 18 or p.dente between 21 and 28 or p.dente between 31 and 38 or p.dente between 41 and 48
        or p.dente between 51 and 55 or p.dente between 61 and 65 or p.dente between 71 and 75 or p.dente between 81 and 85
      )))
      or exists (select 1 from unnest(p.faces) face where face not in ('O', 'M', 'D', 'V', 'L'))
      or (p.papel_no_grupo is not null and p.papel_no_grupo not in ('pilar', 'pontico'))
      or char_length(coalesce(p.procedimento_nome, '')) > 500
      or char_length(coalesce(p.observacao, '')) > 4000
      or (p.tipo = 'outro' and nullif(btrim(coalesce(p.procedimento_nome, p.observacao)), '') is null)
      or (p.procedimento_id is not null and not exists (
        select 1 from public.procedimentos procedimento
        where procedimento.id = p.procedimento_id and procedimento.clinica_id = v_clinica_id
      ))
      or (p.encaminhado_para is not null and (
        p.status <> 'indicado'
        or p.encaminhado_para = v_caller
        or not exists (
          select 1 from public.dentistas destino
          where destino.id = p.encaminhado_para
            and destino.clinica_id = v_clinica_id
            and destino.ativo = true
            and destino.role in ('admin', 'dentista')
        )
      ))
  ) then
    raise exception 'evento_invalido';
  end if;

  if exists (
    with payload as (
      select id from jsonb_populate_recordset(null::public.odontograma_eventos, p_eventos)
    )
    select 1 from payload group by id having count(*) > 1
  ) then
    raise exception 'evento_invalido';
  end if;

  -- Um id já persistido só é retry se cada campo clínico/destino ainda é o mesmo.
  -- Linha retirada nunca volta por retry; linha assinada idêntica continua idempotente,
  -- pois não é tocada pela inserção abaixo.
  if exists (
    with payload as (
      select * from jsonb_populate_recordset(null::public.odontograma_eventos, p_eventos)
    )
    select 1
    from payload p
    join public.odontograma_eventos existente on existente.id = p.id
    where existente.retirado_em is not null
      or existente.clinica_id is distinct from p.clinica_id
      or existente.paciente_id is distinct from p.paciente_id
      or existente.dentista_id is distinct from p.dentista_id
      or existente.ficha_id is distinct from p.ficha_id
      or existente.captura_id is distinct from p_captura_id
      or existente.grupo_id is distinct from p.grupo_id
      or existente.tipo is distinct from p.tipo
      or existente.procedimento_id is distinct from p.procedimento_id
      or existente.procedimento_nome is distinct from p.procedimento_nome
      or existente.status is distinct from p.status
      or existente.origem is distinct from p.origem
      or existente.momento_planejado is distinct from p.momento_planejado
      or existente.nivel is distinct from p.nivel
      or existente.arcada is distinct from p.arcada
      or existente.quadrante is distinct from p.quadrante
      or existente.dente is distinct from p.dente
      or existente.faces is distinct from p.faces
      or existente.papel_no_grupo is distinct from p.papel_no_grupo
      or existente.observacao is distinct from p.observacao
      or existente.detalhe is distinct from p.detalhe
      or existente.realizado_em is distinct from p.realizado_em
      or existente.encaminhado_para is distinct from p.encaminhado_para
  ) then
    raise exception 'conflito_evento';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;
  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  with payload as (
    select * from jsonb_populate_recordset(null::public.odontograma_eventos, p_eventos)
  ), inseridos as (
    insert into public.odontograma_eventos (
      id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, procedimento_id,
      procedimento_nome, status, origem, momento_planejado, nivel, arcada, quadrante, dente,
      faces, papel_no_grupo, observacao, detalhe, realizado_em, encaminhado_para, captura_id
    )
    select
      p.id, p.clinica_id, p.paciente_id, p.dentista_id, p.ficha_id, p.grupo_id, p.tipo, p.procedimento_id,
      p.procedimento_nome, p.status, p.origem, p.momento_planejado, p.nivel, p.arcada, p.quadrante, p.dente,
      p.faces, p.papel_no_grupo, p.observacao, p.detalhe, p.realizado_em, p.encaminhado_para, p_captura_id
    from payload p
    left join public.odontograma_eventos existente on existente.id = p.id
    where existente.id is null
    returning id, paciente_id, tipo, status, dente
  )
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  )
  select
    v_clinica_id, v_caller, v_actor_nome, inseridos.paciente_id,
    'odontograma_evento', inseridos.id::text, 'odontograma_evento.adicionado_ficha',
    jsonb_build_object('ficha_id', p_ficha_id, 'captura_id', p_captura_id, 'tipo', inseridos.tipo,
      'status', inseridos.status, 'dente', inseridos.dente)
  from inseridos;
  get diagnostics v_inseridos = row_count;

  if v_inseridos > 0 then
    -- Recalcula de todos os eventos ATIVOS da ficha, nunca só do lote. Mantém datas,
    -- anotações, ortodontia e qualquer visita anterior fora desta mutação.
    with eventos as (
      select e.dente, e.status, row_number() over (order by e.created_at, e.id) as ordem,
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
            when 'exame_periodontal' then 'Exame periodontal' else 'Outro procedimento' end
        ) as rotulo
      from public.odontograma_eventos e
      where e.ficha_id = p_ficha_id and e.clinica_id = v_clinica_id and e.retirado_em is null
    ), rotulos as (
      select rotulo, min(ordem) as ordem from eventos group by rotulo
    ), por_dente as (
      select dente, string_agg(case when observacao is not null and observacao <> rotulo
        then rotulo || ' (' || observacao || ')' else rotulo end, E'\n' order by ordem) as texto
      from eventos where dente is not null group by dente
    ), dentes as (
      select distinct dente from eventos where dente is not null
    )
    update public.fichas
    set dentes_afetados = coalesce(array(select dente::integer from dentes order by dente), '{}'::integer[]),
        dentes_observacoes = coalesce((select jsonb_object_agg(dente::text, texto) from por_dente), '{}'::jsonb),
        procedimentos = array(select rotulo from rotulos order by ordem),
        status = case when exists (select 1 from eventos where status = 'indicado') then 'aberta' else 'concluida' end,
        updated_at = now()
    where id = p_ficha_id and clinica_id = v_clinica_id;
  end if;

  select array_agg((evento->>'id')::uuid order by ordinality)
  into v_evento_ids
  from jsonb_array_elements(p_eventos) with ordinality as lote(evento, ordinality);
  return v_evento_ids;
end;
$function$;

CREATE OR REPLACE FUNCTION public.concluir_evento_encaminhado(p_evento_ids uuid[], p_novo_status text, p_realizado_em date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := get_my_clinica_id();
  v_caller     uuid := get_my_dentista_id();
  v_role       text := get_my_role();
  v_count      int;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;
  if p_novo_status not in ('indicado', 'realizado') then
    raise exception 'status_invalido';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;

  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  select count(*) into v_count
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id
  where e.id = any(p_evento_ids)
    and e.clinica_id = v_clinica_id
    and e.encaminhado_para = v_caller
    and f.assinado_em is null;

  if v_count <> coalesce(array_length(p_evento_ids, 1), 0) then
    raise exception 'sem_permissao';
  end if;

  with alterados as (
    update public.odontograma_eventos
       set status             = p_novo_status,
           realizado_em       = case when p_novo_status = 'realizado' then p_realizado_em else null end,
           momento_planejado  = case when p_novo_status = 'realizado' then 'sessao_atual' else momento_planejado end
     where id = any(p_evento_ids)
       and clinica_id = v_clinica_id
    returning id, paciente_id
  )
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  )
  select
    v_clinica_id,
    v_caller,
    v_actor_nome,
    alterados.paciente_id,
    'odontograma_evento',
    alterados.id::text,
    case when p_novo_status = 'realizado'
      then 'odontograma_evento.marcado_realizado'
      else 'odontograma_evento.reaberto'
    end,
    jsonb_build_object('status', p_novo_status, 'realizado_em', p_realizado_em)
  from alterados;
end;
$function$;

CREATE OR REPLACE FUNCTION public.editar_detalhes_evento_odontograma(p_evento_id uuid, p_detalhe jsonb DEFAULT NULL::jsonb, p_alterar_detalhe boolean DEFAULT false, p_observacao text DEFAULT NULL::text, p_alterar_observacao boolean DEFAULT false, p_procedimento_nome text DEFAULT NULL::text, p_alterar_nome boolean DEFAULT false, p_original jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if v_evento.encaminhado_para is null then
    if v_caller is distinct from v_evento.dentista_id then
      raise exception 'sem_permissao';
    end if;
  elsif v_caller is distinct from v_evento.encaminhado_para
     or p_alterar_nome
     or p_alterar_observacao
     or not p_alterar_detalhe then
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
$function$;

CREATE OR REPLACE FUNCTION public.editar_evolucao_clinica(p_paciente_id uuid, p_ficha_id uuid, p_atendimento_id uuid, p_evolucao_id uuid, p_texto_original text, p_texto text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_clinica uuid := public.get_my_clinica_id();
  v_autor uuid := public.get_my_dentista_id();
  v_ficha public.fichas%rowtype;
  v_evolucao public.ficha_evolucoes%rowtype;
  v_data date;
  v_texto text := nullif(btrim(p_texto), '');
begin
  if auth.uid() is null or v_clinica is null or v_autor is null
     or coalesce(public.get_my_role(), '') not in ('dentista', 'admin') then
    raise exception 'evolucao_sem_permissao';
  end if;
  if p_paciente_id is null or p_ficha_id is null or p_texto is null
     or char_length(p_texto) > 20000 then raise exception 'evolucao_invalida'; end if;

  select * into v_ficha from public.fichas
  where id = p_ficha_id and clinica_id = v_clinica and paciente_id = p_paciente_id for update;
  if not found then raise exception 'evolucao_sem_permissao'; end if;
  if v_ficha.assinado_em is not null or v_ficha.assinatura_url is not null then
    raise exception 'evolucao_assinada';
  end if;

  if p_evolucao_id is not null then
    select * into v_evolucao from public.ficha_evolucoes
    where id = p_evolucao_id and ficha_id = p_ficha_id and clinica_id = v_clinica
      and atendimento_id is not distinct from p_atendimento_id for update;
    if not found or v_evolucao.dentista_id is distinct from v_autor
       or v_evolucao.automatica then raise exception 'evolucao_sem_permissao'; end if;
    if v_evolucao.texto is distinct from p_texto_original then raise exception 'evolucao_conflito'; end if;
    update public.ficha_evolucoes set texto = v_texto, updated_at = now()
    where id = p_evolucao_id and clinica_id = v_clinica;
    if not found then raise exception 'evolucao_sem_permissao'; end if;
  elsif p_atendimento_id is null then
    -- O leitor usa anotacoes apenas quando não existe linha de evolução.
    if v_ficha.dentista_id is distinct from v_autor then raise exception 'evolucao_sem_permissao'; end if;
    if exists(select 1 from public.ficha_evolucoes where ficha_id = p_ficha_id and clinica_id = v_clinica)
      then raise exception 'evolucao_conflito'; end if;
    if v_ficha.anotacoes is distinct from p_texto_original then raise exception 'evolucao_conflito'; end if;
    update public.fichas set anotacoes = v_texto, updated_at = now()
    where id = p_ficha_id and clinica_id = v_clinica and paciente_id = p_paciente_id;
    if not found then raise exception 'evolucao_sem_permissao'; end if;
  else
    select data_atendimento into v_data from public.atendimentos_clinicos
    where id = p_atendimento_id and clinica_id = v_clinica
      and paciente_id = p_paciente_id and dentista_id = v_autor;
    if not found or not exists (
      select 1 from public.atendimento_eventos ae
      join public.odontograma_eventos e on e.id = ae.evento_id and e.clinica_id = v_clinica
      where ae.atendimento_id = p_atendimento_id and ae.clinica_id = v_clinica
        and e.ficha_id = p_ficha_id and e.paciente_id = p_paciente_id
    ) then raise exception 'evolucao_sem_permissao'; end if;
    if p_texto_original is not null or exists (
      select 1 from public.ficha_evolucoes where ficha_id = p_ficha_id and clinica_id = v_clinica
        and atendimento_id = p_atendimento_id
    ) then raise exception 'evolucao_conflito'; end if;
    insert into public.ficha_evolucoes(clinica_id, ficha_id, atendimento_id, dentista_id, data, texto, automatica)
    values (v_clinica, p_ficha_id, p_atendimento_id, v_autor, v_data, v_texto, false);
  end if;
  return v_texto;
end;
$function$;

CREATE OR REPLACE FUNCTION public.encaminhar_eventos_odontograma(p_evento_ids uuid[], p_destino_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id   uuid := get_my_clinica_id();
  v_caller       uuid := get_my_dentista_id();
  v_role         text := get_my_role();
  v_count        int;
  v_actor_nome   text;
  v_destino_nome text;
begin
  if v_role not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;

  if coalesce(array_length(p_evento_ids, 1), 0) = 0 then
    raise exception 'evento_invalido';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;

  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  if p_destino_id is not null then
    select d.nome into v_destino_nome
    from public.dentistas d
    where d.id = p_destino_id
      and d.clinica_id = v_clinica_id
      and d.ativo = true
      and d.role in ('admin', 'dentista')
      and d.id <> v_caller;

    if v_destino_nome is null then
      raise exception 'destino_invalido';
    end if;
  end if;

  select count(*) into v_count
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id
  where e.id = any(p_evento_ids)
    and e.clinica_id = v_clinica_id
    and e.dentista_id = v_caller
    and e.status = 'indicado'
    and f.assinado_em is null;

  if v_count <> coalesce(array_length(p_evento_ids, 1), 0) then
    raise exception 'sem_permissao';
  end if;

  with alterados as (
    update public.odontograma_eventos
       set encaminhado_para = p_destino_id
     where id = any(p_evento_ids)
       and clinica_id = v_clinica_id
    returning id, paciente_id
  )
  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  )
  select
    v_clinica_id,
    v_caller,
    v_actor_nome,
    alterados.paciente_id,
    'odontograma_evento',
    alterados.id::text,
    case when p_destino_id is null
      then 'odontograma_evento.encaminhamento_removido'
      else 'odontograma_evento.encaminhado'
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'destino_id', p_destino_id,
      'destino_nome', v_destino_nome
    ))
  from alterados;
end;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_evento_odontograma(p_evento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := get_my_clinica_id();
  v_caller uuid := get_my_dentista_id();
  v_role text := get_my_role();
  v_paciente_id uuid;
  v_autor_id uuid;
  v_ficha_id uuid;
  v_assinatura_id uuid;
  v_ficha_assinada_em timestamptz;
  v_tipo text;
  v_status text;
  v_dente smallint;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') or v_caller is null then
    raise exception 'sem_permissao';
  end if;

  select
    e.paciente_id,
    e.dentista_id,
    e.ficha_id,
    e.assinatura_id,
    f.assinado_em,
    e.tipo,
    e.status,
    e.dente
  into
    v_paciente_id,
    v_autor_id,
    v_ficha_id,
    v_assinatura_id,
    v_ficha_assinada_em,
    v_tipo,
    v_status,
    v_dente
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id and f.clinica_id = e.clinica_id
  where e.id = p_evento_id
    and e.clinica_id = v_clinica_id
  for update of e;

  if v_paciente_id is null then
    raise exception 'registro_nao_encontrado';
  end if;

  if v_caller <> v_autor_id then
    raise exception 'sem_permissao';
  end if;

  if v_assinatura_id is not null or v_ficha_assinada_em is not null then
    raise exception 'registro_bloqueado';
  end if;

  if exists (
    select 1
    from public.orcamento_eventos oe
    where oe.evento_id = p_evento_id
      and oe.clinica_id = v_clinica_id
  ) then
    raise exception 'registro_orcado';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller
    and d.clinica_id = v_clinica_id;

  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  delete from public.odontograma_eventos
  where id = p_evento_id
    and clinica_id = v_clinica_id;

  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id,
    v_caller,
    v_actor_nome,
    v_paciente_id,
    'odontograma_evento',
    p_evento_id::text,
    'odontograma_evento.excluido',
    jsonb_strip_nulls(jsonb_build_object(
      'ficha_id', v_ficha_id,
      'tipo', v_tipo,
      'status', v_status,
      'dente', v_dente
    ))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.preencher_detalhe_encaminhado(p_evento_id uuid, p_detalhe jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := get_my_clinica_id();
  v_caller     uuid := get_my_dentista_id();
  v_role       text := get_my_role();
  v_tipo       text;
  v_paciente_id uuid;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') then
    raise exception 'sem_permissao';
  end if;

  select e.tipo, e.paciente_id into v_tipo, v_paciente_id
  from public.odontograma_eventos e
  left join public.fichas f on f.id = e.ficha_id
  where e.id = p_evento_id
    and e.clinica_id = v_clinica_id
    and e.encaminhado_para = v_caller
    and f.assinado_em is null;

  if v_tipo is null then
    raise exception 'sem_permissao';
  end if;
  if v_tipo not in ('endodontia', 'implante') then
    raise exception 'tipo_nao_suportado';
  end if;

  select d.nome into v_actor_nome
  from public.dentistas d
  where d.id = v_caller and d.clinica_id = v_clinica_id;

  if v_actor_nome is null then
    raise exception 'sem_permissao';
  end if;

  update public.odontograma_eventos
     set detalhe = p_detalhe
   where id = p_evento_id
     and clinica_id = v_clinica_id;

  insert into public.activity_logs (
    clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata
  ) values (
    v_clinica_id,
    v_caller,
    v_actor_nome,
    v_paciente_id,
    'odontograma_evento',
    p_evento_id::text,
    'odontograma_evento.detalhe_alterado',
    jsonb_build_object('tipo', v_tipo)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.retirar_evento_ficha_orcamento(p_evento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_clinica_id uuid := public.get_my_clinica_id();
  v_caller uuid := public.get_my_dentista_id();
  v_role text := public.get_my_role();
  v_evento public.odontograma_eventos%rowtype;
  v_ficha_assinada timestamptz;
  v_actor_nome text;
begin
  if v_role not in ('admin', 'dentista') or v_caller is null then raise exception 'sem_permissao'; end if;
  -- Todas as mutações da ficha tomam o lock da ficha antes do evento. Isso evita
  -- ciclo com adicionar/assinar/renomear, que já usam Ficha -> Evento.
  select e.* into v_evento from public.odontograma_eventos e where e.id = p_evento_id and e.clinica_id = v_clinica_id;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  select assinado_em into v_ficha_assinada from public.fichas where id = v_evento.ficha_id and clinica_id = v_clinica_id for update;
  select e.* into v_evento from public.odontograma_eventos e where e.id = p_evento_id and e.clinica_id = v_clinica_id and e.ficha_id = v_evento.ficha_id for update;
  if not found then raise exception 'registro_nao_encontrado'; end if;
  if v_caller is distinct from v_evento.dentista_id or v_evento.assinatura_id is not null or v_ficha_assinada is not null then raise exception 'registro_bloqueado'; end if;
  if v_evento.retirado_em is not null then return; end if;
  select nome into v_actor_nome from public.dentistas where id = v_caller and clinica_id = v_clinica_id;
  if v_actor_nome is null then raise exception 'sem_permissao'; end if;
  update public.odontograma_eventos set retirado_em = now(), retirado_por = v_caller where id = p_evento_id and clinica_id = v_clinica_id;
  -- A ficha mantém os campos legados como projeção dos eventos ativos. A mesma
  -- derivação é usada pela inclusão incremental, na transação e sob o lock da ficha.
  with eventos as (
    select e.dente, e.status, row_number() over (order by e.created_at, e.id) as ordem,
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
          when 'exame_periodontal' then 'Exame periodontal' else 'Outro procedimento' end
      ) as rotulo
    from public.odontograma_eventos e
    where e.ficha_id = v_evento.ficha_id and e.clinica_id = v_clinica_id and e.retirado_em is null
  ), rotulos as (
    select rotulo, min(ordem) as ordem from eventos group by rotulo
  ), por_dente as (
    select dente, string_agg(case when observacao is not null and observacao <> rotulo
      then rotulo || ' (' || observacao || ')' else rotulo end, E'\n' order by ordem) as texto
    from eventos where dente is not null group by dente
  ), dentes as (
    select distinct dente from eventos where dente is not null
  )
  update public.fichas
  set dentes_afetados = array(select dente::integer from dentes order by dente)::integer[],
      dentes_observacoes = coalesce((select jsonb_object_agg(dente::text, texto) from por_dente), '{}'::jsonb),
      procedimentos = array(select rotulo from rotulos order by ordem),
      status = case when exists (select 1 from eventos where status = 'indicado') then 'aberta' else 'concluida' end,
      updated_at = now()
  where id = v_evento.ficha_id and clinica_id = v_clinica_id;
  insert into public.activity_logs(clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata)
  values (v_clinica_id, v_caller, v_actor_nome, v_evento.paciente_id, 'odontograma_evento', p_evento_id::text, 'odontograma_evento.retirado',
    jsonb_build_object('ficha_id', v_evento.ficha_id, 'evento_id', p_evento_id, 'procedimento_nome', coalesce(v_evento.procedimento_nome, v_evento.tipo), 'retirado_em', now()));
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_eventos_odontograma(p_ficha_id uuid, p_clinica_id uuid, p_paciente_id uuid, p_eventos jsonb, p_sincronizar boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_assinado_em timestamptz;
begin
  if jsonb_typeof(p_eventos) <> 'array' then
    raise exception 'eventos_invalidos';
  end if;

  select assinado_em into v_assinado_em
  from public.fichas
  where id = p_ficha_id
    and clinica_id = p_clinica_id
    and paciente_id = p_paciente_id
  for update;

  if not found then
    raise exception 'ficha_nao_encontrada';
  end if;
  if v_assinado_em is not null then
    raise exception 'ficha_assinada';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_eventos) e
    where nullif(e->>'id', '') is null
      or nullif(e->>'clinica_id', '')::uuid is distinct from p_clinica_id
      or nullif(e->>'paciente_id', '')::uuid is distinct from p_paciente_id
      or nullif(e->>'ficha_id', '')::uuid is distinct from p_ficha_id
  ) then
    raise exception 'evento_contexto_invalido';
  end if;

  if exists (
    select 1
    from public.odontograma_eventos existente
    where existente.id = any(array(
      select (e->>'id')::uuid
      from jsonb_array_elements(p_eventos) e
    ))
      and (
        (to_jsonb(existente)->>'retirado_em') is not null
        or existente.clinica_id is distinct from p_clinica_id
        or existente.paciente_id is distinct from p_paciente_id
        or existente.ficha_id is distinct from p_ficha_id
      )
  ) then
    raise exception 'evento_contexto_invalido';
  end if;

  -- O FK sozinho impediria ids inexistentes, mas nao impediria apontar para o catalogo
  -- de outra clinica. O guard multi-tenant ocorre antes de qualquer escrita.
  if exists (
    select 1
    from jsonb_array_elements(p_eventos) e
    where nullif(e->>'procedimento_id', '') is not null
      and not exists (
        select 1
        from public.procedimentos procedimento
        where procedimento.id = nullif(e->>'procedimento_id', '')::uuid
          and procedimento.clinica_id = p_clinica_id
      )
  ) then
    raise exception 'procedimento_catalogo_invalido';
  end if;

  -- Registro livre precisa continuar identificavel. Observacao e aceita como fallback
  -- apenas para os eventos legados que nasceram antes do snapshot R-140b.
  if exists (
    select 1
    from jsonb_array_elements(p_eventos) e
    where e->>'tipo' = 'outro'
      and coalesce(
        nullif(btrim(e->>'procedimento_nome'), ''),
        nullif(btrim(e->>'observacao'), '')
      ) is null
  ) then
    raise exception 'procedimento_nome_obrigatorio';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_eventos) e
    left join public.odontograma_eventos existente
      on existente.id = (e->>'id')::uuid
      and existente.clinica_id = p_clinica_id
    where e ? 'encaminhado_para'
      and nullif(e->>'encaminhado_para', '') is not null
      and (
        e->>'status' <> 'indicado'
        or nullif(e->>'encaminhado_para', '')::uuid = coalesce(
          existente.dentista_id,
          nullif(e->>'dentista_id', '')::uuid
        )
        or not exists (
          select 1
          from public.dentistas destino
          where destino.id = nullif(e->>'encaminhado_para', '')::uuid
            and destino.clinica_id = p_clinica_id
            and destino.ativo = true
            and destino.role in ('dentista', 'admin')
        )
      )
  ) then
    raise exception 'encaminhamento_invalido';
  end if;

  if p_sincronizar then
    delete from public.odontograma_eventos
    where ficha_id = p_ficha_id
      and clinica_id = p_clinica_id
      and (to_jsonb(odontograma_eventos)->>'retirado_em') is null
      and id not in (
        select (e->>'id')::uuid from jsonb_array_elements(p_eventos) e
      );
  end if;

  update public.odontograma_eventos evento
  set encaminhado_para = nullif(payload.e->>'encaminhado_para', '')::uuid
  from jsonb_array_elements(p_eventos) as payload(e)
  where evento.id = any(array(
    select (ids.e->>'id')::uuid
    from jsonb_array_elements(p_eventos) as ids(e)
    where ids.e ? 'encaminhado_para'
  ))
    and evento.id = (payload.e->>'id')::uuid
    and evento.clinica_id = p_clinica_id
    and evento.paciente_id = p_paciente_id
    and evento.ficha_id = p_ficha_id
    and payload.e ? 'encaminhado_para';

  insert into public.odontograma_eventos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status,
    origem, nivel, arcada, quadrante, dente, faces, papel_no_grupo, observacao,
    detalhe, realizado_em, momento_planejado, encaminhado_para,
    procedimento_id, procedimento_nome
  )
  select
    (e->>'id')::uuid,
    (e->>'clinica_id')::uuid,
    (e->>'paciente_id')::uuid,
    (e->>'dentista_id')::uuid,
    (e->>'ficha_id')::uuid,
    nullif(e->>'grupo_id', '')::uuid,
    e->>'tipo',
    e->>'status',
    e->>'origem',
    e->>'nivel',
    nullif(e->>'arcada', ''),
    nullif(e->>'quadrante', '')::smallint,
    nullif(e->>'dente', '')::smallint,
    coalesce((select array_agg(x) from jsonb_array_elements_text(e->'faces') x), '{}'),
    nullif(e->>'papel_no_grupo', ''),
    nullif(e->>'observacao', ''),
    e->'detalhe',
    nullif(e->>'realizado_em', '')::date,
    coalesce(nullif(e->>'momento_planejado', ''), 'sessao_atual'),
    nullif(e->>'encaminhado_para', '')::uuid,
    nullif(e->>'procedimento_id', '')::uuid,
    nullif(btrim(e->>'procedimento_nome'), '')
  from jsonb_array_elements(p_eventos) e
  on conflict (id) do update set
    grupo_id = excluded.grupo_id,
    tipo = excluded.tipo,
    status = excluded.status,
    origem = excluded.origem,
    nivel = excluded.nivel,
    arcada = excluded.arcada,
    quadrante = excluded.quadrante,
    dente = excluded.dente,
    faces = excluded.faces,
    papel_no_grupo = excluded.papel_no_grupo,
    observacao = excluded.observacao,
    detalhe = excluded.detalhe,
    realizado_em = excluded.realizado_em,
    momento_planejado = excluded.momento_planejado,
    -- Payloads antigos nao conhecem os campos novos: preservam o snapshot. O app novo
    -- sempre envia procedimento_nome quando quer trocar catalogo ou usar texto livre.
    procedimento_id = case
      when excluded.procedimento_nome is not null then excluded.procedimento_id
      else public.odontograma_eventos.procedimento_id
    end,
    procedimento_nome = coalesce(
      excluded.procedimento_nome,
      public.odontograma_eventos.procedimento_nome
    )
  where public.odontograma_eventos.clinica_id = p_clinica_id
    and public.odontograma_eventos.paciente_id = p_paciente_id
    and public.odontograma_eventos.ficha_id = p_ficha_id;
end;
$function$;

drop function public.travado_pela_assinatura_da_ficha(uuid,timestamptz);
notify pgrst, 'reload schema';
commit;
