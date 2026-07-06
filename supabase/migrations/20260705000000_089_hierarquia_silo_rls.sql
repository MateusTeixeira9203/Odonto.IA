-- Materialização retroativa da migration 089, aplicada em produção só via MCP
-- (sem arquivo versionado — gap identificado na spec-seguranca-silo-validacao,
-- Frente 7). Este arquivo reproduz o estado JÁ VIVO em produção: helpers de
-- RLS baseados em clinica_usuarios + dentistas, e as policies por-dono nas
-- 13 tabelas clínicas. Idempotente (DROP POLICY IF EXISTS + CREATE POLICY),
-- seguro de re-rodar em qualquer ambiente.
--
-- Não precisa ser reaplicado em produção — só fecha o histórico versionado.

-- ── Helpers de RLS ───────────────────────────────────────────────────────────

create or replace function public.get_my_clinica_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select active_clinica_id from public.users where id = auth.uid()),
    (select clinica_id from public.dentistas where user_id = auth.uid() and ativo = true limit 1)
  )
$$;

create or replace function public.has_active_membership()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
    from public.clinica_usuarios cu
    join public.users u on u.id = auth.uid()
    where cu.usuario_id = auth.uid()
      and cu.clinica_id = u.active_clinica_id
      and cu.status = 'ativo'
  )
  or exists (
    select 1 from public.dentistas
    where user_id = auth.uid() and ativo = true
  )
$$;

create or replace function public.belongs_to_active_clinic(record_clinica_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select record_clinica_id is not null
    and record_clinica_id = public.get_my_clinica_id()
    and public.has_active_membership()
$$;

create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (
      select cu.role
      from public.clinica_usuarios cu
      join public.users u on u.id = auth.uid()
      where cu.usuario_id = auth.uid()
        and cu.clinica_id = u.active_clinica_id
        and cu.status = 'ativo'
      limit 1
    ),
    (select role from public.dentistas where user_id = auth.uid() and ativo = true limit 1)
  )
$$;

create or replace function public.get_my_dentista_id()
returns uuid
language sql stable security definer set search_path to 'public'
as $$
  select id from dentistas where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_clinic_admin()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.get_my_role() = 'admin'
$$;

create or replace function public.is_clinic_dentista()
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.get_my_role() in ('admin', 'dentista')
$$;

create or replace function public.is_my_patient(patient_dentista_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.dentistas d
    where d.user_id = auth.uid()
      and d.id = patient_dentista_id
  );
$$;

create or replace function public.is_own_clinical_record(record_dentista_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select record_dentista_id = public.get_my_dentista_id()
    or public.get_my_role() = 'secretaria'
$$;

create or replace function public.is_own_finance_record(record_dentista_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select record_dentista_id is null
    or exists (
      select 1 from public.dentistas
      where user_id = auth.uid()
        and clinica_id = public.get_my_clinica_id()
        and id = record_dentista_id
    )
$$;

-- ── RLS por tabela (silo por dentista, secretária vê tudo) ──────────────────

alter table public.fichas                      enable row level security;
alter table public.orcamentos                  enable row level security;
alter table public.orcamento_itens             enable row level security;
alter table public.pacientes                   enable row level security;
alter table public.agendamentos                enable row level security;
alter table public.pagamentos                  enable row level security;
alter table public.planejamentos               enable row level security;
alter table public.planejamento_etapas         enable row level security;
alter table public.planejamento_secoes         enable row level security;
alter table public.planejamento_procedimentos  enable row level security;
alter table public.paciente_documentos         enable row level security;
alter table public.procedimentos               enable row level security;
alter table public.horarios_disponiveis        enable row level security;

drop policy if exists "fichas_select" on public.fichas;
create policy "fichas_select" on public.fichas for select
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "fichas_write_own" on public.fichas;
create policy "fichas_write_own" on public.fichas for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

drop policy if exists "orcamentos_select" on public.orcamentos;
create policy "orcamentos_select" on public.orcamentos for select
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own" on public.orcamentos for insert
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

drop policy if exists "orcamentos_update" on public.orcamentos;
create policy "orcamentos_update" on public.orcamentos for update
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "orcamentos_delete_own" on public.orcamentos;
create policy "orcamentos_delete_own" on public.orcamentos for delete
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id());

drop policy if exists "orcamento_itens_select" on public.orcamento_itens;
create policy "orcamento_itens_select" on public.orcamento_itens for select
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o where o.id = orcamento_itens.orcamento_id and is_own_clinical_record(o.dentista_id)
  ));

