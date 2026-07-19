-- =====================================================================
-- 103 — notificacoes: destinatário é a PESSOA (Spec Painel do Dex, Fatia 0)
--
-- Spec: plans/specs/2026-07-16-painel-dex-notificacoes-spec.md §3
--
-- REGRA (invariante #1 da spec): para_dentista_id preenchido → só ele lê
-- (role irrelevante). para_dentista_id null → broadcast por role na clínica
-- (comportamento atual preservado). A mesma regra vale nas DUAS camadas SQL:
-- SELECT (ver) e UPDATE (marcar lida).
--
-- FUROS QUE ESTA MIGRATION FECHA (diagnóstico 16/07):
--   1. SELECT ignorava para_dentista_id → dentista B via a notificação do A
--      (inclusive pelo canal realtime, que assina INSERT sem filtro).
--   2. UPDATE (notificacoes_update_own, migration 057) usava belongs_to_active_clinic
--      SOLTO → qualquer membro da clínica marcava como lida a notificação de
--      qualquer outro. Apertado aqui pro mesmo predicado do SELECT.
--
-- Helpers conferidos contra a 099/089 (a spec marcava como placeholder):
--   belongs_to_active_clinic(uuid) ✅ · get_my_dentista_id() ✅ · get_my_role() ✅
--
-- COMPAT — o que esta migration APERTA e o que NÃO entrega sozinha:
--   • Secretária (fluxo que funciona, 58/17): suas notificações são broadcast
--     'secretaria' → o ramo de role continua casando. NÃO regride (invariante #5).
--   • O leak (B vê A) FECHA no ato — em RLS, rota e realtime.
--   • "Donos passam a RECEBER" (camada 1) NÃO vem só desta migration: a rota
--     /api/dex/alerts ainda filtra por para_role no código — trocar o filtro pro
--     espelho deste predicado é a Fatia 1 (código). Esta migration só torna a RLS
--     a fronteira correta; não afrouxa nada.
--   • Backlog cleanup (marcar >30d como lida pra não inundar o dentista) NÃO
--     entra aqui: a inundação só acontece quando o RECEBIMENTO liga (Fatia 1).
--     Fazê-lo agora tocaria o estado da secretária à toa e não cobriria o
--     backlog acumulado até a Fatia 1. Vai JUNTO da Fatia 1.
--
-- notificacoes_insert NÃO é tocada: service actions inserem em nome de outro
-- (secretária cria agendamento → notifica o dentista); belongs_to_active_clinic
-- no INSERT é o correto.
-- =====================================================================

begin;

-- ── SELECT: pessoa-primeiro ──────────────────────────────────────────
drop policy if exists notificacoes_select on public.notificacoes;

create policy notificacoes_select on public.notificacoes
  for select to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      (para_dentista_id is not null and para_dentista_id = public.get_my_dentista_id())
      or
      (para_dentista_id is null and (para_role = public.get_my_role() or para_role = 'all'))
    )
  );

-- ── UPDATE (marcar lida): MESMO predicado do SELECT ──────────────────
-- Nomes históricos: 040 criou notificacoes_update; 057 recriou como
-- notificacoes_update_own. Dropa os dois por segurança.
drop policy if exists notificacoes_update     on public.notificacoes;
drop policy if exists notificacoes_update_own on public.notificacoes;

create policy notificacoes_update_own on public.notificacoes
  for update to authenticated
  using (
    public.belongs_to_active_clinic(clinica_id)
    and (
      (para_dentista_id is not null and para_dentista_id = public.get_my_dentista_id())
      or
      (para_dentista_id is null and (para_role = public.get_my_role() or para_role = 'all'))
    )
  )
  with check (
    public.belongs_to_active_clinic(clinica_id)
    and (
      (para_dentista_id is not null and para_dentista_id = public.get_my_dentista_id())
      or
      (para_dentista_id is null and (para_role = public.get_my_role() or para_role = 'all'))
    )
  );

commit;
