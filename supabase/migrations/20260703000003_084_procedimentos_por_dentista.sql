-- 084 — Catálogo de procedimentos vira privado por dentista (era compartilhado por clínica).
-- Cada dentista cadastra/edita/exclui só o próprio; admin mantém visão de todos (*marcador —
-- revisitar quando a hierarquia de planos/papéis mudar, decisão do fundador em 2026-07-04).
-- Secretária enxerga todos os dentistas (precisa pra criar orçamento em nome de qualquer um).

alter table procedimentos add column if not exists dentista_id uuid references dentistas(id);

-- Backfill: procedimentos existentes (sem dono) viram uma cópia PARA CADA dentista da clínica —
-- ninguém perde o que já tinha, cada um passa a editar a sua cópia independentemente.
with dentistas_numerados as (
  select d.id as dentista_id, d.clinica_id,
         row_number() over (partition by d.clinica_id order by d.created_at) as rn
  from dentistas d
),
existentes as (
  select * from procedimentos where dentista_id is null
)
insert into procedimentos (clinica_id, dentista_id, nome, descricao, codigo_tuss, preco_padrao, duracao_minutos, ativo, categoria)
select e.clinica_id, dn.dentista_id, e.nome, e.descricao, e.codigo_tuss, e.preco_padrao, e.duracao_minutos, e.ativo, e.categoria
from existentes e
join dentistas_numerados dn on dn.clinica_id = e.clinica_id and dn.rn > 1;

-- As linhas originais (ainda sem dono) ficam com o primeiro dentista de cada clínica.
update procedimentos p
set dentista_id = dn.dentista_id
from (
  select clinica_id, dentista_id from (
    select d.id as dentista_id, d.clinica_id,
           row_number() over (partition by d.clinica_id order by d.created_at) as rn
    from dentistas d
  ) x where rn = 1
) dn
where p.dentista_id is null and p.clinica_id = dn.clinica_id;

-- RLS: substitui o modelo "toda a clínica lê, só admin escreve" por "cada um o seu".
drop policy if exists procedimentos_select_clinic_members on procedimentos;
drop policy if exists procedimentos_write_admin on procedimentos;
drop policy if exists procedimentos_insert_dentistas on procedimentos;

create policy procedimentos_select_own_admin_secretaria
  on procedimentos for select
  using (
    belongs_to_active_clinic(clinica_id)
    and (dentista_id = get_my_dentista_id() or is_clinic_admin() or get_my_role() = 'secretaria')
  );

create policy procedimentos_insert_own
  on procedimentos for insert
  with check (
    belongs_to_active_clinic(clinica_id)
    and is_clinic_dentista()
    and dentista_id = get_my_dentista_id()
  );

create policy procedimentos_update_own_or_admin
  on procedimentos for update
  using (belongs_to_active_clinic(clinica_id) and (dentista_id = get_my_dentista_id() or is_clinic_admin()))
  with check (belongs_to_active_clinic(clinica_id) and (dentista_id = get_my_dentista_id() or is_clinic_admin()));

create policy procedimentos_delete_own_or_admin
  on procedimentos for delete
  using (belongs_to_active_clinic(clinica_id) and (dentista_id = get_my_dentista_id() or is_clinic_admin()));
