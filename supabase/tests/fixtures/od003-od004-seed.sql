-- =====================================================================================
-- OD-003 / OD-004 · Dados FICTÍCIOS para o QA visual da Ficha (v11) e do Orçamento (v6)
-- Alvo: SOMENTE o projeto `odonto-qa`. NUNCA rodar em produção. Nenhum dado real.
-- Autor: OD - Arquiteto, 2026-10-23. Escrito contra o schema de produção sem dados
-- (prod-public-schema.sql) e o código atual; NÃO foi executado por quem escreveu.
--
-- Pré-requisitos (já existentes no odonto-qa; o bloco 0 confere e aborta se faltar):
--   clínica   Clínica Local A        b0000000-0000-4000-8000-000000000001
--   dentista  Dra. Ana Local         b0000000-0000-4000-8000-0000000000a1
--   dentista  Dr. Carlos Local       c0000000-0000-4000-8000-0000000000d1  (mesma clínica)
--   paciente  Paciente Fluxo Local   b0000000-0000-4000-8000-0000000000a2
--   paciente  Paciente Teste Dois    b0000000-0000-4000-8000-0000000000a4
--
-- Como é idempotente: tudo em uma transação; toda linha tem UUID fixo (prefixo e0000000)
-- e entra com `ON CONFLICT DO NOTHING`. Reaplicar não duplica nem altera nada.
-- Não há UPDATE nem DELETE: os gatilhos bloqueiam mexer em evento assinado
-- (trg_odontograma_evento_imutavel) ou encaminhado (trg_odontograma_evento_responsavel),
-- por isso cada linha já nasce no estado final, na ordem certa
-- (assinatura antes do evento assinado).
-- Para RESETAR: não há script; apagar exige papel de dono e cuidado com os gatilhos
-- (pedir ao Orquestrador).
--
-- As RPCs reais exigem usuário autenticado (get_my_clinica_id/get_my_dentista_id). Este
-- arquivo grava diretamente o MESMO que elas gravariam; cada bloco cita a RPC que imita.
-- Não cria item de catálogo (`procedimentos`) para não interferir nos testes de catálogo
-- do OD-001/OD-002: itens e eventos usam só o nome do procedimento.
--
-- ─── O que cria ──────────────────────────────────────────────────────────────────────
-- OD-003 · Paciente Fluxo Local · Ficha F1 "Reabilitação posterior" (Dra. Ana, aberta)
--   F1  ficha                         e0000000-0000-4000-8000-000000000301
--   S1  sessão 12/10/2026 10:00       e0000000-0000-4000-8000-000000000311  (avaliação)
--   S2  sessão 19/10/2026 10:00       e0000000-0000-4000-8000-000000000312  (ASSINADA)
--   S3  sessão 22/10/2026 14:30       e0000000-0000-4000-8000-000000000313  (encaminhamento)
--   evoluções S1/S2/S3                e0000000-0000-4000-8000-00000000032{1,2,3}
--   assinatura (procedimentos, S2)    e0000000-0000-4000-8000-000000000331
--   procedimentos (odontograma_eventos):
--     E1 26 Restauração em resina MOD · planejado (A fazer)            ...0341
--     E2 36 Restauração em resina O   · planejado, próxima sessão      ...0342
--     E3 46 Restauração em resina DO  · concluído 19/10 · ASSINADO     ...0343
--     E4 36 Tratamento endodôntico 1ª etapa · concluída 19/10 (tabela de canais) ...0344
--     E5 36 Tratamento endodôntico obturação · planejado, próxima sessão ...0345
--          (E4 + E5 = "em andamento": mesmo grupo e0000000-...-000000000349)
--     E6 16 Extração · planejado · ENCAMINHADO ao Dr. Carlos            ...0346
--     E7 boca · Profilaxia · concluída 22/10                            ...0347
--   documento do paciente (PDF fictício) e0000000-0000-4000-8000-000000000351
--   documento assinado (conclusão, S2)    e0000000-0000-4000-8000-000000000352
--   radiografia fictícia (Arquivos)       e0000000-0000-4000-8000-000000000353
--
-- OD-004 · Orçamentos
--   ORC1 RASCUNHO na F1 (Fluxo Local)   e0000000-0000-4000-8000-000000000401
--        itens: 26 MOD R$ 350 (…0411), 36 O R$ 250 (…0412) · não aprovados · total R$ 600
--        vínculos: E1→…0411, E2→…0412. E3–E7 ficam fora do orçamento, o que gera
--        diferenças "faltando" para o painel de revisão (O31)
--   F2  ficha "Tratamento restaurador" do Paciente Teste Dois  e0000000-0000-4000-8000-000000000501
--        sessão 20/10/2026 (…0511), evolução (…0521)
--        eventos: 11 V (…0541), 21 V (…0542), 14 coroa (…0543), todos planejados
--   ORC2 ACEITO na F2                   e0000000-0000-4000-8000-000000000402
--        itens aprovados: 11 V R$ 300 (…0421), 21 V R$ 300 (…0422), 14 coroa R$ 1.500 (…0423)
--        subtotal R$ 2.100 · desconto R$ 100 · final R$ 2.000
--        cobrança por etapa (…0431): entrada R$ 500 Pix PAGA + 3 parcelas de R$ 500
--          pagamentos: entrada (…0441, pago 20/10), parcela 1/3 (…0442, paga 20/10),
--                      2/3 (…0443, pendente 20/11), 3/3 (…0444, pendente 20/12)
--        aceite assinado (assinaturas tipo 'orcamento')  e0000000-0000-4000-8000-000000000451
--        registro de atividade (…0461 etapa criada, …0462 aprovado, …0463 pagamento)
--        Esperado na tela: estado "Aceito — falta R$ 1.000,00" (pago R$ 1.000 de R$ 2.000)
-- =====================================================================================

