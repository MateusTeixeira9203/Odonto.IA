-- R-181: todo vínculo ativo possui uma configuração de capabilities versionada.
-- A linha nasce sem concessões; propriedade e capabilities continuam sendo
-- verificadas pelos guards de cada domínio.

set local lock_timeout = '1500ms';
set local statement_timeout = '15s';

insert into public.clinica_acessos (clinica_id, membro_id)
select cu.clinica_id, cu.id
from public.clinica_usuarios cu
where cu.status = 'ativo'
on conflict (clinica_id, membro_id) do nothing;

create or replace function private.r181_provisionar_acessos_membro()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status = 'ativo' then
    insert into public.clinica_acessos (clinica_id, membro_id)
    values (new.clinica_id, new.id)
    on conflict (clinica_id, membro_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists r181_provisionar_acessos_membro on public.clinica_usuarios;
create trigger r181_provisionar_acessos_membro
after insert or update of status on public.clinica_usuarios
for each row execute function private.r181_provisionar_acessos_membro();

revoke all on function private.r181_provisionar_acessos_membro()
  from public, anon, authenticated, service_role;
