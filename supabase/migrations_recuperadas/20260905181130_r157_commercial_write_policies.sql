-- R-157 — última linha de defesa para as mutações clínicas que ainda passam pelo browser.
-- As policies são restritivas, mas private.commercial_write_allowed() retorna true enquanto
-- billing_runtime_config.enforcement_enabled estiver desligado.

drop policy if exists commercial_write_fichas on public.fichas;
create policy commercial_write_fichas
  on public.fichas
  as restrictive
  for all
  to authenticated
  using ((select private.commercial_write_allowed(clinica_id)))
  with check ((select private.commercial_write_allowed(clinica_id)));

drop policy if exists commercial_write_planejamento_secoes on public.planejamento_secoes;
create policy commercial_write_planejamento_secoes
  on public.planejamento_secoes
  as restrictive
  for all
  to authenticated
  using ((select private.commercial_write_allowed(clinica_id)))
  with check ((select private.commercial_write_allowed(clinica_id)));

drop policy if exists commercial_write_paciente_documentos on public.paciente_documentos;
create policy commercial_write_paciente_documentos
  on public.paciente_documentos
  as restrictive
  for all
  to authenticated
  using ((select private.commercial_write_allowed(clinica_id)))
  with check ((select private.commercial_write_allowed(clinica_id)));

drop policy if exists commercial_write_fichas_storage on storage.objects;
create policy commercial_write_fichas_storage
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'fichas'
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (select private.commercial_write_allowed(split_part(name, '/', 1)::uuid))
    )
  )
  with check (
    bucket_id <> 'fichas'
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (select private.commercial_write_allowed(split_part(name, '/', 1)::uuid))
    )
  );