begin;

-- ─── 0. Conferência dos pré-requisitos (aborta tudo se faltar algo) ────────────────────
do $$
declare
  v_clinica constant uuid := 'b0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.clinicas where id = v_clinica) then
    raise exception 'OD-003/004 seed: clínica % não existe no odonto-qa', v_clinica;
  end if;
  if not exists (select 1 from public.dentistas where id = 'b0000000-0000-4000-8000-0000000000a1' and clinica_id = v_clinica) then
    raise exception 'OD-003/004 seed: Dra. Ana Local não existe nesta clínica';
  end if;
  if not exists (select 1 from public.dentistas where id = 'c0000000-0000-4000-8000-0000000000d1' and clinica_id = v_clinica) then
    raise exception 'OD-003/004 seed: Dr. Carlos Local (c0000000-...-0000000000d1) não existe nesta clínica; criar a conta antes';
  end if;
  if not exists (select 1 from public.pacientes where id = 'b0000000-0000-4000-8000-0000000000a2' and clinica_id = v_clinica) then
    raise exception 'OD-003/004 seed: Paciente Fluxo Local não existe nesta clínica';
  end if;
  if not exists (select 1 from public.pacientes where id = 'b0000000-0000-4000-8000-0000000000a4' and clinica_id = v_clinica) then
    raise exception 'OD-003/004 seed: Paciente Teste Dois não existe nesta clínica';
  end if;
end $$;

-- =====================================================================================
-- OD-003 · FICHA F1 do Paciente Fluxo Local
-- =====================================================================================

-- 1. Ficha (como salvar_ficha/rotear-visita gravariam; campos clínicos mínimos)
insert into public.fichas
  (id, clinica_id, paciente_id, dentista_id, status, nome, origem, data_atendimento,
   anotacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'aberta', 'Reabilitação posterior', 'manual', '2026-10-12',
   'Plano: restaurações 26/36/46, endodontia do 36, extração do 16 com o cirurgião.',
   '2026-10-12 13:00:00+00', '2026-10-22 17:30:00+00')
on conflict do nothing;

-- 2. Sessões (atendimentos_clinicos, como registrar_atendimento_clinico; finalizadas)
insert into public.atendimentos_clinicos
  (id, clinica_id, paciente_id, dentista_id, agendamento_id, chave_idempotencia,
   data_atendimento, origem, estado, finalizado_em, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000311', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000391', '2026-10-12', 'meu_dia', 'finalizado',
   '2026-10-12 13:40:00+00', '2026-10-12 13:00:00+00', '2026-10-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000312', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000392', '2026-10-19', 'meu_dia', 'finalizado',
   '2026-10-19 13:50:00+00', '2026-10-19 13:00:00+00', '2026-10-19 13:50:00+00'),
  ('e0000000-0000-4000-8000-000000000313', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000393', '2026-10-22', 'meu_dia', 'finalizado',
   '2026-10-22 17:30:00+00', '2026-10-22 17:30:00+00', '2026-10-22 17:30:00+00')
