-- =====================================================================================
-- OD-003f / OD-007 - Dados FICTICIOS extras para o QA (Ficha com linha do tempo por ficha
-- e Calendario do protetico)
-- Alvo: SOMENTE o projeto odonto-qa. NUNCA rodar em producao. Nenhum dado real. Texto em ASCII.
-- Autor: OD - Arquiteto, 2026-10-24. Escrito contra o schema usado no seed
-- od003-od004-seed.sql e o codigo atual; NAO foi executado por quem escreveu.
--
-- Pre-requisitos (o bloco 0 confere e aborta se faltar):
--   clinica    Clinica Local A        b0000000-0000-4000-8000-000000000001
--   dentista   Dra. Ana Local         b0000000-0000-4000-8000-0000000000a1
--   paciente   Paciente Teste Dois    b0000000-0000-4000-8000-0000000000a4
--   paciente   Paciente Fluxo Local   b0000000-0000-4000-8000-0000000000a2
--   protetico  protetico.a.qa@example.invalid  dentistas.id c0000000-0000-4000-8000-0000000000e2
--              (usuario c0000000-0000-4000-8000-0000000000e1), role 'protetico', mesma clinica
--
-- Nao mexe na ficha F1 nem na F2 do seed anterior (a conferencia dele conta 7 eventos na F1).
-- Idempotente: uma transacao, UUIDs fixos (prefixo e0000000, faixas ...06xx e ...07xx),
-- ON CONFLICT DO NOTHING, sem UPDATE nem DELETE.
--
-- --- O que cria ----------------------------------------------------------------------
-- OD-003f - Paciente Teste Dois
--   F3 ficha "Manutencao periodontal" (Dra. Ana, aberta)  ...0601
--      12 sessoes mensais S1..S12 (14/11/2025 a 16/10/2026)  ...0611 a ...061c
--      cada sessao: 1 procedimento de boca realizado (profilaxia ou fluor, ...0641 a ...064c)
--      com vinculo explicito em atendimento_eventos, e 1 evolucao (...0621 a ...062c)
--      -> testa "mais de 10 sessoes" (10 visiveis + "Mostrar sessoes anteriores (2)")
--   F4 ficha "Clareamento" (Dra. Ana, aberta)  ...0602
--      clareamento planejado (...064d) registrado na MESMA sessao S12 (16/10/2026),
--      com evolucao propria da F4 (...062d)
--      -> S12 toca F3 e F4: aparece nas duas fichas, cada uma com a sua parte
--   Todas as sessoes tem vinculo explicito: assim o Prontuario nao usa o fallback que
--   puxa os eventos da ficha para uma sessao sem vinculo (src/lib/prontuario/eventos-da-visita.ts).
--
-- OD-007 - pedidos_protetico para o protetico ...00e2 (dentista responsavel: Dra. Ana)
--   P1 NO PRAZO   pendente, entrega 2026-11-05 (Paciente Teste Dois)   ...0701
--   P2 ATRASADO   pendente, entrega 2026-10-20 (Paciente Fluxo Local)  ...0702
--   P3 ENTREGUE   entregue em 2026-10-21, entrega 2026-10-22 (Paciente Teste Dois) ...0703
--   Atencao: "no prazo" e "atrasado" sao calculados pela data de hoje. O P1 deixa de estar
--   no prazo depois de 05/11/2026.
-- =====================================================================================

begin;

