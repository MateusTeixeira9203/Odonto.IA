-- =====================================================================================
-- OD-003f - PATCH do seed od003f-ficha-assinada-seed.sql: marcar a ficha FA como ASSINADA
-- Alvo: SOMENTE o projeto odonto-qa. NUNCA rodar em producao. Dados ficticios. Texto em ASCII.
-- Autor: OD - Arquiteto, 2026-10-24. NAO foi executado por quem escreveu.
--
-- Por que: a regra de edicao da evolucao (evolucao-clinica-ficha.tsx:53,
-- "!ficha.assinadoEm && !ficha.assinaturaUrl") olha a FICHA. A FA (...0911) tem um
-- procedimento assinado, mas fichas.assinado_em e fichas.assinatura_url estao NULL.
--
-- Padrao copiado do fluxo real que grava esses campos (caminho LEGADO de assinatura de
-- ficha): src/server/patients/registro-actions.ts:~120-136 (dentista),
-- src/app/dashboard/agendamentos/assinatura-actions.ts:~78-94 (recepcao) e
-- src/components/pacientes/FichasTab.tsx:~1636-1652:
--   storagePath = `${clinicaId}/${pacienteId}/assinatura_${fichaId}.png` (bucket 'fichas')
--   update fichas set assinatura_url = storagePath, assinado_em = <agora>
-- Aqui assinado_em = horario da assinatura da S2 (2026-10-21 12:45 UTC), o mesmo da
-- assinatura ...0931. Nao ha PNG no Storage: abrir a imagem da assinatura falha de proposito.
--
-- ATENCAO (coerencia com o produto): no fluxo REAL, ficha COM procedimento assina pelo
-- caminho granular (assinarTodosRealizadosDaFicha -> RPC assinar_procedimentos), que grava
-- so em assinaturas/odontograma_eventos e NAO preenche fichas.assinado_em. O caminho legado
-- acima so roda quando a ficha nao tem procedimento realizado sem assinatura. Ou seja: depois
-- deste patch a FA fica num estado que o produto nao produz sozinho (procedimento assinado
-- pelo caminho granular E ficha assinada pelo legado). Serve para testar a trava da ficha
-- assinada; nao serve como prova de que o fluxo real trava a evolucao. Efeitos esperados com
-- a ficha assinada: salvar_eventos_odontograma recusa (ficha_assinada) e
-- acrescentarEventosNaFicha devolve a mensagem de ficha assinada.
--
-- Idempotente: so atualiza se a FA ainda estiver sem assinatura; reaplicar nao muda nada.
-- Toca UMA linha: fichas.id = e0000000-0000-4000-8000-000000000911 (gatilho fichas_updated_at
-- atualiza updated_at, como no fluxo real).
-- =====================================================================================

begin;

do $$
begin
  if not exists (select 1 from public.fichas
                 where id = 'e0000000-0000-4000-8000-000000000911'
                   and clinica_id = 'b0000000-0000-4000-8000-000000000001'
                   and paciente_id = 'e0000000-0000-4000-8000-000000000901') then
    raise exception 'Patch FA: ficha FA nao existe. Aplique antes od003f-ficha-assinada-seed.sql';
  end if;
end $$;

update public.fichas
   set assinatura_url = 'b0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000901/assinatura_e0000000-0000-4000-8000-000000000911.png',
       assinado_em    = '2026-10-21 12:45:00+00'
 where id = 'e0000000-0000-4000-8000-000000000911'
   and clinica_id = 'b0000000-0000-4000-8000-000000000001'
   and assinado_em is null
   and assinatura_url is null;

do $$
declare v int;
begin
  select count(*) into v from public.fichas
   where id = 'e0000000-0000-4000-8000-000000000911'
     and assinado_em is not null
     and assinatura_url is not null;
  if v <> 1 then raise exception 'Patch FA: ficha FA nao ficou assinada'; end if;
  raise notice 'Patch FA OK: ficha ...0911 com assinado_em e assinatura_url';
end $$;

commit;