on conflict do nothing;

-- 3. Assinatura da sessão S2 (como assinar_procedimentos: tipo 'procedimentos', ficha_id).
--    Precisa existir ANTES do evento E3, que já nasce com assinatura_id.
insert into public.assinaturas
  (id, clinica_id, paciente_id, tipo, ficha_id, orcamento_id, dentista_id,
   assinado_por, cro_no_ato, assinatura_ref, assinado_em, created_at)
values
  ('e0000000-0000-4000-8000-000000000331', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'procedimentos',
   'e0000000-0000-4000-8000-000000000301', null, 'b0000000-0000-4000-8000-0000000000a1',
   'Paciente Fluxo Local (assinatura fictícia)', 'CRO-FICTICIO-0001',
   'ficticio:od003:assinatura-s2', '2026-10-19 13:45:00+00', '2026-10-19 13:45:00+00')
on conflict do nothing;

-- 4. Procedimentos (odontograma_eventos, como salvar_eventos_odontograma).
--    Regras do schema respeitadas: nivel 'face' exige faces; 'dente' exige faces vazias;
--    realizado_em só com status 'realizado'; próxima sessão só com 'indicado'.
insert into public.odontograma_eventos
  (id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status, origem,
   nivel, dente, faces, observacao, realizado_em, registrado_em, created_at, detalhe,
   encaminhado_para, assinatura_id, momento_planejado, procedimento_id, procedimento_nome)
values
  -- E1 · 26 MOD · planejado
  ('e0000000-0000-4000-8000-000000000341', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 26, array['M','O','D'],
   'Paciente relata sensibilidade ao frio. Usar isolamento absoluto.',
   null, '2026-10-12', '2026-10-12 13:20:00+00', null, null, null, 'sessao_atual', null,
   'Restauração em resina'),
  -- E2 · 36 O · planejado para a próxima sessão
  ('e0000000-0000-4000-8000-000000000342', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 36, array['O'],
   'Etapa posterior prevista no plano de tratamento (após a endodontia).',
   null, '2026-10-12', '2026-10-12 13:21:00+00', null, null, null, 'proxima_sessao', null,
   'Restauração em resina'),
  -- E3 · 46 DO · concluído em 19/10 e ASSINADO (S2)
  ('e0000000-0000-4000-8000-000000000343', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'carie_restauracao', 'realizado', 'clinica',
   'face', 46, array['D','O'],
   'Restauração concluída sem intercorrências. Ajuste oclusal feito.',
   '2026-10-19', '2026-10-12', '2026-10-12 13:22:00+00', null, null,
   'e0000000-0000-4000-8000-000000000331', 'sessao_atual', null, 'Restauração em resina'),
  -- E4 · 36 endodontia 1ª etapa · concluída em 19/10 · com tabela de canais
  ('e0000000-0000-4000-8000-000000000344', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000349',
   'endodontia', 'realizado', 'clinica', 'dente', 36, '{}',
   'Abertura, odontometria e preparo químico-mecânico. Curativo de demora.',
   '2026-10-19', '2026-10-12', '2026-10-12 13:23:00+00',
   '{"canais":[{"nome":"MV","referencia":"cúspide MV","comprimentoRaiz":21,"limaInicial":"#15","limaFinal":"#35"},{"nome":"ML","referencia":"cúspide ML","comprimentoRaiz":20.5,"limaInicial":"#15","limaFinal":"#35"},{"nome":"D","referencia":"cúspide DV","comprimentoRaiz":22,"limaInicial":"#20","limaFinal":"#40"}],"obturacao":null,"cimento":null}'::jsonb,
   null, null, 'sessao_atual', null, 'Tratamento endodôntico'),
  -- E5 · 36 endodontia obturação · planejado para a próxima sessão (mesmo grupo: "em andamento")
  ('e0000000-0000-4000-8000-000000000345', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000349',
   'endodontia', 'indicado', 'clinica', 'dente', 36, '{}',
   'Obturação na próxima sessão; trocar curativo se houver sintomatologia.',
   null, '2026-10-19', '2026-10-19 13:30:00+00', null, null, null, 'proxima_sessao', null,
   'Tratamento endodôntico'),
  -- E6 · 16 extração · planejado · ENCAMINHADO ao Dr. Carlos (a autora continua a Dra. Ana)
  ('e0000000-0000-4000-8000-000000000346', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'exodontia', 'indicado', 'clinica',
   'dente', 16, '{}',
   'Encaminhado para avaliação cirúrgica (raiz residual).',
   null, '2026-10-22', '2026-10-22 17:10:00+00', null,
   'c0000000-0000-4000-8000-0000000000d1', null, 'sessao_atual', null, 'Extração'),
  -- E7 · boca · profilaxia · concluída em 22/10
  ('e0000000-0000-4000-8000-000000000347', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientação de higiene.',
   '2026-10-22', '2026-10-22', '2026-10-22 17:15:00+00', null, null, null, 'sessao_atual', null,
   'Profilaxia')
