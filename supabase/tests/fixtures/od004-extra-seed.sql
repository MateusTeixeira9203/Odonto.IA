-- =====================================================================================
-- OD-004 - Dados FICTICIOS extras para o QA do Orcamento (pedido do Revisor, 24/10)
-- Alvo: SOMENTE o projeto odonto-qa. NUNCA rodar em producao. Nenhum dado real. Texto em ASCII.
-- Autor: OD - Arquiteto, 2026-10-24. Escrito contra as migrations do repositorio e o codigo
-- atual; NAO foi executado por quem escreveu. Nao toca ORC1 nem ORC2 (od003-od004-seed.sql).
--
-- Pre-requisitos (o bloco 0 confere e aborta se faltar):
--   clinica   Clinica Local A   b0000000-0000-4000-8000-000000000001
--   dentista  Dra. Ana Local    b0000000-0000-4000-8000-0000000000a1
--
-- Cria um paciente ficticio novo, "Paciente Orcamento QA" (...0801), so com id, clinica,
-- nome e dentista. Se o odonto-qa exigir outra coluna obrigatoria em pacientes, a transacao
-- aborta inteira no primeiro insert (nada fica pela metade): avisar o Arquiteto.
-- Idempotente: uma transacao, UUIDs fixos (prefixo e0000000, faixa ...08xx),
-- ON CONFLICT DO NOTHING, sem UPDATE nem DELETE.
--
-- --- O que cria (um caso por ficha, para nao misturar) -------------------------------
-- (1) QUITADO   ficha FQ "Restauracao 26" (...0811), sessao (...0861)
--               ORC-Q (...0831): 1 item aprovado 26 MOD R$ 400 (...0841), sem cobranca por
--               etapa (fluxo antigo), 1 pagamento PAGO de R$ 400 Pix (...0851)
--               Esperado: estado "Quitado" (devido 400, pago 400)
-- (2) GRUPO     ficha FG "Estetica anterior" (...0812), sessao (...0862)
--               eventos 11 V (...0822), 21 V (...0823), 14 coroa (...0824)
--               ORC-G (...0832) proposto: item GRUPO "Restauracoes 11 e 21 (preco fechado)"
--               R$ 500 com composicao de 2 membros (...0842) + item normal coroa 14 R$ 1.200
--               (...0843). Total R$ 1.700. Sem desconto (grupo nao aceita desconto global).
--               Esperado: grupo visivel, "Editar itens" bloqueado com a dica (O32)
-- (3) SEM ITENS ORC-V (...0833) avulso (sem ficha), proposto, total 0, nenhum item
--               Esperado: detalhe com "Nenhum procedimento registrado." (O30)
-- (4) DIFERENCAS ficha FD "Restauracoes posteriores" (...0814), sessao (...0864)
--               ORC-D (...0834) proposto, com 3 itens ligados a 3 eventos:
--                 36 O  normal                        evento ...0825 / item ...0844
--                 46 O  RENOMEADO na ficha depois do orcamento
--                       (agora "Restauracao em resina composta")  evento ...0827 / item ...0845
--                 47 O  RETIRADO da ficha e ainda no orcamento    evento ...0828 / item ...0846
--               e 1 evento da ficha FORA do orcamento: 37 O (...0826) -> "faltando"
--               Esperado no painel de revisao (O31): 1 faltando, 1 renomeado, 1 retirado
-- =====================================================================================

begin;

-- --- 0. Conferencia dos pre-requisitos ----------------------------------------------
do $$
begin
  if not exists (select 1 from public.clinicas where id = 'b0000000-0000-4000-8000-000000000001') then
    raise exception 'OD-004 extra seed: clinica Local A nao existe no odonto-qa';
  end if;
  if not exists (select 1 from public.dentistas where id = 'b0000000-0000-4000-8000-0000000000a1'
                 and clinica_id = 'b0000000-0000-4000-8000-000000000001') then
    raise exception 'OD-004 extra seed: Dra. Ana Local nao existe nesta clinica';
  end if;
end $$;

-- --- 1. Paciente ficticio -----------------------------------------------------------
insert into public.pacientes (id, clinica_id, nome, dentista_id)
values ('e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-000000000001', 'Paciente Orcamento QA', 'b0000000-0000-4000-8000-0000000000a1')
on conflict do nothing;

