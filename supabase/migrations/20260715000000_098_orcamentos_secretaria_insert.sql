-- Libera secretária para criar orçamentos (INSERT em orcamentos + orcamento_itens) e
-- para cadastrar procedimentos novos no catálogo (INSERT em procedimentos), sempre em
-- nome de um dentista real, ativo, não-secretária, da mesma clínica. Também fecha um
-- gap: a policy de orcamento_itens_insert_own exigia o.dentista_id = get_my_dentista_id(),
-- o que bloquearia os itens mesmo depois de liberar o orçamento em si.
--
-- spec: plans/specs/2026-07-15-secretaria-cria-orcamento-spec.md

create or replace function public.can_act_as_dentista(target_dentista_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select target_dentista_id = public.get_my_dentista_id()
    or (
      public.get_my_role() = 'secretaria'
      and exists (
        select 1 from public.dentistas d
        where d.id = target_dentista_id
          and d.clinica_id = public.get_my_clinica_id()
          and d.ativo = true
          and d.role <> 'secretaria'
      )
    )
$$;

revoke execute on function public.can_act_as_dentista(uuid) from public;
grant execute on function public.can_act_as_dentista(uuid) to authenticated;

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own" on public.orcamentos for insert
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));

drop policy if exists "orcamento_itens_insert_own" on public.orcamento_itens;
create policy "orcamento_itens_insert_own" on public.orcamento_itens for insert
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o
    where o.id = orcamento_itens.orcamento_id
      and can_act_as_dentista(o.dentista_id)
  ));

-- procedimentos_write_own (FOR ALL, já existente) não é tocada — permanece exigindo
-- is_clinic_dentista() no with check, o que preserva UPDATE/DELETE restrito ao próprio
-- dentista. Em vez de afrouxar essa policy combinada, uma policy adicional só de INSERT
-- libera a secretária, sem mexer em superfície de update/delete.
drop policy if exists "procedimentos_insert_secretaria" on public.procedimentos;
create policy "procedimentos_insert_secretaria" on public.procedimentos for insert
  with check (belongs_to_active_clinic(clinica_id) and can_act_as_dentista(dentista_id));
