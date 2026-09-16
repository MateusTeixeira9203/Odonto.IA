-- R165: o cadastro comercial só pode ser aberto explicitamente no piloto.
-- A configuração nasce fechada; a habilitação é feita pelo operador no banco do Free.
create table private.r165_piloto_onboarding (
  singleton boolean primary key default true check (singleton),
  habilitado boolean not null default false
);

insert into private.r165_piloto_onboarding (singleton, habilitado)
values (true, false);

revoke all on table private.r165_piloto_onboarding from public, anon, authenticated;

create function private.r165_piloto_onboarding_habilitado()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce((select habilitado from private.r165_piloto_onboarding where singleton), false);
$$;

-- Mantém o corpo transacional R165 privado e expõe somente o envelope que verifica
-- a configuração local. Assim, o gate do navegador não é a única proteção.
alter function public.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text)
  set schema private;

revoke all on function private.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text)
  from public, anon, authenticated;

create function public.iniciar_onboarding_r165(
  p_modalidade text,
  p_modelo_clinica text,
  p_atua_clinicamente boolean,
  p_nome_clinica text,
  p_nome_usuario text,
  p_cro text default null,
  p_especialidades text[] default '{}',
  p_telefone text default null,
  p_cidade text default null,
  p_estado text default null,
  p_foco_principal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.r165_piloto_onboarding_habilitado() then
    raise exception 'R165_PILOTO_DESABILITADO: cadastro comercial não está disponível neste ambiente'
      using errcode = 'P0403';
  end if;
  return private.iniciar_onboarding_r165(
    p_modalidade, p_modelo_clinica, p_atua_clinicamente, p_nome_clinica, p_nome_usuario,
    p_cro, p_especialidades, p_telefone, p_cidade, p_estado, p_foco_principal
  );
end;
$$;

revoke all on function private.r165_piloto_onboarding_habilitado() from public, anon, authenticated;
revoke all on function public.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text)
  from public, anon;
grant execute on function public.iniciar_onboarding_r165(text, text, boolean, text, text, text, text[], text, text, text, text)
  to authenticated;
