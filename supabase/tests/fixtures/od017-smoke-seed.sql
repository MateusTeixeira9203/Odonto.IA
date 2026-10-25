-- Somente odonto-qa: uhuxteswtvgdnlixwrdu. Sem transacao propria para permitir --ensaio.
do $$
begin
  if not exists (select 1 from public.clinicas
                 where id = 'b0000000-0000-4000-8000-000000000001' and nome = 'Clínica Local A') then
    raise exception 'OD017: clinica ficticia QA ausente';
  end if;
end $$;

insert into public.pacientes (id, clinica_id, nome)
values ('e0000000-0000-4000-8000-000000001701',
        'b0000000-0000-4000-8000-000000000001', 'QA OD017 Smoke')
on conflict do nothing;