on conflict do nothing;

-- 5. Vínculo sessão ↔ procedimento (atendimento_eventos; papel registrado/realizado).
--    UNIQUE(evento_id, papel): cada evento tem no máximo um "registrado" e um "realizado".
insert into public.atendimento_eventos (clinica_id, atendimento_id, evento_id, papel, created_at)
values
  -- S1 registrou o plano
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000311', 'e0000000-0000-4000-8000-000000000341', 'registrado', '2026-10-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000311', 'e0000000-0000-4000-8000-000000000342', 'registrado', '2026-10-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000311', 'e0000000-0000-4000-8000-000000000343', 'registrado', '2026-10-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000311', 'e0000000-0000-4000-8000-000000000344', 'registrado', '2026-10-12 13:40:00+00'),
  -- S2 realizou 46 e a 1ª etapa do 36; registrou a etapa seguinte
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000312', 'e0000000-0000-4000-8000-000000000343', 'realizado', '2026-10-19 13:50:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000312', 'e0000000-0000-4000-8000-000000000344', 'realizado', '2026-10-19 13:50:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000312', 'e0000000-0000-4000-8000-000000000345', 'registrado', '2026-10-19 13:50:00+00'),
  -- S3 encaminhou o 16 e fez a profilaxia
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000313', 'e0000000-0000-4000-8000-000000000346', 'registrado', '2026-10-22 17:30:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000313', 'e0000000-0000-4000-8000-000000000347', 'registrado', '2026-10-22 17:30:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000313', 'e0000000-0000-4000-8000-000000000347', 'realizado', '2026-10-22 17:30:00+00')
on conflict do nothing;

-- 6. Evolução de cada sessão (ficha_evolucoes; é o que liga a sessão à ficha no Prontuário)
insert into public.ficha_evolucoes
  (id, clinica_id, ficha_id, dentista_id, data, texto, automatica, atendimento_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000321', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-12',
   'Avaliação e planejamento. Dor ao frio no 26; lesão no 36 com indicação endodôntica; restauração deficiente no 46; raiz residual do 16.',
   false, 'e0000000-0000-4000-8000-000000000311', '2026-10-12 13:40:00+00', '2026-10-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000322', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-19',
   'Restauração do 46 concluída. Iniciado tratamento endodôntico do 36 (3 canais). Paciente assinou a conclusão do 46.',
   false, 'e0000000-0000-4000-8000-000000000312', '2026-10-19 13:50:00+00', '2026-10-19 13:50:00+00'),
  ('e0000000-0000-4000-8000-000000000323', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-22',
   'Profilaxia. Encaminhado ao Dr. Carlos para avaliar a extração do 16. Sem queixas no 36.',
   false, 'e0000000-0000-4000-8000-000000000313', '2026-10-22 17:30:00+00', '2026-10-22 17:30:00+00')
on conflict do nothing;