-- --- 2. Fichas (uma por caso) -------------------------------------------------------
insert into public.fichas
  (id, clinica_id, paciente_id, dentista_id, status, nome, origem, data_atendimento,
   anotacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000811', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'aberta', 'Restauracao 26', 'manual', '2026-10-05',
   'Caso de teste: orcamento quitado (ficticio).', '2026-10-05 13:00:00+00', '2026-10-10 13:00:00+00'),
  ('e0000000-0000-4000-8000-000000000812', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'aberta', 'Estetica anterior', 'manual', '2026-10-06',
   'Caso de teste: orcamento com grupo de preco fechado (ficticio).', '2026-10-06 13:00:00+00', '2026-10-06 13:30:00+00'),
  ('e0000000-0000-4000-8000-000000000814', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'aberta', 'Restauracoes posteriores', 'manual', '2026-10-07',
   'Caso de teste: diferencas entre ficha e orcamento (ficticio).', '2026-10-07 13:00:00+00', '2026-10-15 13:00:00+00')
on conflict do nothing;

-- --- 3. Sessoes (para as fichas aparecerem no Prontuario) ---------------------------
insert into public.atendimentos_clinicos
  (id, clinica_id, paciente_id, dentista_id, agendamento_id, chave_idempotencia,
   data_atendimento, origem, estado, finalizado_em, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000861', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', null, 'e0000000-0000-4000-8000-000000000891', '2026-10-05', 'meu_dia', 'finalizado',
   '2026-10-05 13:40:00+00', '2026-10-05 13:00:00+00', '2026-10-05 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000862', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', null, 'e0000000-0000-4000-8000-000000000892', '2026-10-06', 'meu_dia', 'finalizado',
   '2026-10-06 13:40:00+00', '2026-10-06 13:00:00+00', '2026-10-06 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000864', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', null, 'e0000000-0000-4000-8000-000000000894', '2026-10-07', 'meu_dia', 'finalizado',
   '2026-10-07 13:40:00+00', '2026-10-07 13:00:00+00', '2026-10-07 13:40:00+00')
on conflict do nothing;

-- --- 4. Procedimentos (odontograma_eventos) -----------------------------------------
-- nivel 'face' exige faces; 'dente' exige faces vazias; realizado_em so com 'realizado'.
-- O 47 (...0828) ja nasce RETIRADO (retirado_em/retirado_por), como a retirada da ficha deixaria;
-- o vinculo com o orcamento nao exige evento ativo, entao ele entra sem UPDATE.
insert into public.odontograma_eventos
  (id, clinica_id, paciente_id, dentista_id, ficha_id, grupo_id, tipo, status, origem,
   nivel, dente, faces, observacao, realizado_em, registrado_em, created_at, detalhe,
   encaminhado_para, assinatura_id, momento_planejado, procedimento_id, procedimento_nome,
   retirado_em, retirado_por)
values
  -- (1) quitado: 26 MOD realizado
  ('e0000000-0000-4000-8000-000000000821', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000811', null, 'carie_restauracao', 'realizado', 'clinica',
   'face', 26, array['M','O','D'], 'Restauracao concluida (ficticio).',
   '2026-10-10', '2026-10-05', '2026-10-05 13:20:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', null, null),
  -- (2) grupo: 11 V, 21 V, coroa 14
  ('e0000000-0000-4000-8000-000000000822', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000812', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 11, array['V'], 'Faceta direta em resina (ficticio).',
   null, '2026-10-06', '2026-10-06 13:10:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', null, null),
  ('e0000000-0000-4000-8000-000000000823', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000812', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 21, array['V'], 'Faceta direta em resina (ficticio).',
   null, '2026-10-06', '2026-10-06 13:11:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', null, null),
  ('e0000000-0000-4000-8000-000000000824', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000812', null, 'coroa', 'indicado', 'clinica',
   'dente', 14, '{}', 'Coroa total ceramica (ficticio).',
   null, '2026-10-06', '2026-10-06 13:12:00+00', null, null, null, 'sessao_atual', null,
   'Coroa total', null, null),
  -- (4) diferencas
  ('e0000000-0000-4000-8000-000000000825', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000814', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 36, array['O'], 'Restauracao oclusal (ficticio).',
   null, '2026-10-07', '2026-10-07 13:10:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', null, null),
  ('e0000000-0000-4000-8000-000000000826', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000814', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 37, array['O'], 'Acrescentado na ficha depois do orcamento (ficticio).',
   null, '2026-10-12', '2026-10-12 13:10:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', null, null),
  ('e0000000-0000-4000-8000-000000000827', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000814', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 46, array['O'], 'Nome do procedimento alterado na ficha em 14/10 (ficticio).',
   null, '2026-10-07', '2026-10-07 13:11:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina composta', null, null),
  ('e0000000-0000-4000-8000-000000000828', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-000000000814', null, 'carie_restauracao', 'indicado', 'clinica',
   'face', 47, array['O'], 'Retirado da ficha em 15/10 (ficticio).',
   null, '2026-10-07', '2026-10-07 13:12:00+00', null, null, null, 'sessao_atual', null,
   'Restauracao em resina', '2026-10-15 13:00:00+00', 'b0000000-0000-4000-8000-0000000000a1')
