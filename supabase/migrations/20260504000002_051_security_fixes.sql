-- Migration: 051_security_fixes.sql
-- Corrige três problemas de segurança identificados antes de ir a produção.

-- ============================================================
-- 1. Revogar acesso anon às funções SECURITY DEFINER
--
-- Problema: get_my_clinica_id, get_my_role e get_my_dentista_id
-- são chamáveis por qualquer pessoa via REST sem autenticação.
-- Retornam NULL para anon (auth.uid() = null), mas a exposição
-- abre surface de enumeração e viola o princípio do menor privilégio.
--
-- get_convite_by_token() mantém acesso anon — é usada para
-- validar links de convite antes da autenticação.
-- ============================================================
REVOKE EXECUTE ON FUNCTION get_my_clinica_id()  FROM anon;
REVOKE EXECUTE ON FUNCTION get_my_role()         FROM anon;
REVOKE EXECUTE ON FUNCTION get_my_dentista_id()  FROM anon;

-- ============================================================
-- 2. Restringir INSERT em clinicas ao onboarding inicial
--
-- Problema: WITH CHECK (true) permite qualquer usuário autenticado
-- criar clínicas via API diretamente, inclusive secretárias e
-- dentistas convidados que já pertencem a uma clínica.
--
-- Fix: só permite INSERT se o usuário ainda não tem dentista
-- registrado (fluxo de onboarding de novo usuário).
-- ============================================================
DROP POLICY IF EXISTS clinicas_insert_policy ON clinicas;
CREATE POLICY clinicas_insert_policy ON clinicas
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM dentistas WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Fixar search_path em update_updated_at
--
-- Problema: função criada sem SET search_path = public,
-- o que permite um atacante com CREATE SCHEMA manipular o
-- search_path e redirecionar chamadas para objetos maliciosos.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
