-- =====================================================================
-- matriz_acesso_clinico.sql
--
-- Harness de regressão de segurança do núcleo clínico.
-- Spec: plans/specs/2026-07-16-hierarquia-3.1-nucleo-clinico-spec.md (§10)
--
-- SUCEDE `silo_dois_dentistas.sql` (spec-seguranca-silo-validacao, 63/63).
-- O nome antigo passou a mentir: a asserção central deixou de ser
-- "dentista A vê ZERO de B" e virou a MATRIZ abaixo.
--
--   Registro clínico  → A LÊ o de B, mas NÃO ESCREVE  (fichas, planejamento_*,
--                        paciente_documentos, tratamentos, pacientes)
--   Dinheiro + agenda → A não vê NADA de B            (orcamentos, orcamento_itens,
--                        pagamentos, agendamentos, procedimentos, horarios_disponiveis)
--   Secretária        → vê tudo da clínica            (inalterado)
--
-- Roda inteiro dentro de UMA transação com ROLLBACK explícito no final —
-- NUNCA persiste dado, mesmo se alguma assertiva falhar.
--
-- IDs fixos (prefixo 'a0000000-') de propósito: permite `SET LOCAL
-- request.jwt.claims` como statement estático, sem PL/pgSQL dinâmico.
--
-- PRÉ-REQUISITO: migration 099 aplicada. Sem ela, as asserções de leitura
-- aberta falham (é o comportamento esperado — o harness é o gate dela).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. IDs do seed descartável
-- ---------------------------------------------------------------------
-- clinica:            a0000000-0000-4000-8000-000000000001
-- user_a (dentista):  a0000000-0000-4000-8000-00000000000a
-- user_b (dentista):  a0000000-0000-4000-8000-00000000000b
-- user_sec (secret.): a0000000-0000-4000-8000-00000000000c
-- dentista_a:         a0000000-0000-4000-8000-0000000000a1
-- dentista_b:         a0000000-0000-4000-8000-0000000000b1
-- paciente_a:         a0000000-0000-4000-8000-0000000000a2
-- paciente_b:         a0000000-0000-4000-8000-0000000000b2
-- ficha_a:            a0000000-0000-4000-8000-0000000000a3
-- ficha_b:            a0000000-0000-4000-8000-0000000000b3
-- orcamento_a:        a0000000-0000-4000-8000-0000000000a4
-- orcamento_b:        a0000000-0000-4000-8000-0000000000b4
-- planejamento_a:     a0000000-0000-4000-8000-0000000000a5
-- planejamento_b:     a0000000-0000-4000-8000-0000000000b5
-- tratamento_a:       a0000000-0000-4000-8000-0000000000a6
-- tratamento_b:       a0000000-0000-4000-8000-0000000000b6
-- planproc_a:         a0000000-0000-4000-8000-0000000000a7
-- planproc_b:         a0000000-0000-4000-8000-0000000000b7
-- planproc dente 26 A:a0000000-0000-4000-8000-0000000000a8
-- planproc dente 26 B:a0000000-0000-4000-8000-0000000000b8
-- doc_a:              a0000000-0000-4000-8000-0000000000a9
-- doc_b:              a0000000-0000-4000-8000-0000000000b9
-- secao_a:            a0000000-0000-4000-8000-0000000000aa
-- secao_b:            a0000000-0000-4000-8000-0000000000bb

-- ---------------------------------------------------------------------
-- 1. Seed descartável (2 dentistas + 1 secretária, mesma clínica)
-- ---------------------------------------------------------------------
insert into clinicas (id, nome)
values ('a0000000-0000-4000-8000-000000000001', '__MATRIZ_TEST__ (descartável, nunca commitado)');

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', '__matriz_test_dentista_a__@example.invalid'),
  ('a0000000-0000-4000-8000-00000000000b', '__matriz_test_dentista_b__@example.invalid'),
  ('a0000000-0000-4000-8000-00000000000c', '__matriz_test_secretaria__@example.invalid');

