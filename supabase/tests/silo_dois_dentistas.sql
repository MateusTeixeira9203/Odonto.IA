-- =====================================================================
-- silo_dois_dentistas.sql
--
-- Harness de regressão de segurança (spec-seguranca-silo-validacao, Frente 3).
-- Prova, por SQL determinístico e sem depender de clínica real, que o
-- silo por dentista/secretária é íntegro na camada de RLS de tabela.
--
-- Roda inteiro dentro de UMA transação com ROLLBACK explícito no final —
-- NUNCA persiste dado, mesmo se alguma assertiva falhar (RAISE EXCEPTION
-- aborta a transação, e o ROLLBACK subsequente é redundante mas inofensivo).
--
-- IDs são fixos (não gen_random_uuid()) de propósito: permite usar
-- `SET LOCAL request.jwt.claims` como statement estático de topo de
-- transação, sem PL/pgSQL dinâmico. Todos prefixados com 'a0000000-'
-- para nunca colidir com dado real (e o ROLLBACK garante isso de qualquer forma).
--
-- Re-executável a qualquer momento — é o gate de segurança desta spec,
-- não o teste "logar como dois dentistas numa clínica real" (que valida
-- UX, não segurança).
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

-- ---------------------------------------------------------------------
-- 1. Seed descartável (2 dentistas + 1 secretária, mesma clínica)
-- ---------------------------------------------------------------------
insert into clinicas (id, nome)
values ('a0000000-0000-4000-8000-000000000001', '__SILO_TEST__ (descartável, nunca commitado)');

-- dentistas.user_id e users.id referenciam auth.users(id) — precisa existir lá.
-- O trigger on_auth_user_created espelha automaticamente em public.users (sem side-effect externo).
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', '__silo_test_dentista_a__@example.invalid'),
  ('a0000000-0000-4000-8000-00000000000b', '__silo_test_dentista_b__@example.invalid'),
  ('a0000000-0000-4000-8000-00000000000c', '__silo_test_secretaria__@example.invalid');

insert into dentistas (id, clinica_id, user_id, nome, role, ativo) values
  ('a0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '__SILO_DENTISTA_A__', 'dentista', true),
  ('a0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', '__SILO_DENTISTA_B__', 'dentista', true);

-- secretária: role resolvido via clinica_usuarios + users.active_clinica_id
update users set active_clinica_id = 'a0000000-0000-4000-8000-000000000001'
where id = 'a0000000-0000-4000-8000-00000000000c';

insert into clinica_usuarios (usuario_id, clinica_id, role, status)
values ('a0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'secretaria', 'ativo');

insert into pacientes (id, clinica_id, nome, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-000000000001', '__SILO_PACIENTE_A__', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-000000000001', '__SILO_PACIENTE_B__', 'a0000000-0000-4000-8000-0000000000b1');

insert into fichas (id, clinica_id, paciente_id, dentista_id, queixa_principal) values
  ('a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', 'teste A'),
  ('a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', 'teste B');

insert into orcamentos (id, clinica_id, ficha_id, paciente_id, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1');

insert into orcamento_itens (clinica_id, orcamento_id, descricao, quantidade) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a4', '__SILO_ITEM_A__', 1),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b4', '__SILO_ITEM_B__', 1);

insert into agendamentos (clinica_id, paciente_id, dentista_id, data_hora, status) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', now() + interval '1 day', 'scheduled'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', now() + interval '2 day', 'scheduled');

insert into pagamentos (clinica_id, orcamento_id, paciente_id, dentista_id, valor) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1', 100),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1', 200);

insert into planejamentos (id, clinica_id, ficha_id, paciente_id, dentista_id) values
  ('a0000000-0000-4000-8000-0000000000a5', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-0000000000b1');

insert into planejamento_etapas (clinica_id, planejamento_id, ordem, titulo) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a5', 1, '__SILO_ETAPA_A__'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b5', 1, '__SILO_ETAPA_B__');

insert into planejamento_secoes (clinica_id, paciente_id, titulo) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', '__SILO_SECAO_A__'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', '__SILO_SECAO_B__');

insert into planejamento_procedimentos (clinica_id, paciente_id, descricao) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', '__SILO_PLANPROC_A__'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', '__SILO_PLANPROC_B__');

