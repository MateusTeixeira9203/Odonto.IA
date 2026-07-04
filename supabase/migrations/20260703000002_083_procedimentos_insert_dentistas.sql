-- 083 — Permite qualquer dentista da clínica CADASTRAR procedimento no catálogo
-- (INSERT), não só admin. Editar/desativar (UPDATE/DELETE) continua restrito ao
-- admin via procedimentos_write_admin (ALL) — esta policy só adiciona a permissão
-- de criar, no mesmo padrão de orcamentos_insert_dentistas.

create policy procedimentos_insert_dentistas
  on procedimentos
  for insert
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista());
