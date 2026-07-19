-- =====================================================================
-- 100 — fichas.data_atendimento (Spec Job A — Ficha rápida, §7)
--
-- Spec: plans/specs/2026-07-16-job-a-ficha-rapida-spec.md
--
-- Data CLÍNICA do atendimento (retroatível — histórico migrado). created_at
-- segue sendo auditoria ("quando foi registrado"). Ordenação clínica:
-- (data_atendimento desc, created_at desc).
--
-- ADITIVA: nenhum código atual referencia a coluna — nada quebra se ela chegar
-- antes do código do Job A (o default é rede de segurança). RLS inalterada:
-- a coluna herda as policies de linha da 099.
--
-- Tipo `date`, não `timestamptz`: o dentista retroagindo sabe o DIA, não a hora.
-- Empate no mesmo dia desempata por created_at.
-- =====================================================================

begin;

alter table public.fichas
  add column data_atendimento date not null
  default ((now() at time zone 'America/Sao_Paulo')::date);

comment on column public.fichas.data_atendimento is
  'Data clínica do atendimento (pode ser retroativa — histórico migrado). '
  'created_at = quando foi registrado no sistema (auditoria). '
  'Toda escrita da aplicação envia o valor explícito no fuso da clínica; o default é rede de segurança.';

-- Backfill: nas fichas existentes o atendimento foi no dia do registro (fuso BRT).
-- Roda depois do ADD COLUMN (que preencheu todas com "hoje") e corrige pro dia real.
update public.fichas
  set data_atendimento = (created_at at time zone 'America/Sao_Paulo')::date;

commit;

-- Sem índice novo (33 fichas em prod; listas filtram por paciente_id + clinica_id).