insert into paciente_documentos (clinica_id, paciente_id, nome, url) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a2', '__SILO_DOC_A__', 'silo-test/doc-a.pdf'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b2', '__SILO_DOC_B__', 'silo-test/doc-b.pdf');

insert into procedimentos (clinica_id, nome, dentista_id) values
  ('a0000000-0000-4000-8000-000000000001', '__SILO_PROCEDIMENTO_A__', 'a0000000-0000-4000-8000-0000000000a1'),
  ('a0000000-0000-4000-8000-000000000001', '__SILO_PROCEDIMENTO_B__', 'a0000000-0000-4000-8000-0000000000b1');

insert into horarios_disponiveis (clinica_id, dentista_id, dia_semana, hora_inicio, hora_fim) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1', 1, '08:00', '12:00'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000b1', 1, '08:00', '12:00');

-- tabela de resultados: acumula TODAS as assertivas (não para no primeiro erro)
create temp table silo_results (
  id      serial primary key,
  persona text not null,
  check_name text not null,
  expected text not null,
  actual  text not null,
  passed  boolean not null
);

-- authenticated/anon vão rodar os asserts (via SET LOCAL ROLE) — precisam poder gravar na temp table.
grant insert, select on silo_results to authenticated, anon;
grant usage, select on sequence silo_results_id_seq to authenticated, anon;

create function pg_temp.silo_assert(p_persona text, p_check text, p_expected text, p_actual bigint, p_ok boolean)
returns void language sql as $$
  insert into silo_results (persona, check_name, expected, actual, passed)
  values (p_persona, p_check, p_expected, p_actual::text, p_ok);
$$;

-- ---------------------------------------------------------------------
-- 2. Ground truth (ainda como role original — bypassa RLS)
-- ---------------------------------------------------------------------
do $$
declare
  v_total_fichas bigint;
begin
  select count(*) into v_total_fichas from fichas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  raise notice '=== GROUND TRUTH (RLS off): % ficha(s) no seed da clínica de teste (esperado 2) ===', v_total_fichas;
end $$;

-- ---------------------------------------------------------------------
-- 3. Impersonar dentista A — deve ver só o próprio, 0 do B
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
declare v_n bigint;
begin
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'fichas: vê a própria', '1', v_n, v_n = 1);
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'fichas: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'orcamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'orcamentos: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'pacientes: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'pacientes: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'agendamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'agendamentos: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'pagamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'pagamentos: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'planejamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'planejamentos: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'procedimentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'procedimentos: vê 0 de B', '0', v_n, v_n = 0);

  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_a', 'horarios_disponiveis: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_a', 'horarios_disponiveis: vê 0 de B', '0', v_n, v_n = 0);

  -- via join (orcamentos)
  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000a4';
  perform pg_temp.silo_assert('dentista_a', 'orcamento_itens: vê o próprio (via orcamento)', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000b4';
  perform pg_temp.silo_assert('dentista_a', 'orcamento_itens: vê 0 de B (via orcamento)', '0', v_n, v_n = 0);

  -- via join (planejamentos)
  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000a5';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_etapas: vê o próprio (via planejamento)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000b5';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_etapas: vê 0 de B (via planejamento)', '0', v_n, v_n = 0);

  -- via join (pacientes)
  select count(*) into v_n from planejamento_secoes where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_secoes: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_secoes where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_secoes: vê 0 de B (via paciente)', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamento_procedimentos where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_procedimentos: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_procedimentos where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_a', 'planejamento_procedimentos: vê 0 de B (via paciente)', '0', v_n, v_n = 0);

  select count(*) into v_n from paciente_documentos where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_a', 'paciente_documentos: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from paciente_documentos where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_a', 'paciente_documentos: vê 0 de B (via paciente)', '0', v_n, v_n = 0);
end $$;

-- ---------------------------------------------------------------------
-- 4. Impersonar dentista B — mesma bateria + tentativa de UPDATE cross-dentista
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000b","role":"authenticated"}';

do $$
declare
  v_n bigint;
  v_affected bigint;