-- 7. Documentos fictícios (Arquivos do paciente). As URLs são `example.invalid`: o item
--    aparece na lista, mas abrir o arquivo falha de propósito (não há arquivo no Storage).
insert into public.paciente_documentos
  (id, clinica_id, paciente_id, nome, url, categoria, origem, tipo_documento, dentista_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000351', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'Conclusão de procedimento · 46 (fictício).pdf',
   'https://uhuxteswtvgdnlixwrdu.supabase.co/storage/v1/object/public/ficticio-od003/od003/conclusao-46.pdf', 'Documentos', 'fixture-od003',
   'conclusao_procedimento', 'b0000000-0000-4000-8000-0000000000a1',
   '2026-10-19 13:46:00+00', '2026-10-19 13:46:00+00'),
  ('e0000000-0000-4000-8000-000000000353', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'Radiografia periapical 36 (fictícia).png',
   'https://uhuxteswtvgdnlixwrdu.supabase.co/storage/v1/object/public/ficticio-od003/od003/rx-36.png', 'Radiografias', 'fixture-od003',
   null, 'b0000000-0000-4000-8000-0000000000a1',
   '2026-10-19 13:10:00+00', '2026-10-19 13:10:00+00')
on conflict do nothing;

-- 8. Documento assinado da sessão S2 (documentos_aceite tipo 'conclusao_procedimento';
--    o Prontuário liga o documento à sessão pelos eventoIds do snapshot).
insert into public.documentos_aceite
  (id, clinica_id, paciente_id, dentista_id, ficha_id, orcamento_id, assinatura_id, tipo,
   template_versao, template_hash, conteudo_snapshot, assinatura_paciente_ref, assinado_por,
   assinado_em, pdf_path, paciente_documento_id)
values
  ('e0000000-0000-4000-8000-000000000352', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000301', null, 'e0000000-0000-4000-8000-000000000331',
   'conclusao_procedimento', 'fixture-od003', 'fixture-od003-sem-hash-real',
   '{"ficticio":true,"eventoIds":["e0000000-0000-4000-8000-000000000343"],"resumo":"46 · Restauração em resina · DO · concluída em 19/10/2026"}'::jsonb,
   'ficticio:od003:assinatura-s2', 'Paciente Fluxo Local (assinatura fictícia)',
   '2026-10-19 13:45:00+00', 'fixtures/od003/conclusao-46.pdf',
   'e0000000-0000-4000-8000-000000000351')
on conflict do nothing;

-- =====================================================================================
-- OD-004 · ORC1 em RASCUNHO na ficha F1 (como criar_orcamento_com_eventos)
-- =====================================================================================
insert into public.orcamentos
  (id, clinica_id, ficha_id, paciente_id, dentista_id, status, validade_dias, total,
   desconto, mostrar_valor_por_item, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000401', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-0000000000a2',
   'b0000000-0000-4000-8000-0000000000a1', 'rascunho', 30, 600.00, 0, true,
   '2026-10-19 14:00:00+00', '2026-10-19 14:00:00+00')
on conflict do nothing;

insert into public.orcamento_itens
  (id, clinica_id, orcamento_id, procedimento_id, descricao, dente, quantidade,
   preco_unitario, preco_total, aprovado, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000411', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000401', null, 'Restauração em resina — D26 (MOD)', '26', 1,
   350.00, 350.00, false, '2026-10-19 14:00:01+00', '2026-10-19 14:00:01+00'),
  ('e0000000-0000-4000-8000-000000000412', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000401', null, 'Restauração em resina — D36 (O)', '36', 1,
   250.00, 250.00, false, '2026-10-19 14:00:02+00', '2026-10-19 14:00:02+00')
on conflict do nothing;

-- Vínculos item ↔ evento (o gatilho exige: evento da mesma ficha, origem clínica, do
-- mesmo dentista e não encaminhado; por isso o E6, encaminhado ao Dr. Carlos, fica fora).
insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id, item_id, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000401',
   'e0000000-0000-4000-8000-000000000341', 'e0000000-0000-4000-8000-000000000411', '2026-10-19 14:00:03+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000401',
   'e0000000-0000-4000-8000-000000000342', 'e0000000-0000-4000-8000-000000000412', '2026-10-19 14:00:03+00')
on conflict do nothing;

-- =====================================================================================
-- OD-004 · Ficha F2 do Paciente Teste Dois + ORC2 ACEITO com cobrança e pagamentos
-- =====================================================================================
insert into public.fichas
  (id, clinica_id, paciente_id, dentista_id, status, nome, origem, data_atendimento,
   anotacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000501', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'aberta', 'Tratamento restaurador', 'manual', '2026-10-20',
   'Restaurações estéticas 11/21 e coroa no 14.', '2026-10-20 12:00:00+00', '2026-10-20 12:30:00+00')
