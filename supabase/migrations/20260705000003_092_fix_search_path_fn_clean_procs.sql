-- Fixa search_path na função SECURITY DEFINER que hoje roda com search_path
-- mutável (vetor teórico de hijack via search_path).
--
-- spec-seguranca-silo-validacao.md, Frente 6 (achado G).
alter function public.fn_clean_procs_on_ficha_delete() set search_path = public, pg_temp;