insert into dentistas (id, clinica_id, user_id, nome, role, ativo) values
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '__MATRIZ_DENTISTA_A__', 'dentista', true),
  ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', '__MATRIZ_DENTISTA_B__', 'dentista', true);

update users set active_clinica_id = 'a0000000-0000-4000-8000-000000000001'
where id = 'a0000000-0000-4000-8000-00000000000c';

insert into clinica_usuarios (usuario_id, clinica_id, role, status)
values ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'secretaria', 'ativo');

-- pacientes.dentista_id agora é INFORMATIVO ("quem cadastrou") — não governa
-- mais visibilidade (migration 099). Mantido no seed pra provar exatamente isso.
insert into pacientes (id, clinica_id, nome, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', '__MATRIZ_PACIENTE_A__', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-000000000001', '__MATRIZ_PACIENTE_B__', 'a0000000-0000-4000-8000-0000000000b1');

insert into fichas (id, clinica_id, paciente_id, dentista_id, queixa_principal) values
  ('a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', 'teste A'),
  ('a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', 'teste B');

insert into orcamentos (id, clinica_id, ficha_id, paciente_id, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1');

insert into orcamento_itens (clinica_id, orcamento_id, descricao, quantidade) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a4', '__MATRIZ_ITEM_A__', 1),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b4', '__MATRIZ_ITEM_B__', 1);

-- duracao_minutos explícito: o teste de conflito depende do intervalo exato.
insert into agendamentos (clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', now() + interval '1 day', 30, 'scheduled'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', now() + interval '2 day', 30, 'scheduled');

insert into pagamentos (clinica_id, orcamento_id, paciente_id, dentista_id, valor) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', 100),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', 200);

-- planejamentos / planejamento_etapas: tabelas VAZIAS em prod (0 linhas, auditado
-- 16/07). Continuam siloed, fora do escopo da spec — seed mantido só pra provar
-- que a migration 099 não as afrouxou por acidente.
insert into planejamentos (id, clinica_id, ficha_id, paciente_id, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a5', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1');

insert into planejamento_etapas (clinica_id, planejamento_id, ordem, titulo) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a5', 1, '__MATRIZ_ETAPA_A__'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b5', 1, '__MATRIZ_ETAPA_B__');

