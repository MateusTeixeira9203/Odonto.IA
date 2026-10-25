-- OD-015b1 M3 revista: volta literal aprovada. Nao aplicada. Auditoria permanece.
begin;
drop function if exists public.excluir_ficha_clinica(uuid, text, text, text, boolean);
drop function if exists public.descartar_atendimento_vazio(uuid);
-- A r169d CONTINUA SEM execute: devolver o grant reabriria um apagar sem confirmação e com
-- log clínico visível à secretária (AGENTS.md: não restaurar vulnerabilidade no rollback).
-- Só com decisão explícita do usuário:
--   grant execute on function public.excluir_ficha_propria_preservando_financeiro(uuid) to authenticated;
-- A tabela prontuario_exclusoes FICA (registro de guarda; ver §3 da SPEC FINAL).
notify pgrst, 'reload schema';
commit;
