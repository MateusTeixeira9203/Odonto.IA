-- =====================================================================
-- 104 — odontograma_eventos: invariante #14 de verdade + retry atômico
--
-- Origem: auditoria typescript-reviewer sobre o Bloco 0 (dívidas da Fatia A,
-- sessão 19/07 noite) sobre `regravarEventosOdontograma` (novo — retry do
-- fail-soft do event-log). Dois achados HIGH:
--
-- 1) A tabela 101 já DIZ em comentário "ficha assinada congela seus eventos
--    (invariante #14)", mas a RLS write policy NUNCA checou isso — é só texto.
--    `regravarEventosOdontograma` é a primeira action que escreve em eventos
--    de uma ficha JÁ EXISTENTE (o insert original só roda em ficha recém-criada,
--    que por definição não está assinada), então é a primeira vez que essa
--    lacuna vira exploravel de verdade. Fix: a policy passa a checar de fato.
--
-- 2) delete+insert do retry são 2 chamadas HTTP separadas, sem lock — duas
--    invocações concorrentes na MESMA ficha duplicam os eventos (cada uma vê
--    "sucesso"). Fix: RPC única que faz lock da ficha (FOR UPDATE) + delete +
--    insert no MESMO statement de função — atômico e serializado por ficha.
--    security invoker: a RLS continua valendo pro caller, isto não é bypass,
--    é atomicidade + o guard de assinatura reforçado uma segunda vez (defesa
--    em profundidade) dentro da própria função.
-- =====================================================================

begin;

-- ── 1) RLS: invariante #14 de verdade ──────────────────────────────────
-- ficha_id nulo (evento órfão, on delete set null) não tem ficha pra checar —
-- passa livre, igual comportamento de hoje. Ficha existente e assinada trava.
drop policy if exists "odontograma_eventos_write_own" on public.odontograma_eventos;
create policy "odontograma_eventos_write_own" on public.odontograma_eventos for all
  using (
    belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id()
    and not exists (
      select 1 from public.fichas f
      where f.id = odontograma_eventos.ficha_id and f.assinado_em is not null
    )
  )
  with check (
    belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id()
    and not exists (
      select 1 from public.fichas f
      where f.id = odontograma_eventos.ficha_id and f.assinado_em is not null
    )
  );

-- ── 2) RPC atômica pro retry ────────────────────────────────────────────
-- p_eventos = linhas JÁ ACHATADAS no formato de `odontograma_eventos` (o mesmo
-- shape que `montarRowsEventos` monta em actions.ts — clinica_id/paciente_id/
-- dentista_id/ficha_id já embutidos por linha, arcada/quadrante/dente/faces no
-- topo, não aninhados). p_clinica_id/p_paciente_id são só pro lock da ficha.
create or replace function public.regravar_odontograma_eventos(
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
  -- Lock da linha da ficha: serializa retries concorrentes na MESMA ficha —
  -- o segundo só prossegue depois que o primeiro commitou (e aí vê o estado
  -- final, não duplica). RLS de fichas (núcleo clínico) continua valendo.
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

  delete from public.odontograma_eventos
  where ficha_id = p_ficha_id and clinica_id = p_clinica_id;

  insert into public.odontograma_eventos (
    clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status,
    origem, nivel, arcada, quadrante, dente, faces, papel_no_grupo,
    observacao, realizado_em
  )
  select
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
    nullif(e->>'realizado_em', '')::date
  from jsonb_array_elements(p_eventos) e;
end;
$$;

comment on function public.regravar_odontograma_eventos is
  'Retry atômico do event-log do odontograma (fail-soft, Bloco 0 19/07). Lock da
   ficha + delete + insert no mesmo statement — serializa concorrência e reforça
   a invariante #14 (ficha assinada é imutável) inteiramente sob RLS do caller.';

revoke execute on function public.regravar_odontograma_eventos(uuid, uuid, uuid, jsonb) from anon, public;
grant  execute on function public.regravar_odontograma_eventos(uuid, uuid, uuid, jsonb) to authenticated;

commit;
