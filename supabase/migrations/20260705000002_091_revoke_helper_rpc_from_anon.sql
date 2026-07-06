-- Revoga EXECUTE de anon nos helpers internos de RLS. Eles são SECURITY DEFINER
-- e chamáveis via /rest/v1/rpc/<nome> — um oráculo de enumeração ("esse
-- dentista_id é meu?") sem passar pela tabela. Nenhum client-side chama esses
-- helpers (varredura confirmou: só usados dentro de policies, via authenticated).
--
-- `authenticated` mantém EXECUTE — a própria RLS depende deles.
--
-- spec-seguranca-silo-validacao.md, Frente 4 (achado D).
revoke execute on function public.is_my_patient(uuid)            from anon;
revoke execute on function public.is_own_clinical_record(uuid)   from anon;
revoke execute on function public.is_own_finance_record(uuid)    from anon;
revoke execute on function public.get_my_dentista_id()           from anon;
revoke execute on function public.get_my_role()                  from anon;
revoke execute on function public.get_my_clinica_id()            from anon;
revoke execute on function public.is_clinic_admin()              from anon;
revoke execute on function public.is_clinic_dentista()           from anon;
revoke execute on function public.has_active_membership()        from anon;
revoke execute on function public.belongs_to_active_clinic(uuid) from anon;
