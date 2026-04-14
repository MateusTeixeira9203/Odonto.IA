-- ============================================================
-- DentAI — Limpeza completa para testes do zero
-- Execute no Supabase SQL Editor (roda como postgres / superusuário)
-- ============================================================
-- ATENÇÃO: destrói TODOS os dados de clínicas, dentistas, pacientes,
-- fichas, orçamentos, agendamentos etc. e todos os usuários auth.
-- Use apenas em ambiente de desenvolvimento/teste!
-- ============================================================

-- ── 1. Limpar tabelas de negócio (CASCADE garante ordem) ──────────────────

TRUNCATE TABLE
  -- Folhas (sem dependentes)
  google_tokens,
  pagamentos,
  orcamento_itens,
  mensagens_bot,
  planejamento_secoes,
  paciente_documentos,
  instancias_whatsapp,
  bot_config,
  convites,
  configuracoes_clinica,
  horarios_disponiveis,
  -- Nível intermediário
  conversas_bot,
  agendamentos,
  -- Dependem de fichas/planejamentos
  planejamento_etapas,
  ficha_arquivos,
  orcamentos,
  planejamentos,
  fichas,
  -- Dependem de clinicas
  pacientes,
  procedimentos,
  dentistas,
  -- Raiz (tenant)
  clinicas
CASCADE;

-- ── 2. Deletar todos os usuários do Auth ─────────────────────────────────
-- O SQL Editor do Supabase roda como postgres, com acesso ao schema auth.
-- A FK dentistas.user_id já foi cascadeada no passo anterior.

DELETE FROM auth.users;

-- ── 3. (Opcional) Resetar seed de procedimentos_padrao ───────────────────
-- Descomente se quiser apagar os procedimentos padrão também.
-- Eles NÃO têm clinica_id e são seed global do sistema.
-- TRUNCATE TABLE procedimentos_padrao;

-- ── 4. Confirmação ────────────────────────────────────────────────────────
SELECT 'clinicas'     AS tabela, COUNT(*) AS total FROM clinicas
UNION ALL
SELECT 'dentistas',   COUNT(*) FROM dentistas
UNION ALL
SELECT 'pacientes',   COUNT(*) FROM pacientes
UNION ALL
SELECT 'fichas',      COUNT(*) FROM fichas
UNION ALL
SELECT 'orcamentos',  COUNT(*) FROM orcamentos
UNION ALL
SELECT 'agendamentos',COUNT(*) FROM agendamentos
UNION ALL
SELECT 'auth.users',  COUNT(*) FROM auth.users;
