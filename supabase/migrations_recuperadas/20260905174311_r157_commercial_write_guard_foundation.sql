-- R-157 — base privada do guard comercial.
-- Não cria policies: enforcement_enabled sem linha/configuração é sempre false.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.commercial_write_allowed(p_clinica_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if not coalesce((
    select enforcement_enabled
    from public.billing_runtime_config
    where id = true
  ), false) then
    return true;
  end if;

  if v_user_id is null then
    return false;
  end if;

  select cu.role into v_role
  from public.clinica_usuarios cu
  where cu.usuario_id = v_user_id
    and cu.clinica_id = p_clinica_id
    and cu.status = 'ativo';
  if v_role is null then
    return false;
  end if;
  if v_role not in ('admin', 'dentista') then
    return true;
  end if;

  if exists (
    select 1
    from public.billing_access_overrides o
    where o.clinica_id = p_clinica_id
      and (o.usuario_id is null or o.usuario_id = v_user_id)
      and (o.active_until is null or o.active_until > now())
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.assinaturas_dentista a
    where a.clinica_id = p_clinica_id
      and a.usuario_id = v_user_id
      and (
        a.status in ('trialing', 'active')
        or (a.status = 'past_due' and a.grace_ends_at > now())
      )
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.formacoes_clinica f
    join public.assinaturas_dentista a on a.formacao_id = f.id
    where f.clinica_id = p_clinica_id
      and a.usuario_id = v_user_id
      and f.status in ('aguardando_equipe', 'coletando_pagamento', 'ativando', 'ativa')
      and f.expires_at > now()
  );
end;
$$;

revoke all on function private.commercial_write_allowed(uuid) from public, anon;
grant execute on function private.commercial_write_allowed(uuid) to authenticated;