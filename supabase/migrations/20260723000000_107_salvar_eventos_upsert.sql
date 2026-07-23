-- =====================================================================
-- 107 — odontograma_eventos: upsert por id (R-01, Fatia 1)
--
-- Spec: plans/specs/R-01-registro-unidade-salvamento.md §7
--
-- Substitui `regravar_odontograma_eventos` (migration 104): aquela função fazia
-- delete-e-reinsere a cada save — todo registro nascia com id novo a cada
-- gravação, e nada conseguia se referir a um registro específico (grupo/timeline,
-- encaminhamento, assinatura por procedimento — R-02/R-03/R-04 dependem disso).
--
-- Corrige de quebra um bug real, achado ao vivo em 22/07: a 104 nunca incluiu
-- `detalhe` na lista de colunas do insert (a coluna só existe desde a 106, 2 dias
-- depois — nenhuma migration atualizou a 104 pra usá-la). Toda tabela de endo/
-- implante salva desde então foi descartada em silêncio, sem erro. Confirmado
-- em produção: 4 de 4 eventos de endo/implante com `detalhe` nulo.
--
-- Contrato: upsert por id. Registro que saiu do rascunho é apagado (por
-- exclusão de id, não por dente/tipo); os demais são atualizados no lugar,
-- mantendo o id. `encaminhado_para` fica de fora (R-04, aditivo depois).
-- =====================================================================

begin;

create or replace function public.salvar_eventos_odontograma(
  p_ficha_id    uuid,
  p_clinica_id  uuid,
  p_paciente_id uuid,
  p_eventos     jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assinado_em timestamptz;
begin
  -- Lock da linha da ficha: mesma serialização da 104 — segunda chamada concorrente
  -- na MESMA ficha só prossegue depois que a primeira commitou.
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

  -- 1) some só o que saiu do rascunho — por id, nunca por dente/tipo
  delete from public.odontograma_eventos
  where ficha_id = p_ficha_id and clinica_id = p_clinica_id
    and id not in (select (e->>'id')::uuid from jsonb_array_elements(p_eventos) e);

  -- 2) upsert por id — o registro mantém a identidade entre saves
  insert into public.odontograma_eventos (
    id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status,
    origem, nivel, arcada, quadrante, dente, faces, papel_no_grupo, observacao,
    detalhe, realizado_em
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
    nullif(e->>'realizado_em', '')::date
  from jsonb_array_elements(p_eventos) e
  on conflict (id) do update set
    grupo_id       = excluded.grupo_id,
    tipo           = excluded.tipo,
    status         = excluded.status,
    origem         = excluded.origem,
    nivel          = excluded.nivel,
    arcada         = excluded.arcada,
    quadrante      = excluded.quadrante,
    dente          = excluded.dente,
    faces          = excluded.faces,
    papel_no_grupo = excluded.papel_no_grupo,
    observacao     = excluded.observacao,
    detalhe        = excluded.detalhe,
    realizado_em   = excluded.realizado_em;
end;
$$;

comment on function public.salvar_eventos_odontograma is
  'Upsert atomico do event-log do odontograma por id estavel (R-01). Substitui
   regravar_odontograma_eventos (104) — nao apaga+recria tudo, so remove o que
   saiu do rascunho e atualiza o resto no lugar. Lock da ficha reforca a
   invariante #14 (ficha assinada e imutavel) sob RLS do caller.';

revoke execute on function public.salvar_eventos_odontograma(uuid, uuid, uuid, jsonb) from anon, public;
grant  execute on function public.salvar_eventos_odontograma(uuid, uuid, uuid, jsonb) to authenticated;

-- A função antiga fica obsoleta e enganosa (descartava `detalhe` em silêncio) —
-- nenhum caller usa mais, a action foi trocada no mesmo commit.
drop function if exists public.regravar_odontograma_eventos(uuid, uuid, uuid, jsonb);

commit;