-- --- 0. Conferencia dos pre-requisitos (aborta tudo se faltar algo) -------------------
do $$
declare
  v_clinica constant uuid := 'b0000000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.clinicas where id = v_clinica) then
    raise exception 'OD-003f/007 seed: clinica % nao existe no odonto-qa', v_clinica;
  end if;
  if not exists (select 1 from public.dentistas where id = 'b0000000-0000-4000-8000-0000000000a1' and clinica_id = v_clinica) then
    raise exception 'OD-003f/007 seed: Dra. Ana Local nao existe nesta clinica';
  end if;
  if not exists (select 1 from public.pacientes where id = 'b0000000-0000-4000-8000-0000000000a4' and clinica_id = v_clinica) then
    raise exception 'OD-003f/007 seed: Paciente Teste Dois nao existe nesta clinica';
  end if;
  if not exists (select 1 from public.pacientes where id = 'b0000000-0000-4000-8000-0000000000a2' and clinica_id = v_clinica) then
    raise exception 'OD-003f/007 seed: Paciente Fluxo Local nao existe nesta clinica';
  end if;
  if not exists (select 1 from public.dentistas where id = 'c0000000-0000-4000-8000-0000000000e2' and clinica_id = v_clinica and role = 'protetico') then
    raise exception 'OD-003f/007 seed: protetico c0000000-...-0000000000e2 (role protetico) nao existe nesta clinica; criar a conta antes';
  end if;
end $$;

-- =====================================================================================
-- OD-003f - Fichas F3 e F4 do Paciente Teste Dois
-- =====================================================================================
insert into public.fichas
  (id, clinica_id, paciente_id, dentista_id, status, nome, origem, data_atendimento,
   anotacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'aberta', 'Manutencao periodontal', 'manual', '2025-11-14',
   'Manutencao periodontal mensal com profilaxia e fluor (ficticio).',
   '2025-11-14 13:00:00+00', '2026-10-16 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000602', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'aberta', 'Clareamento', 'manual', '2026-10-16',
   'Clareamento caseiro planejado (ficticio).',
   '2026-10-16 13:30:00+00', '2026-10-16 13:40:00+00')
on conflict do nothing;

-- Sessoes (atendimentos_clinicos, finalizadas; sem agendamento)
insert into public.atendimentos_clinicos
  (id, clinica_id, paciente_id, dentista_id, agendamento_id, chave_idempotencia,
   data_atendimento, origem, estado, finalizado_em, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000611', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000691', '2025-11-14', 'meu_dia', 'finalizado',
   '2025-11-14 13:40:00+00', '2025-11-14 13:00:00+00', '2025-11-14 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000612', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000692', '2025-12-12', 'meu_dia', 'finalizado',
   '2025-12-12 13:40:00+00', '2025-12-12 13:00:00+00', '2025-12-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000613', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000693', '2026-01-16', 'meu_dia', 'finalizado',
   '2026-01-16 13:40:00+00', '2026-01-16 13:00:00+00', '2026-01-16 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000614', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000694', '2026-02-13', 'meu_dia', 'finalizado',
   '2026-02-13 13:40:00+00', '2026-02-13 13:00:00+00', '2026-02-13 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000615', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000695', '2026-03-13', 'meu_dia', 'finalizado',
   '2026-03-13 13:40:00+00', '2026-03-13 13:00:00+00', '2026-03-13 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000616', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000696', '2026-04-17', 'meu_dia', 'finalizado',
   '2026-04-17 13:40:00+00', '2026-04-17 13:00:00+00', '2026-04-17 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000617', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000697', '2026-05-15', 'meu_dia', 'finalizado',
   '2026-05-15 13:40:00+00', '2026-05-15 13:00:00+00', '2026-05-15 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000618', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000698', '2026-06-12', 'meu_dia', 'finalizado',
   '2026-06-12 13:40:00+00', '2026-06-12 13:00:00+00', '2026-06-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000619', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-000000000699', '2026-07-17', 'meu_dia', 'finalizado',
   '2026-07-17 13:40:00+00', '2026-07-17 13:00:00+00', '2026-07-17 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000061a', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-00000000069a', '2026-08-14', 'meu_dia', 'finalizado',
   '2026-08-14 13:40:00+00', '2026-08-14 13:00:00+00', '2026-08-14 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000061b', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-00000000069b', '2026-09-11', 'meu_dia', 'finalizado',
   '2026-09-11 13:40:00+00', '2026-09-11 13:00:00+00', '2026-09-11 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000061c', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1', null,
   'e0000000-0000-4000-8000-00000000069c', '2026-10-16', 'meu_dia', 'finalizado',
   '2026-10-16 13:40:00+00', '2026-10-16 13:00:00+00', '2026-10-16 13:40:00+00')
