begin;
set local lock_timeout = '5s';

-- R169 lote 3: retirada é um estado histórico. A função abaixo nunca o limpa;
-- repetir um lote contra evento retirado devolve conflito, sem reativá-lo.
alter table public.odontograma_eventos
  add column if not exists retirado_em timestamptz,
  add column if not exists retirado_por uuid references public.dentistas(id) on delete set null,
  add column if not exists captura_id uuid;

create function public.adicionar_procedimentos_ficha(
  p_ficha_id uuid,
  p_paciente_id uuid,
  p_captura_id uuid,
  p_eventos jsonb
) returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
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
  if v_ficha.dentista_id is distinct from v_caller then
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
$$;

revoke all on function public.adicionar_procedimentos_ficha(uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.adicionar_procedimentos_ficha(uuid, uuid, uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
