-- =====================================================================================
-- OD-003f / inventario da Ficha - Dados FICTICIOS: ficha com procedimento ASSINADO e
-- retorno ja marcado (pedido do QA, 24/10)
-- Alvo: SOMENTE o projeto odonto-qa. NUNCA rodar em producao. Nenhum dado real. Texto em ASCII.
-- Autor: OD - Arquiteto, 2026-10-24. Escrito no mesmo formato de od003-od004-seed.sql
-- (assinatura, evento assinado, documento de aceite) e do codigo atual; NAO foi executado
-- por quem escreveu.
--
-- Pre-requisitos (o bloco 0 confere e aborta se faltar):
--   clinica   Clinica Local A   b0000000-0000-4000-8000-000000000001
--   dentista  Dra. Ana Local    b0000000-0000-4000-8000-0000000000a1
--
-- Nao toca F1, F2, F3, F4, ORC1 nem ORC2. Cria um paciente ficticio NOVO,
-- "Paciente Ficha Assinada QA" (...0901), so com id, clinica, nome e dentista (mesmo padrao
-- do od004-extra-seed.sql). Se o odonto-qa exigir outra coluna obrigatoria em pacientes, a
-- transacao aborta inteira no primeiro insert: avisar o Arquiteto.
-- Idempotente: uma transacao, UUIDs fixos (prefixo e0000000, faixa ...09xx),
-- ON CONFLICT DO NOTHING, sem UPDATE nem DELETE. Ordem: assinatura antes do evento assinado
-- (trg_odontograma_evento_imutavel nao deixa assinar depois por UPDATE).
--
-- --- O que cria ----------------------------------------------------------------------
-- Paciente Ficha Assinada QA                           ...0901
-- Ficha FA "Restauracao 16" (Dra. Ana, aberta)          ...0911
--   S1 sessao 15/10/2026 09:00 (avaliacao)              ...0921
--   S2 sessao 21/10/2026 09:00 (procedimento ASSINADO)  ...0922
--   procedimentos (odontograma_eventos):
--     EA 16 Restauracao em resina O  - realizado 21/10 - ASSINADO   ...0941
--     EB 17 Restauracao em resina OD - planejado, proxima sessao     ...0942
--   assinatura (tipo procedimentos, ficha FA, S2)       ...0931
--   documento: paciente_documentos ...0961 + documentos_aceite ...0962 (eventoIds = [EA])
--   evolucoes S1 ...0951, S2 ...0952
--   RETORNO marcado a partir da S2 (agendamentos.atendimento_origem_id = S2):
--     04/11/2026 14:00 BRT (17:00 UTC), 30 min, Dra. Ana, status scheduled   ...0971
--     -> cabecalho da ficha: "Proximo retorno: 04/11 14:00 - Dra. Ana Local - Agendado -
--        Abrir na Agenda"; na linha do tempo, S2 mostra "Retorno: 04/11 - ... - Ver na Agenda"
--     Atencao: depois de 04/11/2026 o retorno fica no passado (o texto continua, o estado
--     depende de como a tela trata retorno vencido).
-- O que da para testar: selo "Assinado" na S2 (F18), procedimento assinado imutavel (o "+"
-- abre so leitura), "x de y procedimentos", Proximo retorno + Abrir na Agenda, retorno da
-- sessao + Ver na Agenda, documento assinado em Arquivos, e "Coletar assinatura" com
-- procedimento ja assinado.
-- =====================================================================================

begin;

-- --- 0. Conferencia dos pre-requisitos -----------------------------------------------
do $$
begin
  if not exists (select 1 from public.clinicas where id = 'b0000000-0000-4000-8000-000000000001') then
    raise exception 'Ficha assinada seed: clinica Clinica Local A nao existe no odonto-qa';
  end if;
  if not exists (select 1 from public.dentistas
                 where id = 'b0000000-0000-4000-8000-0000000000a1'
                   and clinica_id = 'b0000000-0000-4000-8000-000000000001') then
    raise exception 'Ficha assinada seed: Dra. Ana Local nao existe nesta clinica';
  end if;
end $$;

-- --- 1. Paciente ficticio novo ---------------------------------------------------------
insert into public.pacientes (id, clinica_id, nome, dentista_id)
values ('e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-000000000001',
        'Paciente Ficha Assinada QA', 'b0000000-0000-4000-8000-0000000000a1')
