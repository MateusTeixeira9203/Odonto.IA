drop function if exists public.salvar_eventos_odontograma(uuid, uuid, uuid, jsonb);

create function public.salvar_eventos_odontograma(
  p_ficha_id    uuid,
  p_clinica_id  uuid,
  p_paciente_id uuid,
  p_eventos     jsonb,
  p_sincronizar boolean default true
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assinado_em timestamptz;
begin
  select assinado_em into v_assinado_em
  from public.fichas
  where id = p_ficha_id and clinica_id = p_clinica_id and paciente_id = p_paciente_id
  for update;

  if not found then
    raise exception 'ficha_nao_encontrada';
  end if;

  if v_assinado_em is not null then
    raise exception 'ficha_assinada';
  end if;

  -- R-108b - so quando quem chama e dono do conteudo inteiro da ficha.
  if p_sincronizar then
    delete from public.odontograma_eventos
    where ficha_id = p_ficha_id and clinica_id = p_clinica_id
      and id not in (select (e->>'id')::uuid from jsonb_array_elements(p_eventos) e);
  end if;

  insert into public.odontograma_eventos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status,
    origem, nivel, arcada, quadrante, dente, faces, papel_no_grupo, observacao,
    detalhe, realizado_em, momento_planejado
  )
  select
    (e->>'id')::uuid, (e->>'clinica_id')::uuid, (e->>'paciente_id')::uuid,
    (e->>'dentista_id')::uuid, (e->>'ficha_id')::uuid,
    nullif(e->>'grupo_id', '')::uuid, e->>'tipo', e->>'status', e->>'origem', e->>'nivel',
    nullif(e->>'arcada', ''), nullif(e->>'quadrante', '')::smallint,
    nullif(e->>'dente', '')::smallint,
    coalesce((select array_agg(x) from jsonb_array_elements_text(e->'faces') x), '{}'),
    nullif(e->>'papel_no_grupo', ''), nullif(e->>'observacao', ''), e->'detalhe',
    nullif(e->>'realizado_em', '')::date,
    coalesce(nullif(e->>'momento_planejado', ''), 'sessao_atual')
  from jsonb_array_elements(p_eventos) e
  on conflict (id) do update set
    grupo_id = excluded.grupo_id, tipo = excluded.tipo, status = excluded.status,
    origem = excluded.origem, nivel = excluded.nivel, arcada = excluded.arcada,
    quadrante = excluded.quadrante, dente = excluded.dente, faces = excluded.faces,
    papel_no_grupo = excluded.papel_no_grupo, observacao = excluded.observacao,
    detalhe = excluded.detalhe, realizado_em = excluded.realizado_em,
    momento_planejado = excluded.momento_planejado;
end;
$$;

comment on function public.salvar_eventos_odontograma is
  'Upsert atomico do event-log do odontograma por id estavel (R-01/107). R-101 (137) somou
   momento_planejado. R-108b (142) soma p_sincronizar: false = upsert puro, pra quando o
   payload e SUBCONJUNTO da ficha (pendencia concluida numa ficha que ja existe) -- sem isso o
   delete levaria junto o resto do plano de tratamento. ficha_id continua FORA do on conflict:
   evento nunca muda de ficha por aqui (R-108b 2, pendencia volta pra ficha onde nasceu).';

revoke execute on function public.salvar_eventos_odontograma(uuid, uuid, uuid, jsonb, boolean) from anon, public;
grant  execute on function public.salvar_eventos_odontograma(uuid, uuid, uuid, jsonb, boolean) to authenticated;