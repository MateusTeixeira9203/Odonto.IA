-- OD-009b: SOMENTE odonto-qa (uhuxteswtvgdnlixwrdu.supabase.co).
-- O Orquestrador aplica; nunca producao. Apenas duas linhas ficticias.
begin;

do $$
begin
  if not exists (
    select 1 from public.dentistas d join auth.users u on u.id = d.user_id
    where d.id = 'c0000000-0000-4000-8000-0000000000d1'
      and d.user_id = 'c0000000-0000-4000-8000-00000000000d'
      and d.clinica_id = 'b0000000-0000-4000-8000-000000000001'
      and d.nome = 'Dr. Carlos Local' and d.role = 'dentista'
      and u.email like '%@example.invalid'
  ) or not exists (
    select 1 from public.clinicas where id = 'b0000000-0000-4000-8000-000000000002'
      and nome = 'Clínica Local B'
  ) then
    raise exception 'OD-009b: fixture base ficticia do odonto-qa ausente';
  end if;
  if exists (
    select 1 from public.dentistas
    where user_id = 'c0000000-0000-4000-8000-00000000000d'
      and clinica_id = 'b0000000-0000-4000-8000-000000000002'
      and id <> 'e0000000-0000-4000-8000-000000009b01'
  ) or exists (
    select 1 from public.clinica_usuarios
    where usuario_id = 'c0000000-0000-4000-8000-00000000000d'
      and clinica_id = 'b0000000-0000-4000-8000-000000000002'
      and id <> 'e0000000-0000-4000-8000-000000009b02'
  ) then
    raise exception 'OD-009b: vinculo preexistente fora da fixture; revisar antes de aplicar';
  end if;
end $$;

insert into public.clinica_usuarios (id, usuario_id, clinica_id, role, status)
values ('e0000000-0000-4000-8000-000000009b02',
        'c0000000-0000-4000-8000-00000000000d',
        'b0000000-0000-4000-8000-000000000002', 'dentista', 'ativo')
on conflict do nothing;

insert into public.dentistas (id, user_id, clinica_id, nome, cro, role, ativo)
values ('e0000000-0000-4000-8000-000000009b01',
        'c0000000-0000-4000-8000-00000000000d',
        'b0000000-0000-4000-8000-000000000002',
        'Dr. Carlos Local B', 'QA-B-0002', 'dentista', true)
on conflict do nothing;

commit;
