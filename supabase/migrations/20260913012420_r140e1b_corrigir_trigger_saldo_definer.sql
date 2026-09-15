-- R-140e1b: constraint trigger diferido executa após a RPC; precisa manter o privilégio interno.
-- Não concede acesso direto às tabelas de estoque a papéis de API.
create or replace function private.estoque_validar_saldo_final()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  -- Diferido: inverso e substituto podem ter saldo intermediário negativo, nunca final.
  if (select coalesce(sum(m.quantidade), 0) from public.estoque_movimentos m
      where m.clinica_id = new.clinica_id and m.item_id = new.item_id and m.lote_id = new.lote_id) < 0 then
    raise exception 'ESTOQUE_SALDO_INSUFICIENTE' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.estoque_validar_saldo_final() from public, anon, authenticated, service_role;
