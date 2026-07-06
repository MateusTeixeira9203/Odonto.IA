-- Correção da 091: EXECUTE em funções é concedido a PUBLIC por padrão na
-- criação. `REVOKE ... FROM anon` não tem efeito quando o acesso vem do
-- grant implícito a PUBLIC (todo role, incl. anon, é membro de PUBLIC) —
-- confirmado via pg_proc.proacl (só existia entrada `=X/postgres`, nunca
-- uma entrada própria para `anon`). get_advisors continuou WARN após a 091.
--
-- Revoga de PUBLIC e mantém o grant explícito a `authenticated` (a RLS
-- depende dele).
--
-- spec-seguranca-silo-validacao.md, Frente 4 (achado D) — fix da 091.
revoke execute on function public.is_my_patient(uuid)            from public;
revoke execute on function public.is_own_clinical_record(uuid)   from public;
revoke execute on function public.is_own_finance_record(uuid)    from public;
revoke execute on function public.get_my_dentista_id()           from public;
revoke execute on function public.get_my_role()                  from public;
revoke execute on function public.get_my_clinica_id()            from public;
revoke execute on function public.is_clinic_admin()              from public;
revoke execute on function public.is_clinic_dentista()           from public;
revoke execute on function public.has_active_membership()        from public;
revoke execute on function public.belongs_to_active_clinic(uuid) from public;

grant execute on function public.is_my_patient(uuid)            to authenticated;
grant execute on function public.is_own_clinical_record(uuid)   to authenticated;
grant execute on function public.is_own_finance_record(uuid)    to authenticated;
grant execute on function public.get_my_dentista_id()           to authenticated;
grant execute on function public.get_my_role()                  to authenticated;
grant execute on function public.get_my_clinica_id()            to authenticated;
grant execute on function public.is_clinic_admin()              to authenticated;
grant execute on function public.is_clinic_dentista()           to authenticated;
grant execute on function public.has_active_membership()        to authenticated;
grant execute on function public.belongs_to_active_clinic(uuid) to authenticated;