-- ── As 4 tabelas que ganharam autoria própria na migration 099 ────────
-- status: tratamentos_status_check aceita só 'principal'|'pendente'|'concluido' (migration tratamentos_multi_status_v2). 'ativo' era inválido — corrigido no dry-run 17/07.
insert into tratamentos (id, clinica_id, paciente_id, dentista_id, nome, status) values
  ('a0000000-0000-4000-8000-0000000000a6', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_TRATAMENTO_A__', 'principal'),
  ('a0000000-0000-4000-8000-0000000000b6', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_TRATAMENTO_B__', 'principal');

insert into planejamento_secoes (id, clinica_id, paciente_id, dentista_id, titulo) values
  ('a0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_SECAO_A__'),
  ('a0000000-0000-4000-8000-0000000000bb', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_SECAO_B__');

-- Os 2 primeiros: um de cada dentista, em pacientes distintos.
-- Os 2 últimos: MESMO paciente, MESMO dente (26), dentistas DIFERENTES —
-- o caso do §3.1 da spec ("encaminha pro colega, volta e mexe no mesmo dente").
insert into planejamento_procedimentos (id, clinica_id, paciente_id, dentista_id, descricao, dente, ordem) values
  ('a0000000-0000-4000-8000-0000000000a7', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_PLANPROC_A__', null, 0),
  ('a0000000-0000-4000-8000-0000000000b7', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_PLANPROC_B__', null, 0),
  ('a0000000-0000-4000-8000-0000000000a8', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_DENTE26_DE_A__', 26, 1),
  ('a0000000-0000-4000-8000-0000000000b8', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_DENTE26_DE_B__', 26, 2);

insert into paciente_documentos (id, clinica_id, paciente_id, dentista_id, nome, url) values
  ('a0000000-0000-4000-8000-0000000000a9', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_DOC_A__', 'matriz-test/doc-a.pdf'),
  ('a0000000-0000-4000-8000-0000000000b9', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_DOC_B__', 'matriz-test/doc-b.pdf');

insert into procedimentos (clinica_id, nome, dentista_id) values
  ('a0000000-0000-4000-8000-000000000001', '__MATRIZ_PROCEDIMENTO_A__', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-000000000001', '__MATRIZ_PROCEDIMENTO_B__', 'a0000000-0000-4000-8000-0000000000b1');

insert into horarios_disponiveis (clinica_id, dentista_id, dia_semana, hora_inicio, hora_fim) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', 1, '08:00', '12:00'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b1', 1, '08:00', '12:00');

-- tabela de resultados: acumula TODAS as assertivas (não para no primeiro erro)
create temp table matriz_results (
  id      serial primary key,
  persona text not null,
  check_name text not null,
  expected text not null,
  actual  text not null,
  passed  boolean not null
);

grant insert, select on matriz_results to authenticated, anon;
grant usage, select on sequence matriz_results_id_seq to authenticated, anon;

create function pg_temp.matriz_assert(p_persona text, p_check text, p_expected text, p_actual bigint, p_ok boolean)
returns void language sql as $$
  insert into matriz_results (persona, check_name, expected, actual, passed)
  values (p_persona, p_check, p_expected, p_actual::text, p_ok);
$$;

-- variante booleana (pro teste da função de conflito)
create function pg_temp.matriz_assert_bool(p_persona text, p_check text, p_expected boolean, p_actual boolean)
returns void language sql as $$
  insert into matriz_results (persona, check_name, expected, actual, passed)
  values (p_persona, p_check, p_expected::text, p_actual::text, p_expected is not distinct from p_actual);
$$;

-- ---------------------------------------------------------------------
-- 2. Ground truth (ainda como role original — bypassa RLS)
-- ---------------------------------------------------------------------
do $$
declare v_total_fichas bigint;
begin
  select count(*) into v_total_fichas from fichas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  raise notice '=== GROUND TRUTH (RLS off): % ficha(s) no seed da clínica de teste (esperado 2) ===', v_total_fichas;
end $$;

-- ---------------------------------------------------------------------
-- 3. Dentista A — LÊ o clínico de B, NÃO vê o financeiro/agenda de B
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
declare v_n bigint;
begin
  -- ══ REGISTRO CLÍNICO — leitura ABERTA (o que a spec 2026-07-16 mudou) ══
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'fichas: vê a própria', '1', v_n, v_n = 1);
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'fichas: VÊ 1 de B (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'pacientes: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'pacientes: VÊ 1 de B (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from planejamento_procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_procedimentos: vê os próprios', '2', v_n, v_n = 2);
  select count(*) into v_n from planejamento_procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_procedimentos: VÊ 2 de B (abriu)', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_secoes where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_secoes: vê a própria', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_secoes where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_secoes: VÊ 1 de B (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from paciente_documentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'paciente_documentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from paciente_documentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'paciente_documentos: VÊ 1 de B (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from tratamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'tratamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from tratamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'tratamentos: VÊ 1 de B (era aberto, continua)', '1', v_n, v_n = 1);

  -- §3.1 + invariante #8: mesmo dente, dois dentistas, mesmo paciente.
  select count(*) into v_n from planejamento_procedimentos
   where paciente_id = 'a0000000-0000-4000-8000-0000000000a2' and dente = 26;
  perform pg_temp.matriz_assert('dentista_a', 'dente 26 do paciente A: vê os 2 (o meu + o do B)', '2', v_n, v_n = 2);

  -- ══ DINHEIRO + AGENDA — silo ESTRITO (inalterado pela spec) ══
  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'orcamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'orcamentos: vê 0 de B (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000a4';
  perform pg_temp.matriz_assert('dentista_a', 'orcamento_itens: vê o próprio (via orcamento)', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000b4';
  perform pg_temp.matriz_assert('dentista_a', 'orcamento_itens: vê 0 de B (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'pagamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'pagamentos: vê 0 de B (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'agendamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'agendamentos: vê 0 de B (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'procedimentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'procedimentos: vê 0 de B (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'horarios_disponiveis: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'horarios_disponiveis: vê 0 de B (silo)', '0', v_n, v_n = 0);

  -- ══ Tabelas VAZIAS em prod — fora de escopo, continuam siloed ══
  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamentos: vê o próprio (fora de escopo)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.matriz_assert('dentista_a', 'planejamentos: vê 0 de B (fora de escopo, siloed)', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000a5';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_etapas: vê a própria (fora de escopo)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000b5';
  perform pg_temp.matriz_assert('dentista_a', 'planejamento_etapas: vê 0 de B (fora de escopo, siloed)', '0', v_n, v_n = 0);
end $$;

-- ---------------------------------------------------------------------
-- 4. Dentista A — LÊ mas NÃO ESCREVE o clínico de B (invariante #1)
--
-- A parte mais importante do harness: leitura aberta NUNCA implica escrita
-- aberta. Cada UPDATE abaixo deve afetar 0 linhas; cada INSERT com
-- dentista_id alheio deve ser rejeitado pelo WITH CHECK.
-- ---------------------------------------------------------------------
do $$
declare
  v_affected bigint;
  v_rejeitado boolean;
begin
  update fichas set anotacoes = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000b3';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE ficha de B → 0 linhas (lê, não escreve)', '0', v_affected, v_affected = 0);

  delete from fichas where id = 'a0000000-0000-4000-8000-0000000000b3';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'DELETE ficha de B → 0 linhas', '0', v_affected, v_affected = 0);

  update planejamento_procedimentos set descricao = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000b7';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE planejamento_procedimentos de B → 0 linhas', '0', v_affected, v_affected = 0);

  -- O caso do §3.1: A vê o procedimento do B no MESMO dente 26, mas não toca.
  update planejamento_procedimentos set descricao = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000b8';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE proc. de B no MESMO dente 26 → 0 linhas', '0', v_affected, v_affected = 0);

  update planejamento_secoes set titulo = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000bb';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE planejamento_secoes de B → 0 linhas', '0', v_affected, v_affected = 0);

  update paciente_documentos set nome = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000b9';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE paciente_documentos de B → 0 linhas', '0', v_affected, v_affected = 0);

  -- Fecha o furo auditado em 16/07: ANTES da 099, qualquer dentista editava
  -- o tratamento de qualquer outro (tratamentos_update_dentistas).
  update tratamentos set nome = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000b6';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_a', 'UPDATE tratamento de B → 0 linhas (furo fechado)', '0', v_affected, v_affected = 0);

  -- INSERT com dentista_id alheio: WITH CHECK deve rejeitar (invariante #7).
  begin
    insert into fichas (clinica_id, paciente_id, dentista_id, queixa_principal)
    values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_HACK__');
    v_rejeitado := false;
  exception when insufficient_privilege or check_violation then
    v_rejeitado := true;
  end;
  perform pg_temp.matriz_assert_bool('dentista_a', 'INSERT ficha com dentista_id de B → rejeitado', true, v_rejeitado);

  begin
    insert into planejamento_procedimentos (clinica_id, paciente_id, dentista_id, descricao, ordem)
    values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000b1', '__MATRIZ_HACK__', 9);
    v_rejeitado := false;
  exception when insufficient_privilege or check_violation then
    v_rejeitado := true;
  end;
  perform pg_temp.matriz_assert_bool('dentista_a', 'INSERT planejamento_procedimentos com dentista_id de B → rejeitado', true, v_rejeitado);

  -- §3.1: A DEVE conseguir adicionar mais um procedimento no dente 26 que o B já usou.
  begin
    insert into planejamento_procedimentos (clinica_id, paciente_id, dentista_id, descricao, dente, ordem)
    values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', '__MATRIZ_DENTE26_DE_A_2__', 26, 3);
    v_rejeitado := false;
  exception when others then
    v_rejeitado := true;
  end;
  perform pg_temp.matriz_assert_bool('dentista_a', 'INSERT 5º proc. no dente 26 que B já usou → PERMITIDO', false, v_rejeitado);
end $$;

-- ---------------------------------------------------------------------
-- 5. Dentista A — conflito de agenda por paciente SEM ver a agenda de B
--
-- O par de asserções que prova a invariante #3: a função barra o conflito
-- E a agenda do B continua invisível pro A.
-- ---------------------------------------------------------------------
do $$
declare
  v_conflito boolean;
  v_n bigint;
begin
  -- B tem o paciente_b agendado em now()+2d por 30min. A tenta o MESMO paciente
  -- no MESMO horário → deve ser barrado, mesmo sem enxergar a agenda do B.
  select public.paciente_tem_conflito_agenda(
    'a0000000-0000-4000-8000-0000000000b2', now() + interval '2 day', 30
  ) into v_conflito;
  perform pg_temp.matriz_assert_bool('dentista_a', 'conflito com agendamento de B → true (barra)', true, v_conflito);

  -- ...e o A continua sem ver NADA da agenda do B (a função não vazou).
  select count(*) into v_n from agendamentos where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.matriz_assert('dentista_a', 'agenda de B continua invisível (0 linhas)', '0', v_n, v_n = 0);

  -- Horário livre do mesmo paciente → sem conflito.
  select public.paciente_tem_conflito_agenda(
    'a0000000-0000-4000-8000-0000000000b2', now() + interval '5 day', 30
  ) into v_conflito;
  perform pg_temp.matriz_assert_bool('dentista_a', 'horário livre do paciente de B → false', false, v_conflito);

  -- Encostar não é sobrepor: ranges são [), então 14:00-14:30 e 14:30-15:00 não colidem.
  select public.paciente_tem_conflito_agenda(
    'a0000000-0000-4000-8000-0000000000b2', now() + interval '2 day' + interval '30 min', 30
  ) into v_conflito;
  perform pg_temp.matriz_assert_bool('dentista_a', 'agendamento encostado (não sobrepõe) → false', false, v_conflito);
end $$;

-- ---------------------------------------------------------------------
-- 6. Dentista B — bateria espelhada (prova que a matriz é simétrica)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000b","role":"authenticated"}';

do $$
declare
  v_n bigint;
  v_affected bigint;
begin
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'fichas: VÊ 1 de A (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'pacientes: VÊ 1 de A (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from paciente_documentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'paciente_documentos: VÊ 1 de A (abriu)', '1', v_n, v_n = 1);

  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'orcamentos: vê 0 de A (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'pagamentos: vê 0 de A (silo)', '0', v_n, v_n = 0);

  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.matriz_assert('dentista_b', 'agendamentos: vê 0 de A (silo)', '0', v_n, v_n = 0);

  update fichas set anotacoes = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000a3';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_b', 'UPDATE ficha de A → 0 linhas', '0', v_affected, v_affected = 0);

  update tratamentos set nome = '__MATRIZ_HACK__' where id = 'a0000000-0000-4000-8000-0000000000a6';
  get diagnostics v_affected = row_count;
  perform pg_temp.matriz_assert('dentista_b', 'UPDATE tratamento de A → 0 linhas', '0', v_affected, v_affected = 0);
end $$;

-- ---------------------------------------------------------------------
-- 7. Secretária — continua vendo TUDO da clínica (nenhuma regressão)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000c","role":"authenticated"}';

do $$
declare v_n bigint;
begin
  select count(*) into v_n from fichas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'fichas: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from orcamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'orcamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from pacientes where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'pacientes: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from agendamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'agendamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from pagamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'pagamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'planejamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from procedimentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'procedimentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from horarios_disponiveis where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'horarios_disponiveis: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from orcamento_itens where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'orcamento_itens: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_etapas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'planejamento_etapas: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_secoes where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'planejamento_secoes: vê tudo da clínica', '2', v_n, v_n = 2);

  -- 4 do seed + 1 inserido por A no dente 26 (§4) = 5
  select count(*) into v_n from planejamento_procedimentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'planejamento_procedimentos: vê tudo da clínica', '5', v_n, v_n = 5);

  select count(*) into v_n from paciente_documentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'paciente_documentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from tratamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.matriz_assert('secretaria', 'tratamentos: vê tudo da clínica', '2', v_n, v_n = 2);
end $$;

-- ---------------------------------------------------------------------
-- 8. Invariante #10 — "clínica" nunca é "qualquer membro"
--
-- Não dá pra impersonar um protético aqui: o CHECK das migrations 018/054 trava
-- role em ('admin','dentista','secretaria'). Mas a invariante é estrutural e
-- verificável direto no catálogo — sem depender do papel existir.
--
-- Por que importa: belongs_to_active_clinic() só checa MEMBERSHIP, não papel. O
-- protético entra como membro da equipe na Spec 3; qualquer policy de leitura
-- clínica sem is_clinic_staff() entrega o prontuário da clínica pra ele.
-- ---------------------------------------------------------------------
reset role;

do $$
declare v_furos bigint;
begin
  -- Portões aceitos: is_clinic_staff (leitura clínica), can_act_as_dentista (escrita por
  -- autor/secretária) e get_my_dentista_id (escrita trancada no dono — já barra papel
  -- não-clínico, porque a função devolve NULL pra quem não está em `dentistas`).
  -- Qualquer outro = belongs_to_active_clinic() SOLTO = prontuário aberto a qualquer membro.
  --
  -- Validado contra prod em 16/07 (pré-099): esta query acusou
  -- `tratamentos_select_clinic_members` como furo REAL — era belongs_to_active_clinic() puro.
  select count(*) into v_furos
    from pg_policies
   where schemaname = 'public'
     and tablename in ('fichas','pacientes','planejamento_procedimentos',
                       'planejamento_secoes','paciente_documentos','tratamentos')
     and cmd in ('SELECT','ALL')
     and qual like '%belongs_to_active_clinic%'
     and qual not like '%is_clinic_staff%'
     and qual not like '%can_act_as_dentista%'
     and qual not like '%get_my_dentista_id%';
  perform pg_temp.matriz_assert(
    'estrutural',
    'invariante #10: policy clínica com belongs_to_active_clinic() SOLTO',
    '0', v_furos, v_furos = 0
  );
end $$;

-- ---------------------------------------------------------------------
-- 9. Relatório final
-- ---------------------------------------------------------------------

select persona, check_name, expected, actual,
       case when passed then 'OK' else '❌ FALHOU' end as resultado
from matriz_results
order by (not passed) desc, id;

do $$
declare v_failures int;
begin
  select count(*) into v_failures from matriz_results where not passed;
  if v_failures > 0 then
    raise exception 'MATRIZ DE ACESSO FALHOU: % assertiva(s) reprovada(s). Ver relatório acima.', v_failures;
  end if;
  raise notice '=== MATRIZ DE ACESSO OK: % assertivas, todas passaram ===', (select count(*) from matriz_results);
end $$;

-- Descarta o seed incondicionalmente — nada deste script persiste.
rollback;