on conflict do nothing;

-- --- 2. Ficha FA ------------------------------------------------------------------------
insert into public.fichas
  (id, clinica_id, paciente_id, dentista_id, status, nome, origem, data_atendimento,
   anotacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000911', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1',
   'aberta', 'Restauracao 16', 'manual', '2026-10-15',
   'Plano ficticio: restaurar 16 (O) e 17 (OD).',
   '2026-10-15 12:00:00+00', '2026-10-21 12:50:00+00')
on conflict do nothing;

-- --- 3. Sessoes (finalizadas) -----------------------------------------------------------
insert into public.atendimentos_clinicos
  (id, clinica_id, paciente_id, dentista_id, agendamento_id, chave_idempotencia,
   data_atendimento, origem, estado, finalizado_em, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000921', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000991', '2026-10-15', 'meu_dia', 'finalizado',
   '2026-10-15 12:40:00+00', '2026-10-15 12:00:00+00', '2026-10-15 12:40:00+00'),
  ('e0000000-0000-4000-8000-000000000922', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000992', '2026-10-21', 'meu_dia', 'finalizado',
   '2026-10-21 12:50:00+00', '2026-10-21 12:00:00+00', '2026-10-21 12:50:00+00')
on conflict do nothing;

-- --- 4. Assinatura da S2 (antes do evento assinado) ----------------------------------
insert into public.assinaturas
  (id, clinica_id, paciente_id, tipo, ficha_id, orcamento_id, dentista_id,
   assinado_por, cro_no_ato, assinatura_ref, assinado_em, created_at)
values
  ('e0000000-0000-4000-8000-000000000931', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'procedimentos',
   'e0000000-0000-4000-8000-000000000911', null, 'b0000000-0000-4000-8000-0000000000a1',
   'Paciente Ficha Assinada QA (assinatura ficticia)', 'CRO-FICTICIO-0001',
   'ficticio:od003f:assinatura-fa-s2', '2026-10-21 12:45:00+00', '2026-10-21 12:45:00+00')
on conflict do nothing;

-- --- 5. Procedimentos -------------------------------------------------------------------
insert into public.odontograma_eventos
  (id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status, origem,
   nivel, dente, faces, observacao, realizado_em, registrado_em, created_at, detalhe,
   encaminhado_para, assinatura_id, momento_planejado, procedimento_id, procedimento_nome)
values
  -- EA - 16 O - realizado em 21/10 e ASSINADO (S2)
  ('e0000000-0000-4000-8000-000000000941', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000911', null, 'carie_restauracao', 'realizado', 'clinica',
   'face', 16, array['O'],
   'Restauracao concluida, ajuste oclusal feito (texto ficticio).',
   '2026-10-21', '2026-10-15', '2026-10-15 12:20:00+00', null, null,
   'e0000000-0000-4000-8000-000000000931', 'sessao_atual', null, 'Restauracao em resina'),
  -- EB - 17 OD - planejado para a proxima sessao (deixa a ficha com algo em aberto)
  ('e0000000-0000-4000-8000-000000000942', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000911', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 17, array['O','D'],
   'Proxima etapa do plano (texto ficticio).',
   null, '2026-10-15', '2026-10-15 12:21:00+00', null, null, null, 'proxima_sessao', null,
   'Restauracao em resina')
on conflict do nothing;