on conflict do nothing;

insert into public.atendimentos_clinicos
  (id, clinica_id, paciente_id, dentista_id, agendamento_id, chave_idempotencia,
   data_atendimento, origem, estado, finalizado_em, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000511', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000591', '2026-10-20', 'meu_dia', 'finalizado',
   '2026-10-20 12:30:00+00', '2026-10-20 12:00:00+00', '2026-10-20 12:30:00+00')
on conflict do nothing;

insert into public.odontograma_eventos
  (id, clinica_id, paciente_id, dentista_id, ficha_id, tipo, status, origem, nivel, dente,
   faces, observacao, registrado_em, created_at, momento_planejado, procedimento_nome)
values
  ('e0000000-0000-4000-8000-000000000541', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000501', 'carie_restauracao', 'indicado', 'clinica', 'face', 11,
   array['V'], 'Faceta direta em resina, cor A1.', '2026-10-20', '2026-10-20 12:10:00+00',
   'sessao_atual', 'Restauração em resina'),
  ('e0000000-0000-4000-8000-000000000542', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000501', 'carie_restauracao', 'indicado', 'clinica', 'face', 21,
   array['V'], 'Faceta direta em resina, cor A1.', '2026-10-20', '2026-10-20 12:11:00+00',
   'sessao_atual', 'Restauração em resina'),
  ('e0000000-0000-4000-8000-000000000543', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000501', 'coroa', 'indicado', 'clinica', 'dente', 14,
   '{}', 'Coroa total metalocerâmica.', '2026-10-20', '2026-10-20 12:12:00+00',
   'sessao_atual', 'Coroa total')
on conflict do nothing;

insert into public.atendimento_eventos (clinica_id, atendimento_id, evento_id, papel, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000511', 'e0000000-0000-4000-8000-000000000541', 'registrado', '2026-10-20 12:30:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000511', 'e0000000-0000-4000-8000-000000000542', 'registrado', '2026-10-20 12:30:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000511', 'e0000000-0000-4000-8000-000000000543', 'registrado', '2026-10-20 12:30:00+00')
on conflict do nothing;

insert into public.ficha_evolucoes
  (id, clinica_id, ficha_id, dentista_id, data, texto, automatica, atendimento_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000521', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000501', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-20',
   'Planejamento estético. Paciente aceitou o orçamento com entrada e três parcelas.',
   false, 'e0000000-0000-4000-8000-000000000511', '2026-10-20 12:30:00+00', '2026-10-20 12:30:00+00')
on conflict do nothing;

-- ORC2: status 'aprovado' + itens aprovados (como alternarAprovacaoItem/aprovarTodosItens).
-- O desconto fica na cobrança por etapa (a view orcamentos_com_estado usa o desconto da
-- etapa aberta quando ela existe), por isso orcamentos.desconto = 0.
insert into public.orcamentos
  (id, clinica_id, ficha_id, paciente_id, dentista_id, status, validade_dias, total,
   desconto, aprovado_por_id, aprovado_em, enviado_em, mostrar_valor_por_item, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000402', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000501', 'b0000000-0000-4000-8000-0000000000a4',
   'b0000000-0000-4000-8000-0000000000a1', 'aprovado', 30, 2100.00, 0,
   'b0000000-0000-4000-8000-0000000000a1', '2026-10-20 12:40:00+00', '2026-10-20 12:35:00+00',
   true, '2026-10-20 12:31:00+00', '2026-10-20 12:45:00+00')
on conflict do nothing;

insert into public.orcamento_itens
  (id, clinica_id, orcamento_id, procedimento_id, descricao, dente, quantidade,
   preco_unitario, preco_total, aprovado, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000421', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', null, 'Restauração em resina — D11 (V)', '11', 1,
   300.00, 300.00, true, '2026-10-20 12:31:01+00', '2026-10-20 12:38:00+00'),
  ('e0000000-0000-4000-8000-000000000422', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', null, 'Restauração em resina — D21 (V)', '21', 1,
   300.00, 300.00, true, '2026-10-20 12:31:02+00', '2026-10-20 12:38:00+00'),
  ('e0000000-0000-4000-8000-000000000423', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', null, 'Coroa total — D14', '14', 1,
   1500.00, 1500.00, true, '2026-10-20 12:31:03+00', '2026-10-20 12:38:00+00')
on conflict do nothing;

insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id, item_id, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000402',
   'e0000000-0000-4000-8000-000000000541', 'e0000000-0000-4000-8000-000000000421', '2026-10-20 12:31:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000402',
   'e0000000-0000-4000-8000-000000000542', 'e0000000-0000-4000-8000-000000000422', '2026-10-20 12:31:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000402',
   'e0000000-0000-4000-8000-000000000543', 'e0000000-0000-4000-8000-000000000423', '2026-10-20 12:31:04+00')
