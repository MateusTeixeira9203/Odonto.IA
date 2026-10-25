-- R-181: proprietário conserva acesso total; gestor depende das capabilities delegadas.
-- Recompila o helper consumido pelas RPCs financeiras do R-177 para remover o bypass por cargo.

set local lock_timeout = '1500ms';
set local statement_timeout = '10s';

create or replace function private.r177_tem_permissao_financeira_clinica(
  p_clinica_id uuid,
  p_ator_id uuid,
  p_permissao text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinica_vinculos_governanca v
    join public.clinica_usuarios m on m.id = v.membro_id
    where v.clinica_id = p_clinica_id
      and m.clinica_id = p_clinica_id
      and m.usuario_id = p_ator_id
      and m.status = 'ativo'
      and v.estado = 'ativo'
      and v.papel = 'proprietario'
  ) or exists (
    select 1
    from public.clinica_usuarios m
    join public.clinica_acessos a
      on a.clinica_id = m.clinica_id
      and a.membro_id = m.id
    cross join lateral jsonb_array_elements(a.acessos) acesso
    where m.clinica_id = p_clinica_id
      and m.usuario_id = p_ator_id
      and m.status = 'ativo'
      and acesso ->> 'permissao' = p_permissao
      and acesso -> 'escopo' ->> 'tipo' = 'clinica'
  );
$$;

revoke all on function private.r177_tem_permissao_financeira_clinica(uuid, uuid, text)
  from public, anon, authenticated, service_role;