on conflict do nothing;

-- Procedimentos de boca (odontograma_eventos). nivel 'boca' exige dente null e faces vazias;
-- realizado_em so com status 'realizado'.
insert into public.odontograma_eventos
  (id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status, origem,
   nivel, dente, faces, observacao, realizado_em, registrado_em, created_at, detalhe,
   encaminhado_para, assinatura_id, momento_planejado, procedimento_id, procedimento_nome)
values
  ('e0000000-0000-4000-8000-000000000641', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2025-11-14', '2025-11-14', '2025-11-14 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-000000000642', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2025-12-12', '2025-12-12', '2025-12-12 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  ('e0000000-0000-4000-8000-000000000643', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2026-01-16', '2026-01-16', '2026-01-16 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-000000000644', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2026-02-13', '2026-02-13', '2026-02-13 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  ('e0000000-0000-4000-8000-000000000645', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2026-03-13', '2026-03-13', '2026-03-13 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-000000000646', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2026-04-17', '2026-04-17', '2026-04-17 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  ('e0000000-0000-4000-8000-000000000647', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2026-05-15', '2026-05-15', '2026-05-15 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-000000000648', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2026-06-12', '2026-06-12', '2026-06-12 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  ('e0000000-0000-4000-8000-000000000649', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2026-07-17', '2026-07-17', '2026-07-17 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-00000000064a', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2026-08-14', '2026-08-14', '2026-08-14 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  ('e0000000-0000-4000-8000-00000000064b', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'profilaxia', 'realizado', 'clinica',
   'boca', null, '{}', 'Profilaxia e orientacao de higiene (ficticio).',
   '2026-09-11', '2026-09-11', '2026-09-11 13:20:00+00', null, null, null, 'sessao_atual', null, 'Profilaxia'),
  ('e0000000-0000-4000-8000-00000000064c', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000601', null, 'fluor', 'realizado', 'clinica',
   'boca', null, '{}', 'Fluor gel neutro (ficticio).',
   '2026-10-16', '2026-10-16', '2026-10-16 13:20:00+00', null, null, null, 'sessao_atual', null, 'Aplicacao de fluor'),
  -- F4: clareamento planejado, registrado na S12
  ('e0000000-0000-4000-8000-00000000064d', 'b0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-0000000000a4', 'b0000000-0000-4000-8000-0000000000a1',
   'e0000000-0000-4000-8000-000000000602', null, 'clareamento', 'indicado', 'clinica',
   'boca', null, '{}', 'Clareamento caseiro com moldeira, 3 semanas (ficticio).',
   null, '2026-10-16', '2026-10-16 13:30:00+00', null, null, null, 'sessao_atual', null, 'Clareamento')
on conflict do nothing;

-- Vinculo sessao <-> procedimento (atendimento_eventos). UNIQUE(evento_id, papel).
insert into public.atendimento_eventos (clinica_id, atendimento_id, evento_id, papel, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000611', 'e0000000-0000-4000-8000-000000000641', 'registrado', '2025-11-14 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000611', 'e0000000-0000-4000-8000-000000000641', 'realizado', '2025-11-14 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000612', 'e0000000-0000-4000-8000-000000000642', 'registrado', '2025-12-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000612', 'e0000000-0000-4000-8000-000000000642', 'realizado', '2025-12-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000613', 'e0000000-0000-4000-8000-000000000643', 'registrado', '2026-01-16 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000613', 'e0000000-0000-4000-8000-000000000643', 'realizado', '2026-01-16 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000614', 'e0000000-0000-4000-8000-000000000644', 'registrado', '2026-02-13 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000614', 'e0000000-0000-4000-8000-000000000644', 'realizado', '2026-02-13 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000615', 'e0000000-0000-4000-8000-000000000645', 'registrado', '2026-03-13 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000615', 'e0000000-0000-4000-8000-000000000645', 'realizado', '2026-03-13 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000616', 'e0000000-0000-4000-8000-000000000646', 'registrado', '2026-04-17 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000616', 'e0000000-0000-4000-8000-000000000646', 'realizado', '2026-04-17 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000617', 'e0000000-0000-4000-8000-000000000647', 'registrado', '2026-05-15 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000617', 'e0000000-0000-4000-8000-000000000647', 'realizado', '2026-05-15 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000618', 'e0000000-0000-4000-8000-000000000648', 'registrado', '2026-06-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000618', 'e0000000-0000-4000-8000-000000000648', 'realizado', '2026-06-12 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000619', 'e0000000-0000-4000-8000-000000000649', 'registrado', '2026-07-17 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000619', 'e0000000-0000-4000-8000-000000000649', 'realizado', '2026-07-17 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061a', 'e0000000-0000-4000-8000-00000000064a', 'registrado', '2026-08-14 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061a', 'e0000000-0000-4000-8000-00000000064a', 'realizado', '2026-08-14 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061b', 'e0000000-0000-4000-8000-00000000064b', 'registrado', '2026-09-11 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061b', 'e0000000-0000-4000-8000-00000000064b', 'realizado', '2026-09-11 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061c', 'e0000000-0000-4000-8000-00000000064c', 'registrado', '2026-10-16 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061c', 'e0000000-0000-4000-8000-00000000064c', 'realizado', '2026-10-16 13:40:00+00'),
  -- S12 tambem registrou o clareamento da F4
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000061c', 'e0000000-0000-4000-8000-00000000064d', 'registrado', '2026-10-16 13:40:00+00')
on conflict do nothing;

-- Evolucoes (ficha_evolucoes: liga cada sessao a ficha no Prontuario). A S12 tem duas:
-- uma na F3 e outra na F4.
insert into public.ficha_evolucoes
  (id, clinica_id, ficha_id, dentista_id, data, texto, automatica, atendimento_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000621', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2025-11-14',
   'Avaliacao periodontal inicial. Sangramento leve em molares. Plano de manutencao mensal.',
   false, 'e0000000-0000-4000-8000-000000000611', '2025-11-14 13:40:00+00', '2025-11-14 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000622', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2025-12-12',
   'Profilaxia. Orientacao de fio dental. Melhora do sangramento.',
   false, 'e0000000-0000-4000-8000-000000000612', '2025-12-12 13:40:00+00', '2025-12-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000623', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-01-16',
   'Aplicacao de fluor. Paciente refere menos sensibilidade.',
   false, 'e0000000-0000-4000-8000-000000000613', '2026-01-16 13:40:00+00', '2026-01-16 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000624', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-02-13',
   'Profilaxia. Placa localizada na regiao lingual inferior.',
   false, 'e0000000-0000-4000-8000-000000000614', '2026-02-13 13:40:00+00', '2026-02-13 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000625', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-03-13',
   'Aplicacao de fluor. Controle de placa adequado.',
   false, 'e0000000-0000-4000-8000-000000000615', '2026-03-13 13:40:00+00', '2026-03-13 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000626', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-04-17',
   'Profilaxia. Sem sangramento a sondagem.',
   false, 'e0000000-0000-4000-8000-000000000616', '2026-04-17 13:40:00+00', '2026-04-17 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000627', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-05-15',
   'Aplicacao de fluor. Revisao da tecnica de escovacao.',
   false, 'e0000000-0000-4000-8000-000000000617', '2026-05-15 13:40:00+00', '2026-05-15 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000628', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-06-12',
   'Profilaxia. Gengiva estavel.',
   false, 'e0000000-0000-4000-8000-000000000618', '2026-06-12 13:40:00+00', '2026-06-12 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000629', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-07-17',
   'Aplicacao de fluor. Sem queixas.',
   false, 'e0000000-0000-4000-8000-000000000619', '2026-07-17 13:40:00+00', '2026-07-17 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000062a', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-08-14',
   'Profilaxia. Pequeno acumulo de calculo removido.',
   false, 'e0000000-0000-4000-8000-00000000061a', '2026-08-14 13:40:00+00', '2026-08-14 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000062b', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-09-11',
   'Aplicacao de fluor. Paciente pergunta sobre clareamento.',
   false, 'e0000000-0000-4000-8000-00000000061b', '2026-09-11 13:40:00+00', '2026-09-11 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000062c', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-16',
   'Profilaxia de manutencao. Planejado clareamento caseiro na ficha propria.',
   false, 'e0000000-0000-4000-8000-00000000061c', '2026-10-16 13:40:00+00', '2026-10-16 13:40:00+00'),
  ('e0000000-0000-4000-8000-00000000062d', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000602', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-16',
   'Planejamento do clareamento caseiro. Moldagem para moldeira na proxima sessao.',
   false, 'e0000000-0000-4000-8000-00000000061c', '2026-10-16 13:40:00+00', '2026-10-16 13:40:00+00')
on conflict do nothing;

-- =====================================================================================
-- OD-007 - Pedidos ao protetico (como criarPedidoProtetico grava; sem agendamento)
-- =====================================================================================
insert into public.pedidos_protetico
  (id, clinica_id, protetico_id, dentista_id, paciente_id, agendamento_id, observacao,
   data_entrega, status, entregue_em, created_at, updated_at)
values
  -- P1 no prazo
  ('e0000000-0000-4000-8000-000000000701', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000e2', 'b0000000-0000-4000-8000-0000000000a1',
   'b0000000-0000-4000-8000-0000000000a4', null, 'Coroa metalo-ceramica do 14, cor A2 (ficticio).',
   '2026-11-05', 'pendente', null, '2026-10-20 14:00:00+00', '2026-10-20 14:00:00+00'),
  -- P2 atrasado (entrega ja passou e continua pendente)
  ('e0000000-0000-4000-8000-000000000702', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000e2', 'b0000000-0000-4000-8000-0000000000a1',
   'b0000000-0000-4000-8000-0000000000a2', null, 'Provisorio em resina do 26 (ficticio).',
   '2026-10-20', 'pendente', null, '2026-10-12 14:00:00+00', '2026-10-12 14:00:00+00'),
  -- P3 entregue
  ('e0000000-0000-4000-8000-000000000703', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000e2', 'b0000000-0000-4000-8000-0000000000a1',
   'b0000000-0000-4000-8000-0000000000a4', null, 'Moldeira de clareamento superior e inferior (ficticio).',
   '2026-10-22', 'entregue', '2026-10-21 18:00:00+00', '2026-10-16 14:00:00+00', '2026-10-21 18:00:00+00')
on conflict do nothing;

-- --- Conferencia final (so leitura; aborta a transacao se algo nao bater) -------------
do $$
begin
  if (select count(distinct atendimento_id) from public.ficha_evolucoes
      where ficha_id = 'e0000000-0000-4000-8000-000000000601') <> 12 then
    raise exception 'OD-003f seed: F3 deveria ter 12 sessoes';
  end if;
  if (select count(distinct ficha_id) from public.ficha_evolucoes
      where atendimento_id = 'e0000000-0000-4000-8000-00000000061c') <> 2 then
    raise exception 'OD-003f seed: a sessao S12 deveria tocar 2 fichas (F3 e F4)';
  end if;
  if (select count(*) from public.pedidos_protetico
      where protetico_id = 'c0000000-0000-4000-8000-0000000000e2'
        and id in ('e0000000-0000-4000-8000-000000000701', 'e0000000-0000-4000-8000-000000000702', 'e0000000-0000-4000-8000-000000000703')) <> 3 then
    raise exception 'OD-007 seed: deveria haver 3 pedidos para o protetico';
  end if;
  raise notice 'OD-003f/007 seed ok: F3 com 12 sessoes; S12 em F3 e F4; 3 pedidos do protetico (no prazo, atrasado, entregue)';
end $$;

commit;