begin
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'fichas: vê a própria', '1', v_n, v_n = 1);
  select count(*) into v_n from fichas where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'fichas: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'orcamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'orcamentos: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'pacientes: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pacientes where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'pacientes: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'agendamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from agendamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'agendamentos: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'pagamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from pagamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'pagamentos: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'planejamentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'planejamentos: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'procedimentos: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from procedimentos where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'procedimentos: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000b1';
  perform pg_temp.silo_assert('dentista_b', 'horarios_disponiveis: vê o próprio', '1', v_n, v_n = 1);
  select count(*) into v_n from horarios_disponiveis where dentista_id = 'a0000000-0000-4000-8000-0000000000a1';
  perform pg_temp.silo_assert('dentista_b', 'horarios_disponiveis: vê 0 de A', '0', v_n, v_n = 0);

  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000b4';
  perform pg_temp.silo_assert('dentista_b', 'orcamento_itens: vê o próprio (via orcamento)', '1', v_n, v_n = 1);
  select count(*) into v_n from orcamento_itens where orcamento_id = 'a0000000-0000-4000-8000-0000000000a4';
  perform pg_temp.silo_assert('dentista_b', 'orcamento_itens: vê 0 de A (via orcamento)', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000b5';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_etapas: vê o próprio (via planejamento)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_etapas where planejamento_id = 'a0000000-0000-4000-8000-0000000000a5';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_etapas: vê 0 de A (via planejamento)', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamento_secoes where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_secoes: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_secoes where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_secoes: vê 0 de A (via paciente)', '0', v_n, v_n = 0);

  select count(*) into v_n from planejamento_procedimentos where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_procedimentos: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from planejamento_procedimentos where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_b', 'planejamento_procedimentos: vê 0 de A (via paciente)', '0', v_n, v_n = 0);

  select count(*) into v_n from paciente_documentos where paciente_id = 'a0000000-0000-4000-8000-0000000000b2';
  perform pg_temp.silo_assert('dentista_b', 'paciente_documentos: vê o próprio (via paciente)', '1', v_n, v_n = 1);
  select count(*) into v_n from paciente_documentos where paciente_id = 'a0000000-0000-4000-8000-0000000000a2';
  perform pg_temp.silo_assert('dentista_b', 'paciente_documentos: vê 0 de A (via paciente)', '0', v_n, v_n = 0);

  -- Caso B da spec: B tenta atualizar a ficha de A diretamente. RLS deve barrar (0 linhas afetadas).
  update fichas set anotacoes = '__SILO_HACK_ATTEMPT__' where id = 'a0000000-0000-4000-8000-0000000000a3';
  get diagnostics v_affected = row_count;
  perform pg_temp.silo_assert('dentista_b', 'UPDATE fichas de A (deve afetar 0 linhas)', '0', v_affected, v_affected = 0);
end $$;

-- ---------------------------------------------------------------------
-- 5. Impersonar secretária — deve ver TUDO da clínica (== total do seed)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000c","role":"authenticated"}';

do $$
declare v_n bigint;
begin
  select count(*) into v_n from fichas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'fichas: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from orcamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'orcamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from pacientes where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'pacientes: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from agendamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'agendamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from pagamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'pagamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'planejamentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from procedimentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'procedimentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from horarios_disponiveis where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'horarios_disponiveis: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from orcamento_itens where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'orcamento_itens: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_etapas where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'planejamento_etapas: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_secoes where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'planejamento_secoes: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from planejamento_procedimentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'planejamento_procedimentos: vê tudo da clínica', '2', v_n, v_n = 2);

  select count(*) into v_n from paciente_documentos where clinica_id = 'a0000000-0000-4000-8000-000000000001';
  perform pg_temp.silo_assert('secretaria', 'paciente_documentos: vê tudo da clínica', '2', v_n, v_n = 2);
end $$;

-- ---------------------------------------------------------------------
-- 6. Volta ao role original (superuser/service — bypassa RLS) e relatório final
-- ---------------------------------------------------------------------
reset role;

select persona, check_name, expected, actual,
       case when passed then 'OK' else '❌ FALHOU' end as resultado
from silo_results
order by (not passed) desc, id;

-- Falha o script (aborta a transação) se qualquer assertiva não passou.
do $$
declare v_failures int;
begin
  select count(*) into v_failures from silo_results where not passed;
  if v_failures > 0 then
    raise exception 'SILO TEST FALHOU: % assertiva(s) reprovada(s). Ver relatório acima.', v_failures;
  end if;
  raise notice '=== SILO TEST OK: % assertivas, todas passaram ===', (select count(*) from silo_results);
end $$;

-- Descarta o seed incondicionalmente — nada deste script persiste.
rollback;