-- --- 6. Vinculo sessao <-> procedimento (evita o fallback de eventos-da-visita.ts) -----
insert into public.atendimento_eventos (clinica_id, atendimento_id, evento_id, papel, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000921', 'e0000000-0000-4000-8000-000000000941', 'registrado', '2026-10-15 12:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000921', 'e0000000-0000-4000-8000-000000000942', 'registrado', '2026-10-15 12:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000922', 'e0000000-0000-4000-8000-000000000941', 'realizado',  '2026-10-21 12:50:00+00')
on conflict do nothing;

-- --- 7. Evolucoes (ligam cada sessao a ficha FA) --------------------------------------
insert into public.ficha_evolucoes
  (id, clinica_id, ficha_id, dentista_id, data, texto, automatica, atendimento_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000951', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000911', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-15',
   'Avaliacao ficticia: carie oclusal no 16 e proximal no 17. Planejadas as duas restauracoes.',
   false, 'e0000000-0000-4000-8000-000000000921', '2026-10-15 12:40:00+00', '2026-10-15 12:40:00+00'),
  ('e0000000-0000-4000-8000-000000000952', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000911', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-21',
   'Restauracao do 16 concluida e assinada pelo paciente (ficticio). Retorno marcado para o 17.',
   false, 'e0000000-0000-4000-8000-000000000922', '2026-10-21 12:50:00+00', '2026-10-21 12:50:00+00')
on conflict do nothing;

-- --- 8. Documento assinado da S2 -------------------------------------------------------
--    URL e pdf_path ficticios: o item aparece em Arquivos, mas abrir o arquivo falha de
--    proposito (nao ha arquivo no Storage), igual ao seed od003-od004.
insert into public.paciente_documentos
  (id, clinica_id, paciente_id, nome, url, categoria, origem, tipo_documento, dentista_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000961', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'Conclusao de procedimento - 16 (ficticio).pdf',
   'https://example.invalid/ficticio-od003f/conclusao-16.pdf', 'Documentos', 'fixture-od003f',
   'conclusao_procedimento', 'b0000000-0000-4000-8000-0000000000a1',
   '2026-10-21 12:46:00+00', '2026-10-21 12:46:00+00')
on conflict do nothing;

insert into public.documentos_aceite
  (id, clinica_id, paciente_id, dentista_id, ficha_id, orcamento_id, assinatura_id, tipo,
   template_versao, template_hash, conteudo_snapshot, assinatura_paciente_ref, assinado_por,
   assinado_em, pdf_path, paciente_documento_id)
values
  ('e0000000-0000-4000-8000-000000000962', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000901', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000911', null, 'e0000000-0000-4000-8000-000000000931',
   'conclusao_procedimento', 'fixture-od003f', 'fixture-od003f-sem-hash-real',
   '{"ficticio":true,"eventoIds":["e0000000-0000-4000-8000-000000000941"],"resumo":"16 - Restauracao em resina - O - concluida em 21/10/2026"}'::jsonb,
   'ficticio:od003f:assinatura-fa-s2', 'Paciente Ficha Assinada QA (assinatura ficticia)',
   '2026-10-21 12:45:00+00', 'fixtures/od003f/conclusao-16.pdf',
   'e0000000-0000-4000-8000-000000000961')
on conflict do nothing;

-- --- 9. Retorno marcado a partir da S2 (como criarAgendamento com atendimentoOrigemId) --
insert into public.agendamentos
  (id, clinica_id, dentista_id, paciente_id, data_hora, duracao_minutos, observacoes,
   status, created_by, atendimento_origem_id)
values
  ('e0000000-0000-4000-8000-000000000971', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000901',
   '2026-11-04 17:00:00+00', 30, 'Retorno: restauracao do 17 (ficticio)',
   'scheduled', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000922')
on conflict do nothing;

-- --- 10. Conferencia final (aborta e desfaz tudo se algo nao bater) -------------------
do $$
declare v int;
begin
  select count(*) into v from public.atendimentos_clinicos
   where paciente_id = 'e0000000-0000-4000-8000-000000000901';
  if v <> 2 then raise exception 'Ficha assinada seed: esperado 2 sessoes, achei %', v; end if;

  select count(*) into v from public.odontograma_eventos
   where id = 'e0000000-0000-4000-8000-000000000941'
     and status = 'realizado'
     and assinatura_id = 'e0000000-0000-4000-8000-000000000931';
  if v <> 1 then raise exception 'Ficha assinada seed: procedimento EA nao esta realizado e assinado'; end if;

  select count(*) into v from public.agendamentos
   where atendimento_origem_id = 'e0000000-0000-4000-8000-000000000922';
  if v <> 1 then raise exception 'Ficha assinada seed: retorno da S2 nao encontrado (achei %)', v; end if;

  select count(*) into v from public.ficha_evolucoes
   where ficha_id = 'e0000000-0000-4000-8000-000000000911';
  if v <> 2 then raise exception 'Ficha assinada seed: esperado 2 evolucoes na FA, achei %', v; end if;

  raise notice 'Ficha assinada seed OK: paciente ...0901, ficha FA ...0911, S2 assinada, retorno ...0971';
end $$;

commit;
