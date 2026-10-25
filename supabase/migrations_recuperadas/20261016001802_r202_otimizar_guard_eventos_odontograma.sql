CREATE OR REPLACE FUNCTION public.salvar_eventos_odontograma(p_ficha_id uuid, p_clinica_id uuid, p_paciente_id uuid, p_eventos jsonb, p_sincronizar boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
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
