-- R-157: fecha o caminho legado que ainda conseguia criar um plano global após
-- salvar grupos. A guarda e prospectiva: grupos/planos históricos não são convertidos.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create or replace function private.r157_bloquear_acordo_global_com_grupo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Permite manutenção não financeira de registros legados e a remoção gradual
  -- dos campos globais. Só bloqueia a criação/alteração de um acordo global.
  if not (
    (new.valor_acordado is not null and new.valor_acordado is distinct from old.valor_acordado)
    or (new.plano_forma is not null and new.plano_forma is distinct from old.plano_forma)
    or (coalesce(new.desconto, 0) > 0 and new.desconto is distinct from old.desconto)
  ) then
    return new;
  end if;

  if exists (
    select 1
      from public.orcamento_itens oi
     where oi.orcamento_id = new.id
       and oi.clinica_id = new.clinica_id
       and oi.composicao is not null
       and oi.retirado_em is null
  ) then
    raise exception 'grupo_orcamento_negociado';
  end if;

  return new;
end;
$$;

create or replace function private.r157_bloquear_grupo_em_orcamento_global()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
begin
  if new.composicao is null
     or (tg_op = 'UPDATE'
         and old.composicao is not distinct from new.composicao
         and not (old.retirado_em is not null and new.retirado_em is null)) then
    return new;
  end if;

  -- A mesma linha é travada pelos RPCs de plano e pela guarda de pagamento. Isso
  -- serializa inserir grupo versus negociar/cobrar sem abrir exceção entre checagem
  -- e escrita.
  select o.* into v_orcamento
    from public.orcamentos o
   where o.id = new.orcamento_id
     and o.clinica_id = new.clinica_id
   for update;

  if v_orcamento.id is null then
    raise exception 'orcamento_nao_encontrado';
  end if;

  if v_orcamento.valor_acordado is not null
     or v_orcamento.plano_forma is not null
     or coalesce(v_orcamento.desconto, 0) > 0
     or exists (
       select 1
         from public.pagamentos p
        where p.orcamento_id = v_orcamento.id
          and p.clinica_id = v_orcamento.clinica_id
          and p.cobranca_id is null
     ) then
    raise exception 'grupo_orcamento_negociado';
  end if;

  return new;
end;
$$;

create or replace function private.r157_bloquear_pagamento_global_com_grupo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
begin
  -- UPDATE só interessa quando uma cobrança por etapa vira cobrança global. Um
  -- pagamento global histórico continua corrigível/estornável sem ser reescrito.
  if new.orcamento_id is null
     or new.cobranca_id is not null
     or (tg_op = 'UPDATE' and old.cobranca_id is null) then
    return new;
  end if;

  select o.* into v_orcamento
    from public.orcamentos o
   where o.id = new.orcamento_id
     and o.clinica_id = new.clinica_id
   for update;

  if v_orcamento.id is null then
    return new;
  end if;

  if exists (
    select 1
      from public.orcamento_itens oi
     where oi.orcamento_id = v_orcamento.id
       and oi.clinica_id = v_orcamento.clinica_id
       and oi.composicao is not null
       and oi.retirado_em is null
  ) then
    raise exception 'grupo_orcamento_negociado';
  end if;

  return new;
end;
$$;

drop trigger if exists r157_guard_acordo_global_com_grupo on public.orcamentos;
create trigger r157_guard_acordo_global_com_grupo
before update of valor_acordado, plano_forma, desconto on public.orcamentos
for each row execute function private.r157_bloquear_acordo_global_com_grupo();

drop trigger if exists r157_guard_grupo_em_orcamento_global on public.orcamento_itens;
create trigger r157_guard_grupo_em_orcamento_global
before insert or update of composicao, retirado_em on public.orcamento_itens
for each row execute function private.r157_bloquear_grupo_em_orcamento_global();

drop trigger if exists r157_guard_pagamento_global_com_grupo on public.pagamentos;
create trigger r157_guard_pagamento_global_com_grupo
before insert or update of cobranca_id on public.pagamentos
for each row execute function private.r157_bloquear_pagamento_global_com_grupo();

revoke all on function private.r157_bloquear_acordo_global_com_grupo() from public, anon, authenticated;
revoke all on function private.r157_bloquear_grupo_em_orcamento_global() from public, anon, authenticated;
revoke all on function private.r157_bloquear_pagamento_global_com_grupo() from public, anon, authenticated;

commit;
