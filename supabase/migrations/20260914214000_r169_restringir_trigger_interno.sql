begin;
-- Função interna de trigger; chamadas RPC diretas não fazem parte do contrato.
revoke all on function public.validar_item_do_vinculo_orcamento() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
