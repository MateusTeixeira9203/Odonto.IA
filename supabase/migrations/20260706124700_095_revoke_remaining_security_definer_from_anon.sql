-- Fecha a superfície de RPC restante (item D da spec-seguranca-silo-validacao,
-- Frente 4). Achados confirmados nesta sessão:
--
-- complete_onboarding: autoprotegida (RAISE EXCEPTION se auth.uid() IS NULL) e
-- chamada só pela sessão autenticada do usuário (src/app/onboarding/actions.ts) —
-- revoga só de anon, mantém authenticated (fluxo legítimo de cadastro).
--
-- provision_secretaria: chamada só via service_role (src/server/services/team.ts,
-- createServiceClient()) — nunca por sessão authenticated de usuário final.
-- Revoga só de anon (mantém authenticated por paridade com o padrão da 093;
-- nenhum caller usa essa via, mas não há necessidade de estreitar além do
-- escopo desta spec).
--
-- handle_new_auth_user / fn_clean_procs_on_ficha_delete: funções de TRIGGER
-- puras (RETURNS trigger), sem nenhum caller .rpc() client-side (grep
-- confirmou). Disparo de trigger não depende de EXECUTE grant — fecha total
-- (public + anon + authenticated), sem risco funcional.
revoke execute on function public.complete_onboarding(text, text, text, text, text[], text, text, text, text, text) from anon;
revoke execute on function public.provision_secretaria(uuid, text, text, uuid, text, uuid) from anon;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.fn_clean_procs_on_ficha_delete() from public, anon, authenticated;
