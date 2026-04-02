-- Migration: 018_dentistas_role_rls.sql
-- Adiciona coluna role na tabela dentistas e atualiza políticas RLS
-- para diferenciar permissões entre admin, dentista e secretária.
--
-- Papéis:
--   admin      - dono da clínica, acesso total
--   dentista   - acesso a fichas e próprias informações
--   secretaria - acesso a pacientes e agendamentos, SEM acesso a fichas clínicas

-- ============================================================
-- 1. Adicionar coluna role em dentistas
-- ============================================================
ALTER TABLE dentistas
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'dentista'
  CHECK (role IN ('admin', 'dentista', 'secretaria'));

-- Usuários existentes são donos de clínica → promover para admin
UPDATE dentistas SET role = 'admin' WHERE role = 'dentista';

-- ============================================================
-- 2. Função auxiliar: retorna o papel do usuário autenticado
-- Segue o mesmo padrão de get_my_clinica_id() (SECURITY DEFINER
-- para evitar recursão RLS ao consultar a tabela dentistas).
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM dentistas WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 3. Fichas clínicas — bloquear secretária
-- Secretária não deve ter acesso a prontuários/fichas clínicas.
-- Apenas admin e dentista podem ler/escrever fichas.
-- ============================================================
DROP POLICY IF EXISTS fichas_all_policy ON fichas;
CREATE POLICY fichas_all_policy ON fichas
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  );

-- ============================================================
-- 4. Configurações da clínica — somente admin pode alterar
-- Secretária pode ler (para exibir info no dashboard),
-- mas não pode modificar dados da clínica.
-- ============================================================
DROP POLICY IF EXISTS configuracoes_clinica_all_policy ON configuracoes_clinica;

CREATE POLICY configuracoes_clinica_select_policy ON configuracoes_clinica
  FOR SELECT TO authenticated
  USING (clinica_id = get_my_clinica_id());

CREATE POLICY configuracoes_clinica_write_policy ON configuracoes_clinica
  FOR ALL TO authenticated
  USING (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  )
  WITH CHECK (
    clinica_id = get_my_clinica_id()
    AND get_my_role() IN ('admin', 'dentista')
  );

-- ============================================================
-- 5. Pacientes, Agendamentos — acessíveis a todos os papéis
-- (já cobertos pelas políticas existentes via get_my_clinica_id)
-- Nenhuma alteração necessária aqui.
-- ============================================================

-- ============================================================
-- NOTAS DE IMPLEMENTAÇÃO
-- ============================================================
-- Para adicionar uma secretária:
--   INSERT INTO dentistas (clinica_id, user_id, nome, role)
--   VALUES ('<clinica_id>', '<user_id_da_secretaria>', 'Nome', 'secretaria');
--
-- Para promover um dentista a admin:
--   UPDATE dentistas SET role = 'admin' WHERE id = '<id>';
