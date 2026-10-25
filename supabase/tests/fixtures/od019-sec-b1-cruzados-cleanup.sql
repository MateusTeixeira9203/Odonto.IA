-- OD-019 / registro de limpeza autorizado ao Orquestrador, NUNCA executado pelo Dev.
-- SOMENTE odonto-qa uhuxteswtvgdnlixwrdu; executor deve validar o host antes de conectar.
-- 4 registros ficticios SEC-B1, IDs exatos. Nao apaga pacientes/agendamentos da A.
-- As duas evolucoes ficticias conhecidas caem por cascade das fichas.
-- Ja removido pelo Orquestrador? Linhas ausentes sao no-op; linha divergente ABORTA.
-- Rodar separado e ANTES da M0. Antes desta limpeza o VALIDATE deve falhar.
begin;

select 'antes visitas' as etapa, count(*) from public.atendimentos_clinicos
where id in ('2a0c91dd-bac4-4749-bda0-de41107daf72','dc1fdb45-d8a6-4328-9e85-d830e6c189af');
select 'antes fichas' as etapa, count(*) from public.fichas
where id in ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622');

do $confere$
declare r record;
begin
  for r in
    select id,paciente_id,clinica_id,agendamento_id from public.atendimentos_clinicos
    where id in ('2a0c91dd-bac4-4749-bda0-de41107daf72','dc1fdb45-d8a6-4328-9e85-d830e6c189af') for update
  loop
    if r.clinica_id <> 'b0000000-0000-4000-8000-000000000002'::uuid or not exists (
      select 1 from public.pacientes p where p.id=r.paciente_id and p.clinica_id='b0000000-0000-4000-8000-000000000001'
    ) or ((r.id='2a0c91dd-bac4-4749-bda0-de41107daf72'::uuid and r.paciente_id='b662fec4-040f-4395-8332-fc6449b17aba'::uuid and r.agendamento_id='48258a21-06a3-45df-8fbd-a8d22a70a649'::uuid)
      or (r.id='dc1fdb45-d8a6-4328-9e85-d830e6c189af'::uuid and r.paciente_id='095b9407-f14d-43d7-9771-84eea3bb7778'::uuid and r.agendamento_id='a2eb3b27-89d8-4cf4-8a83-51308074fd49'::uuid)) is not true then
      raise exception 'OD019 cleanup: visita alvo mudou; abortar e investigar';
    end if;
  end loop;
  for r in select id,paciente_id,clinica_id from public.fichas
    where id in ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622') for update
  loop
    if r.clinica_id <> 'b0000000-0000-4000-8000-000000000002'::uuid or not exists (
      select 1 from public.pacientes p where p.id=r.paciente_id and p.clinica_id='b0000000-0000-4000-8000-000000000001'
    ) or ((r.id='ccde3068-1c5e-47ac-8ad3-dc3e0a39e602'::uuid and r.paciente_id='b662fec4-040f-4395-8332-fc6449b17aba'::uuid)
      or (r.id='af5642d5-969f-440d-b0bc-e5a762126622'::uuid and r.paciente_id='095b9407-f14d-43d7-9771-84eea3bb7778'::uuid)) is not true then
      raise exception 'OD019 cleanup: ficha alvo mudou; abortar e investigar';
    end if;
  end loop;
  if exists (select 1 from public.ficha_evolucoes where ficha_id in
    ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622')
    and id not in ('169f19f5-6916-4ad0-a3c5-c25b2c026282','c8b2663d-70b8-4a30-b897-9dba086e8f10')) then
    raise exception 'OD019 cleanup: evolucao adicional fora do recorte';
  end if;
  if exists(select 1 from public.odontograma_eventos where ficha_id in
    ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622'))
    or exists(select 1 from public.atendimento_eventos where atendimento_id in
    ('2a0c91dd-bac4-4749-bda0-de41107daf72','dc1fdb45-d8a6-4328-9e85-d830e6c189af')) then
    raise exception 'OD019 cleanup: dependencias inesperadas; preservar e revisar';
  end if;
end;
$confere$;

delete from public.fichas where clinica_id='b0000000-0000-4000-8000-000000000002' and (id,paciente_id) in
  (('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602'::uuid,'b662fec4-040f-4395-8332-fc6449b17aba'::uuid),
   ('af5642d5-969f-440d-b0bc-e5a762126622'::uuid,'095b9407-f14d-43d7-9771-84eea3bb7778'::uuid));
delete from public.atendimentos_clinicos where clinica_id='b0000000-0000-4000-8000-000000000002' and (id,paciente_id) in
  (('2a0c91dd-bac4-4749-bda0-de41107daf72'::uuid,'b662fec4-040f-4395-8332-fc6449b17aba'::uuid),
   ('dc1fdb45-d8a6-4328-9e85-d830e6c189af'::uuid,'095b9407-f14d-43d7-9771-84eea3bb7778'::uuid));

do $depois$
begin
  if exists(select 1 from public.fichas where id in
    ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622'))
    or exists(select 1 from public.atendimentos_clinicos where id in
    ('2a0c91dd-bac4-4749-bda0-de41107daf72','dc1fdb45-d8a6-4328-9e85-d830e6c189af'))
    or exists(select 1 from public.ficha_evolucoes where id in
    ('169f19f5-6916-4ad0-a3c5-c25b2c026282','c8b2663d-70b8-4a30-b897-9dba086e8f10')) then
    raise exception 'OD019 cleanup: alvos remanescentes, transacao abortada';
  end if;
end;
$depois$;
select 'depois visitas' as etapa, count(*) from public.atendimentos_clinicos
where id in ('2a0c91dd-bac4-4749-bda0-de41107daf72','dc1fdb45-d8a6-4328-9e85-d830e6c189af');
select 'depois fichas' as etapa, count(*) from public.fichas
where id in ('ccde3068-1c5e-47ac-8ad3-dc3e0a39e602','af5642d5-969f-440d-b0bc-e5a762126622');
commit;