on conflict do nothing;

-- Aceite assinado (como aceitar_orcamento: assinaturas tipo 'orcamento' + termos_snapshot
-- no mesmo formato da RPC). Sem documentos_aceite de orçamento: "Abrir PDF assinado" não
-- se aplica a este dado fictício.
insert into public.assinaturas
  (id, clinica_id, paciente_id, tipo, ficha_id, orcamento_id, dentista_id, assinado_por,
   cro_no_ato, assinatura_ref, assinado_em, created_at, termos_snapshot)
values
  ('e0000000-0000-4000-8000-000000000451', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'orcamento', null,
   'e0000000-0000-4000-8000-000000000402', 'b0000000-0000-4000-8000-0000000000a1',
   'Paciente Teste Dois (assinatura fictícia)', 'CRO-FICTICIO-0001',
   'ficticio:od004:aceite-orc2', '2026-10-20 12:40:00+00', '2026-10-20 12:40:00+00',
   '{"versao":2,"subtotal":2100.00,"valorAprovado":2100.00,"desconto":0,"total":2000.00,"validadeDias":30,"condicoesPagamento":null,"mostrarValorPorItem":true,"estadoNoAto":"aceito","itens":[{"descricao":"Restauração em resina — D11 (V)","dente":"11","quantidade":1,"precoUnitario":300.00,"precoTotal":300.00,"composicao":null},{"descricao":"Restauração em resina — D21 (V)","dente":"21","quantidade":1,"precoUnitario":300.00,"precoTotal":300.00,"composicao":null},{"descricao":"Coroa total — D14","dente":"14","quantidade":1,"precoUnitario":1500.00,"precoTotal":1500.00,"composicao":null}],"ficticio":true}'::jsonb)
on conflict do nothing;

-- Cobrança por etapa (como criar_cobranca_orcamento): subtotal 2100, desconto 100,
-- final 2000, entrada 500 Pix já registrada, restante 1500 em 3 parcelas "acordo".
insert into public.orcamento_cobrancas
  (id, clinica_id, orcamento_id, paciente_id, dentista_id, subtotal, desconto, valor_final,
   numero_parcelas, primeiro_vencimento, situacao, observacoes, entrada_valor, entrada_forma,
   entrada_registrada, parcelas_forma, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000431', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', 'b0000000-0000-4000-8000-0000000000a4',
   'b0000000-0000-4000-8000-0000000000a1', 2100.00, 100.00, 2000.00, 3, '2026-10-20',
   'aberta', 'Desconto de R$ 100 combinado na consulta (fictício).', 500.00, 'pix', true,
   'acordo', '2026-10-20 12:42:00+00', '2026-10-20 12:42:00+00')
on conflict do nothing;

insert into public.orcamento_cobranca_itens
  (cobranca_id, orcamento_item_id, clinica_id, preco_total_snapshot, ativo, created_at)
values
  ('e0000000-0000-4000-8000-000000000431', 'e0000000-0000-4000-8000-000000000421', 'b0000000-0000-4000-8000-000000000001', 300.00, true, '2026-10-20 12:42:00+00'),
  ('e0000000-0000-4000-8000-000000000431', 'e0000000-0000-4000-8000-000000000422', 'b0000000-0000-4000-8000-000000000001', 300.00, true, '2026-10-20 12:42:00+00'),
  ('e0000000-0000-4000-8000-000000000431', 'e0000000-0000-4000-8000-000000000423', 'b0000000-0000-4000-8000-000000000001', 1500.00, true, '2026-10-20 12:42:00+00')
on conflict do nothing;

