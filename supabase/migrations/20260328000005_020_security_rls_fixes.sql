-- Correções de segurança RLS
-- 2026-03-28

-- 1. procedimentos_padrao: habilitar RLS e restringir escrita apenas ao service role
ALTER TABLE procedimentos_padrao ENABLE ROW LEVEL SECURITY;

-- Remove a política errada que permitia escrita para qualquer autenticado
DROP POLICY IF EXISTS "procedimentos_padrao_write_policy" ON procedimentos_padrao;

-- Apenas leitura para usuários autenticados (tabela de referência compartilhada)
CREATE POLICY "procedimentos_padrao_select_policy" ON procedimentos_padrao
  FOR SELECT TO authenticated USING (true);

-- 2. Remover políticas redundantes com role {public} em planejamentos
-- (mantém apenas a planejamentos_all_policy com role {authenticated})
DROP POLICY IF EXISTS "clinica_own_planejamentos" ON planejamentos;

-- 3. Remover políticas redundantes com role {public} em planejamento_etapas
-- (mantém apenas a planejamento_etapas_all_policy com role {authenticated})
DROP POLICY IF EXISTS "clinica_own_planejamento_etapas" ON planejamento_etapas;

-- 4. Adicionar política UPDATE para clinicas (complementa select e insert existentes)
CREATE POLICY "clinicas_update_policy" ON clinicas
  FOR UPDATE TO authenticated
  USING (id = get_my_clinica_id())
  WITH CHECK (id = get_my_clinica_id());