drop policy if exists "orcamento_itens_insert_own" on public.orcamento_itens;
create policy "orcamento_itens_insert_own" on public.orcamento_itens for insert
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o where o.id = orcamento_itens.orcamento_id and o.dentista_id = get_my_dentista_id()
  ));

drop policy if exists "orcamento_itens_update" on public.orcamento_itens;
create policy "orcamento_itens_update" on public.orcamento_itens for update
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o where o.id = orcamento_itens.orcamento_id and is_own_clinical_record(o.dentista_id)
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o where o.id = orcamento_itens.orcamento_id and is_own_clinical_record(o.dentista_id)
  ));

drop policy if exists "orcamento_itens_delete_own" on public.orcamento_itens;
create policy "orcamento_itens_delete_own" on public.orcamento_itens for delete
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from orcamentos o where o.id = orcamento_itens.orcamento_id and o.dentista_id = get_my_dentista_id()
  ));

drop policy if exists "pacientes_access" on public.pacientes;
create policy "pacientes_access" on public.pacientes for all
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "agendamentos_access" on public.agendamentos;
create policy "agendamentos_access" on public.agendamentos for all
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "pagamentos_access" on public.pagamentos;
create policy "pagamentos_access" on public.pagamentos for all
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "planejamentos_select" on public.planejamentos;
create policy "planejamentos_select" on public.planejamentos for select
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "planejamentos_write_own" on public.planejamentos;
create policy "planejamentos_write_own" on public.planejamentos for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

drop policy if exists "planejamento_etapas_select" on public.planejamento_etapas;
create policy "planejamento_etapas_select" on public.planejamento_etapas for select
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from planejamentos p where p.id = planejamento_etapas.planejamento_id and is_own_clinical_record(p.dentista_id)
  ));

drop policy if exists "planejamento_etapas_write_own" on public.planejamento_etapas;
create policy "planejamento_etapas_write_own" on public.planejamento_etapas for all
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from planejamentos p where p.id = planejamento_etapas.planejamento_id and p.dentista_id = get_my_dentista_id()
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from planejamentos p where p.id = planejamento_etapas.planejamento_id and p.dentista_id = get_my_dentista_id()
  ));

drop policy if exists "planejamento_secoes_select" on public.planejamento_secoes;
create policy "planejamento_secoes_select" on public.planejamento_secoes for select
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_secoes.paciente_id and is_own_clinical_record(pc.dentista_id)
  ));

drop policy if exists "planejamento_secoes_write_own" on public.planejamento_secoes;
create policy "planejamento_secoes_write_own" on public.planejamento_secoes for all
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_secoes.paciente_id and pc.dentista_id = get_my_dentista_id()
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_secoes.paciente_id and pc.dentista_id = get_my_dentista_id()
  ));

drop policy if exists "planejamento_procedimentos_select" on public.planejamento_procedimentos;
create policy "planejamento_procedimentos_select" on public.planejamento_procedimentos for select
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_procedimentos.paciente_id and is_own_clinical_record(pc.dentista_id)
  ));

drop policy if exists "planejamento_procedimentos_write_own" on public.planejamento_procedimentos;
create policy "planejamento_procedimentos_write_own" on public.planejamento_procedimentos for all
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_procedimentos.paciente_id and pc.dentista_id = get_my_dentista_id()
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = planejamento_procedimentos.paciente_id and pc.dentista_id = get_my_dentista_id()
  ));

drop policy if exists "paciente_documentos_access" on public.paciente_documentos;
create policy "paciente_documentos_access" on public.paciente_documentos for all
  using (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = paciente_documentos.paciente_id and is_own_clinical_record(pc.dentista_id)
  ))
  with check (belongs_to_active_clinic(clinica_id) and exists (
    select 1 from pacientes pc where pc.id = paciente_documentos.paciente_id and is_own_clinical_record(pc.dentista_id)
  ));

drop policy if exists "procedimentos_select" on public.procedimentos;
create policy "procedimentos_select" on public.procedimentos for select
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));

drop policy if exists "procedimentos_write_own" on public.procedimentos;
create policy "procedimentos_write_own" on public.procedimentos for all
  using (belongs_to_active_clinic(clinica_id) and dentista_id = get_my_dentista_id())
  with check (belongs_to_active_clinic(clinica_id) and is_clinic_dentista() and dentista_id = get_my_dentista_id());

drop policy if exists "horarios_access" on public.horarios_disponiveis;
create policy "horarios_access" on public.horarios_disponiveis for all
  using (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id))
  with check (belongs_to_active_clinic(clinica_id) and is_own_clinical_record(dentista_id));
