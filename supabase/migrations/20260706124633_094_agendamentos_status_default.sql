-- O default 'agendado' viola a própria CHECK (agendamentos_status_check aceita só
-- os valores em inglês). Bug dormente: os 4 inserts do app (agendamentos/actions.ts,
-- google-provider.ts, message-handler.ts) sempre passam status explícito.
-- plans/handoffs/handoff-2026-07-06-execucao.md, item A.
alter table public.agendamentos alter column status set default 'scheduled';
