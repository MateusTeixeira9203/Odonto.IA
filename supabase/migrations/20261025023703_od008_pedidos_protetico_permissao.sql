-- OD-008. Fonte: catalogo EFETIVO do odonto-qa, 2026-10-25T02:32:14Z.
-- Evidencia: vault Projetos/Odonto-IA/log/OD-008-qa-catalogo-efetivo-2026-10-24.json.
-- Somente DDL; nenhum pedido e regravado. Aplicacao remota depende da janela aprovada.
-- Reaplicavel depois da volta segura correspondente.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = public;

do $preflight$
declare
  colunas text[];
  quantidade integer;
  expressao constant text := '(belongs_to_active_clinic(clinica_id) AND ((protetico_id = get_my_dentista_id()) OR (get_my_role() <> ''protetico''::text)))';
begin
  if not exists (select 1 from pg_class where oid = 'public.pedidos_protetico'::regclass and relrowsecurity) then
    raise exception 'OD-008: pedidos_protetico precisa estar com RLS habilitada.';
  end if;
  select array_agg(attname::text order by attnum) into colunas
  from pg_attribute where attrelid = 'public.pedidos_protetico'::regclass
    and attnum > 0 and not attisdropped;
  if colunas is distinct from array['id','clinica_id','protetico_id','dentista_id','paciente_id',
      'agendamento_id','observacao','data_entrega','status','entregue_em','created_at','updated_at'] then
    raise exception 'OD-008: colunas divergiram do catalogo revisado; revisar a trava antes de aplicar.';
  end if;
  select count(*) into quantidade from pg_policies
  where schemaname = 'public' and tablename = 'pedidos_protetico';
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_protetico'
      and policyname = 'pedidos_protetico_access') then
    if quantidade <> 1 or exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_protetico'
        and policyname = 'pedidos_protetico_access'
        and (cmd <> 'ALL' or permissive <> 'PERMISSIVE' or roles::text[] <> array['authenticated']
          or qual is distinct from expressao or with_check is distinct from expressao)
    ) then
      raise exception 'OD-008: policy de origem divergiu da definicao efetiva salva.';
    end if;
  elsif quantidade <> 4 or exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_protetico'
      and policyname not in ('pedidos_protetico_select','pedidos_protetico_insert',
                            'pedidos_protetico_update','pedidos_protetico_delete')
  ) then
    raise exception 'OD-008: conjunto de policies inesperado; nada foi substituido.';
  end if;
end;
$preflight$;

drop policy if exists pedidos_protetico_access on public.pedidos_protetico;
drop policy if exists pedidos_protetico_select on public.pedidos_protetico;
drop policy if exists pedidos_protetico_insert on public.pedidos_protetico;
drop policy if exists pedidos_protetico_update on public.pedidos_protetico;
drop policy if exists pedidos_protetico_delete on public.pedidos_protetico;

create policy pedidos_protetico_select on public.pedidos_protetico
  for select to authenticated
  using (public.belongs_to_active_clinic(clinica_id)
    and (protetico_id = public.get_my_dentista_id() or public.get_my_role() <> 'protetico'));

create policy pedidos_protetico_insert on public.pedidos_protetico
  for insert to authenticated
  with check (public.belongs_to_active_clinic(clinica_id) and public.get_my_role() <> 'protetico');

create policy pedidos_protetico_update on public.pedidos_protetico
  for update to authenticated
  using (public.belongs_to_active_clinic(clinica_id)
    and (protetico_id = public.get_my_dentista_id() or public.get_my_role() <> 'protetico'))
  with check (public.belongs_to_active_clinic(clinica_id)
    and (protetico_id = public.get_my_dentista_id() or public.get_my_role() <> 'protetico'));

create policy pedidos_protetico_delete on public.pedidos_protetico
  for delete to authenticated
  using (public.belongs_to_active_clinic(clinica_id) and public.get_my_role() <> 'protetico');

create or replace function public.pedidos_protetico_trava_protetico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if public.get_my_role() is distinct from 'protetico' then
    return new;
  end if;
  if old.status is distinct from 'pendente' or new.status is distinct from 'entregue' then
    raise exception 'O protético só pode marcar um pedido pendente como entregue.' using errcode = '42501';
  end if;
  -- ID tambem e imutavel: permitir trocar a chave nao seria "somente marcar entregue".
  -- updated_at e mantido pelo trigger EFETIVO pedidos_protetico_updated_at, executado depois.
  if (new.id, new.clinica_id, new.protetico_id, new.dentista_id, new.paciente_id,
      new.agendamento_id, new.observacao, new.data_entrega, new.created_at)
     is distinct from
     (old.id, old.clinica_id, old.protetico_id, old.dentista_id, old.paciente_id,
      old.agendamento_id, old.observacao, old.data_entrega, old.created_at) then
    raise exception 'O protético só pode marcar um pedido pendente como entregue.' using errcode = '42501';
  end if;
  new.entregue_em := now();
  return new;
end;
$function$;

revoke all on function public.pedidos_protetico_trava_protetico() from public, anon;

drop trigger if exists pedidos_protetico_trava_protetico on public.pedidos_protetico;
create trigger pedidos_protetico_trava_protetico
  before update on public.pedidos_protetico
  for each row execute function public.pedidos_protetico_trava_protetico();

commit;
