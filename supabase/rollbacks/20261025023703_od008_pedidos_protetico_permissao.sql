-- OD-008: VOLTA SEGURA da migration 20261025023703, sem restaurar a policy ALL.
-- A equipe mantem escrita; o protetico mantem leitura, mas nao marca Entregue.
-- Nenhum dado e alterado. Reaplicar a ida restaura somente pendente -> entregue.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = public;

do $preflight$
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'pedidos_protetico') <> 4
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_protetico'
       and policyname not in ('pedidos_protetico_select','pedidos_protetico_insert',
                             'pedidos_protetico_update','pedidos_protetico_delete')) then
    raise exception 'OD-008: volta exige as quatro policies da ida; revisar o estado antes de continuar.';
  end if;
end;
$preflight$;

-- Restringir UPDATE antes de retirar a trava, na mesma transacao.
alter policy pedidos_protetico_update on public.pedidos_protetico
  using (public.belongs_to_active_clinic(clinica_id) and public.get_my_role() <> 'protetico')
  with check (public.belongs_to_active_clinic(clinica_id) and public.get_my_role() <> 'protetico');

drop trigger if exists pedidos_protetico_trava_protetico on public.pedidos_protetico;
drop function if exists public.pedidos_protetico_trava_protetico();
-- SELECT, INSERT e DELETE permanecem exatamente como na ida.
commit;