-- Pagamentos: entrada paga + parcela 1/3 paga; 2/3 e 3/3 pendentes (mesma forma da RPC;
-- a parcela 1 está como recebida, como registrar_recebimento_cobranca deixaria).
insert into public.pagamentos
  (id, clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status,
   forma_pagamento, data_vencimento, data_pagamento, marcado_por_id, parcela_numero,
   total_parcelas, observacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000441', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000431',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   500.00, 'pago', 'pix', '2026-10-20', '2026-10-20', 'b0000000-0000-4000-8000-0000000000a1',
   null, null, 'Entrada da etapa', '2026-10-20 12:42:00+00', '2026-10-20 12:42:00+00'),
  ('e0000000-0000-4000-8000-000000000442', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000431',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   500.00, 'pago', 'pix', '2026-10-20', '2026-10-20', 'b0000000-0000-4000-8000-0000000000a1',
   1, 3, null, '2026-10-20 12:42:00+00', '2026-10-20 12:50:00+00'),
  ('e0000000-0000-4000-8000-000000000443', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000431',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   500.00, 'pendente', null, '2026-11-20', null, null,
   2, 3, null, '2026-10-20 12:42:00+00', '2026-10-20 12:42:00+00'),
  ('e0000000-0000-4000-8000-000000000444', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000402', 'e0000000-0000-4000-8000-000000000431',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   500.00, 'pendente', null, '2026-12-20', null, null,
   3, 3, null, '2026-10-20 12:42:00+00', '2026-10-20 12:42:00+00')
on conflict do nothing;

-- Atividade do orçamento (ações reconhecidas pela aba Atividade do detalhe)
insert into public.activity_logs
  (id, clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata, created_at)
values
  ('e0000000-0000-4000-8000-000000000461', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a1', 'Dra. Ana Local', 'b0000000-0000-4000-8000-0000000000a4',
   'orcamento', 'e0000000-0000-4000-8000-000000000402', 'orcamento_aprovado',
   '{"ficticio":true}'::jsonb, '2026-10-20 12:40:00+00'),
  ('e0000000-0000-4000-8000-000000000462', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a1', 'Dra. Ana Local', 'b0000000-0000-4000-8000-0000000000a4',
   'orcamento', 'e0000000-0000-4000-8000-000000000402', 'cobranca.etapa_criada',
   '{"ficticio":true,"cobranca_id":"e0000000-0000-4000-8000-000000000431","subtotal":2100,"desconto":100,"valor_final":2000,"entrada_valor":500,"entrada_registrada":true,"numero_parcelas":3,"parcelas_forma":"acordo"}'::jsonb,
   '2026-10-20 12:42:00+00'),
  ('e0000000-0000-4000-8000-000000000463', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a1', 'Dra. Ana Local', 'b0000000-0000-4000-8000-0000000000a4',
   'orcamento', 'e0000000-0000-4000-8000-000000000402', 'pagamento.registrado',
   '{"ficticio":true,"pagamento_id":"e0000000-0000-4000-8000-000000000442","valor":500}'::jsonb,
   '2026-10-20 12:50:00+00')
on conflict do nothing;

-- ─── Conferência final (só leitura; aborta a transação se algo não bater) ──────────────
do $$
declare
  v_estado text; v_devido numeric; v_pago numeric;
begin
  select estado, valor_devido, valor_pago into v_estado, v_devido, v_pago
  from public.orcamentos_com_estado where id = 'e0000000-0000-4000-8000-000000000402';
  if v_estado is distinct from 'aceito' or v_devido is distinct from 2000.00 or v_pago is distinct from 1000.00 then
    raise exception 'OD-004 seed: ORC2 esperado aceito/2000/1000, veio %/%/%', v_estado, v_devido, v_pago;
  end if;
  select estado into v_estado from public.orcamentos_com_estado where id = 'e0000000-0000-4000-8000-000000000401';
  if v_estado is distinct from 'proposto' then
    raise exception 'OD-004 seed: ORC1 esperado proposto (rascunho), veio %', v_estado;
  end if;
  if (select count(*) from public.odontograma_eventos where ficha_id = 'e0000000-0000-4000-8000-000000000301') <> 7 then
    raise exception 'OD-003 seed: F1 deveria ter 7 procedimentos';
  end if;
  raise notice 'OD-003/004 seed ok: F1 com 7 procedimentos e 3 sessões; ORC1 proposto; ORC2 aceito (R$ 1.000 de R$ 2.000)';
end $$;

commit;
