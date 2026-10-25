-- Somente odonto-qa: uhuxteswtvgdnlixwrdu. Remove apenas a fixture deste pacote.
delete from public.pacientes
where id = 'e0000000-0000-4000-8000-000000001701'
  and clinica_id = 'b0000000-0000-4000-8000-000000000001'
  and nome = 'QA OD017 Smoke';