on conflict do nothing;

-- --- 5. Vinculo sessao <-> procedimento ---------------------------------------------
insert into public.atendimento_eventos (clinica_id, atendimento_id, evento_id, papel, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000861', 'e0000000-0000-4000-8000-000000000821', 'registrado', '2026-10-05 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000861', 'e0000000-0000-4000-8000-000000000821', 'realizado',  '2026-10-05 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000862', 'e0000000-0000-4000-8000-000000000822', 'registrado', '2026-10-06 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000862', 'e0000000-0000-4000-8000-000000000823', 'registrado', '2026-10-06 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000862', 'e0000000-0000-4000-8000-000000000824', 'registrado', '2026-10-06 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000864', 'e0000000-0000-4000-8000-000000000825', 'registrado', '2026-10-07 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000864', 'e0000000-0000-4000-8000-000000000827', 'registrado', '2026-10-07 13:40:00+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000864', 'e0000000-0000-4000-8000-000000000828', 'registrado', '2026-10-07 13:40:00+00')
on conflict do nothing;

insert into public.ficha_evolucoes
  (id, clinica_id, ficha_id, dentista_id, data, texto, automatica, atendimento_id, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000871', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000811', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-05', 'Planejamento da restauracao do 26 (ficticio).',
   false, 'e0000000-0000-4000-8000-000000000861', '2026-10-05 13:40:00+00', '2026-10-05 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000872', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000812', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-06', 'Planejamento estetico 11, 21 e coroa 14 (ficticio).',
   false, 'e0000000-0000-4000-8000-000000000862', '2026-10-06 13:40:00+00', '2026-10-06 13:40:00+00'),
  ('e0000000-0000-4000-8000-000000000874', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000814', 'b0000000-0000-4000-8000-0000000000a1', '2026-10-07', 'Planejamento das restauracoes 36, 46 e 47 (ficticio).',
   false, 'e0000000-0000-4000-8000-000000000864', '2026-10-07 13:40:00+00', '2026-10-07 13:40:00+00')
on conflict do nothing;

-- --- 6. Orcamentos ------------------------------------------------------------------
insert into public.orcamentos
  (id, clinica_id, ficha_id, paciente_id, dentista_id, status, validade_dias, total,
   desconto, aprovado_por_id, aprovado_em, mostrar_valor_por_item, created_at, updated_at)
values
  -- (1) quitado (status declarado nao importa: o estado vem dos fatos)
  ('e0000000-0000-4000-8000-000000000831', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000811', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'aprovado', 30, 400.00, 0, 'b0000000-0000-4000-8000-0000000000a1', '2026-10-05 14:00:00+00',
   true, '2026-10-05 13:50:00+00', '2026-10-10 14:00:00+00'),
  -- (2) grupo
  ('e0000000-0000-4000-8000-000000000832', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000812', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'rascunho', 30, 1700.00, 0, null, null,
   true, '2026-10-06 13:50:00+00', '2026-10-06 13:50:00+00'),
  -- (3) sem itens, avulso
  ('e0000000-0000-4000-8000-000000000833', 'b0000000-0000-4000-8000-000000000001', null, 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'rascunho', 30, 0, 0, null, null,
   true, '2026-10-08 13:00:00+00', '2026-10-08 13:00:00+00'),
  -- (4) diferencas
  ('e0000000-0000-4000-8000-000000000834', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000814', 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 'rascunho', 30, 750.00, 0, null, null,
   true, '2026-10-07 13:50:00+00', '2026-10-07 13:50:00+00')
on conflict do nothing;

-- Itens. O item de grupo segue o gatilho r157_validar_grupo: quantidade 1, preco_total =
-- preco_unitario, procedimento_id nulo, descricao ate 120, composicao com 2+ membros cujos
-- eventoIds sao da mesma ficha, origem clinica e do mesmo dentista.
insert into public.orcamento_itens
  (id, clinica_id, orcamento_id, procedimento_id, descricao, dente, quantidade,
   preco_unitario, preco_total, aprovado, composicao, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000841', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000831', null, 'Restauracao em resina - D26 (MOD)', '26', 1,
   400.00, 400.00, true, null, '2026-10-05 13:50:01+00', '2026-10-05 14:00:00+00'),
  ('e0000000-0000-4000-8000-000000000842', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000832', null, 'Restauracoes 11 e 21 (preco fechado)', null, 1,
   500.00, 500.00, false,
   '[{"descricao":"Restauracao em resina - D11 (V)","quantidade":1,"procedimentoId":null,"eventoIds":["e0000000-0000-4000-8000-000000000822"]},{"descricao":"Restauracao em resina - D21 (V)","quantidade":1,"procedimentoId":null,"eventoIds":["e0000000-0000-4000-8000-000000000823"]}]'::jsonb,
   '2026-10-06 13:50:01+00', '2026-10-06 13:50:01+00'),
  ('e0000000-0000-4000-8000-000000000843', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000832', null, 'Coroa total - D14', '14', 1,
   1200.00, 1200.00, false, null, '2026-10-06 13:50:02+00', '2026-10-06 13:50:02+00'),
  ('e0000000-0000-4000-8000-000000000844', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', null, 'Restauracao em resina - D36 (O)', '36', 1,
   250.00, 250.00, false, null, '2026-10-07 13:50:01+00', '2026-10-07 13:50:01+00'),
  ('e0000000-0000-4000-8000-000000000845', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', null, 'Restauracao em resina - D46 (O)', '46', 1,
   250.00, 250.00, false, null, '2026-10-07 13:50:02+00', '2026-10-07 13:50:02+00'),
  ('e0000000-0000-4000-8000-000000000846', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', null, 'Restauracao em resina - D47 (O)', '47', 1,
   250.00, 250.00, false, null, '2026-10-07 13:50:03+00', '2026-10-07 13:50:03+00')
on conflict do nothing;

-- Vinculos item <-> evento (gatilhos: evento da ficha do orcamento, origem clinica, mesmo
-- dentista; item do mesmo orcamento). O 37 (...0826) fica FORA de proposito.
insert into public.orcamento_eventos (clinica_id, orcamento_id, evento_id, item_id, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000831', 'e0000000-0000-4000-8000-000000000821', 'e0000000-0000-4000-8000-000000000841', '2026-10-05 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000832', 'e0000000-0000-4000-8000-000000000822', 'e0000000-0000-4000-8000-000000000842', '2026-10-06 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000832', 'e0000000-0000-4000-8000-000000000823', 'e0000000-0000-4000-8000-000000000842', '2026-10-06 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000832', 'e0000000-0000-4000-8000-000000000824', 'e0000000-0000-4000-8000-000000000843', '2026-10-06 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', 'e0000000-0000-4000-8000-000000000825', 'e0000000-0000-4000-8000-000000000844', '2026-10-07 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', 'e0000000-0000-4000-8000-000000000827', 'e0000000-0000-4000-8000-000000000845', '2026-10-07 13:50:04+00'),
  ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000834', 'e0000000-0000-4000-8000-000000000828', 'e0000000-0000-4000-8000-000000000846', '2026-10-07 13:50:04+00')
on conflict do nothing;

-- (1) Pagamento do quitado: fluxo antigo, sem cobranca por etapa (cobranca_id nulo).
insert into public.pagamentos
  (id, clinica_id, orcamento_id, cobranca_id, paciente_id, dentista_id, valor, status,
   forma_pagamento, data_vencimento, data_pagamento, marcado_por_id, parcela_numero,
   total_parcelas, observacoes, created_at, updated_at)
values
  ('e0000000-0000-4000-8000-000000000851', 'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000831', null, 'e0000000-0000-4000-8000-000000000801', 'b0000000-0000-4000-8000-0000000000a1', 400.00, 'pago', 'pix', '2026-10-10', '2026-10-10',
   'b0000000-0000-4000-8000-0000000000a1', null, null, 'Pagamento integral (ficticio)', '2026-10-10 14:00:00+00', '2026-10-10 14:00:00+00')
on conflict do nothing;

-- (4) Trilha que o painel de revisao le (activity_logs):
--   renomeacao: odontograma_evento.detalhe_alterado com nome_alterado = true, DEPOIS do item;
--   retirada:   odontograma_evento.retirado (da o id da alteracao ao painel).
insert into public.activity_logs
  (id, clinica_id, actor_id, actor_nome, paciente_id, entity_type, entity_id, action, metadata, created_at)
values
  ('e0000000-0000-4000-8000-000000000881', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000a1', 'Dra. Ana Local', 'e0000000-0000-4000-8000-000000000801', 'odontograma_evento',
   'e0000000-0000-4000-8000-000000000827', 'odontograma_evento.detalhe_alterado',
   '{"ficticio":true,"nome_alterado":true,"nome_anterior":"Restauracao em resina","nome_atual":"Restauracao em resina composta"}'::jsonb,
   '2026-10-14 13:00:00+00'),
  ('e0000000-0000-4000-8000-000000000882', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000a1', 'Dra. Ana Local', 'e0000000-0000-4000-8000-000000000801', 'odontograma_evento',
   'e0000000-0000-4000-8000-000000000828', 'odontograma_evento.retirado',
   '{"ficticio":true,"ficha_id":"e0000000-0000-4000-8000-000000000814","evento_id":"e0000000-0000-4000-8000-000000000828","procedimento_nome":"Restauracao em resina","retirado_em":"2026-10-15T13:00:00Z"}'::jsonb,
   '2026-10-15 13:00:00+00')
on conflict do nothing;

-- --- Conferencia final (so leitura; aborta se algo nao bater) ------------------------
do $$
declare
  v_estado text; v_devido numeric; v_pago numeric;
begin
  select estado, valor_devido, valor_pago into v_estado, v_devido, v_pago
  from public.orcamentos_com_estado where id = 'e0000000-0000-4000-8000-000000000831';
  if v_estado is distinct from 'quitado' or v_devido is distinct from 400.00 or v_pago is distinct from 400.00 then
    raise exception 'OD-004 extra seed: ORC-Q esperado quitado/400/400, veio %/%/%', v_estado, v_devido, v_pago;
  end if;
  if (select count(*) from public.orcamento_itens
      where orcamento_id = 'e0000000-0000-4000-8000-000000000832' and composicao is not null) <> 1 then
    raise exception 'OD-004 extra seed: ORC-G deveria ter 1 item de grupo';
  end if;
  if exists (select 1 from public.orcamento_itens where orcamento_id = 'e0000000-0000-4000-8000-000000000833') then
    raise exception 'OD-004 extra seed: ORC-V deveria estar sem itens';
  end if;
  if exists (select 1 from public.orcamento_eventos where evento_id = 'e0000000-0000-4000-8000-000000000826') then
    raise exception 'OD-004 extra seed: o 37 deveria estar fora do orcamento (faltando)';
  end if;
  if (select retirado_em from public.odontograma_eventos where id = 'e0000000-0000-4000-8000-000000000828') is null then
    raise exception 'OD-004 extra seed: o 47 deveria estar retirado da ficha';
  end if;
  raise notice 'OD-004 extra seed ok: quitado, grupo, sem itens e diferencas (1 faltando, 1 renomeado, 1 retirado)';
end $$;

commit;
