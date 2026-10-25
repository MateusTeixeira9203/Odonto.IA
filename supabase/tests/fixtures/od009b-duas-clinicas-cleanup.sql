-- OD-009b: SOMENTE odonto-qa (uhuxteswtvgdnlixwrdu.supabase.co).
-- O Orquestrador aplica depois dos testes. Nao remove horarios ou outros registros.
begin;

do $$
begin
  if not exists (
    select 1 from public.dentistas d join auth.users u on u.id = d.user_id
    where d.id = 'c0000000-0000-4000-8000-0000000000d1'
      and d.user_id = 'c0000000-0000-4000-8000-00000000000d'
      and d.clinica_id = 'b0000000-0000-4000-8000-000000000001'
      and d.nome = 'Dr. Carlos Local' and u.email like '%@example.invalid'
  ) then
    raise exception 'OD-009b: fixture base ficticia do odonto-qa ausente';
  end if;
end $$;

update public.users
set active_clinica_id = 'b0000000-0000-4000-8000-000000000001'
where id = 'c0000000-0000-4000-8000-00000000000d'
  and active_clinica_id = 'b0000000-0000-4000-8000-000000000002';

delete from public.dentistas
where id = 'e0000000-0000-4000-8000-000000009b01'
  and user_id = 'c0000000-0000-4000-8000-00000000000d'
  and clinica_id = 'b0000000-0000-4000-8000-000000000002';

delete from public.clinica_acessos
where clinica_id = 'b0000000-0000-4000-8000-000000000002'
  and membro_id = 'e0000000-0000-4000-8000-000000009b02';

delete from public.clinica_usuarios
where id = 'e0000000-0000-4000-8000-000000009b02'
  and usuario_id = 'c0000000-0000-4000-8000-00000000000d'
  and clinica_id = 'b0000000-0000-4000-8000-000000000002';

commit;
