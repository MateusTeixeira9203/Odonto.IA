-- ============================================================
-- Migration 057 — RLS Overhaul + Multi-Tenant Auth Source
-- ============================================================
-- Objetivo: substituir auth baseado em dentistas por clinica_usuarios + users.active_clinica_id.
-- Toda policy nova usa belongs_to_active_clinic() que valida:
--   1. active_clinica_id do usuário
--   2. membership ativa em clinica_usuarios (status = 'ativo')
-- Mantém COALESCE fallback para retrocompatibilidade com usuários
-- sem dados migrados (legado pré-052).
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE 1: HELPERS SQL
-- ============================================================

-- get_my_clinica_id: nova fonte primária = users.active_clinica_id
-- fallback = dentistas (legado)
CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_clinica_id FROM public.users WHERE id = auth.uid()),
    (SELECT clinica_id FROM public.dentistas WHERE user_id = auth.uid() AND ativo = true LIMIT 1)
  )
$$;

-- get_my_role: nova fonte primária = clinica_usuarios
-- fallback = dentistas (legado)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT cu.role
      FROM public.clinica_usuarios cu
      JOIN public.users u ON u.id = auth.uid()
      WHERE cu.usuario_id = auth.uid()
        AND cu.clinica_id = u.active_clinica_id
        AND cu.status = 'ativo'
      LIMIT 1
    ),
    (SELECT role FROM public.dentistas WHERE user_id = auth.uid() AND ativo = true LIMIT 1)
  )
$$;

-- has_active_membership: valida clinica_usuarios.status = 'ativo'
-- com fallback para dentistas ativos (retrocompatibilidade)
CREATE OR REPLACE FUNCTION public.has_active_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinica_usuarios cu
    JOIN public.users u ON u.id = auth.uid()
    WHERE cu.usuario_id = auth.uid()
      AND cu.clinica_id = u.active_clinica_id
      AND cu.status = 'ativo'
  )
  OR EXISTS (
    SELECT 1 FROM public.dentistas
    WHERE user_id = auth.uid() AND ativo = true
  )
$$;

-- belongs_to_active_clinic: principal guard de todas as policies.
-- Verifica: registro pertence à clínica ativa do usuário + membership ativa.
CREATE OR REPLACE FUNCTION public.belongs_to_active_clinic(record_clinica_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT record_clinica_id IS NOT NULL
    AND record_clinica_id = public.get_my_clinica_id()
    AND public.has_active_membership()
$$;

-- is_clinic_admin: role = 'admin' na clínica ativa
CREATE OR REPLACE FUNCTION public.is_clinic_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() = 'admin'
$$;

-- is_clinic_dentista: role IN ('admin','dentista') na clínica ativa
CREATE OR REPLACE FUNCTION public.is_clinic_dentista()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('admin', 'dentista')
$$;

-- is_own_finance_record: valida escopo financeiro individual.
-- Admin e dentista enxergam apenas os próprios registros.
-- record_dentista_id NULL = aceito (registro sem dentista vinculado).
CREATE OR REPLACE FUNCTION public.is_own_finance_record(record_dentista_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT record_dentista_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.dentistas
      WHERE user_id = auth.uid()
        AND clinica_id = public.get_my_clinica_id()
        AND id = record_dentista_id
    )
$$;

-- ============================================================
-- PARTE 2: DROP DE TODAS AS POLICIES EXISTENTES
-- Abordagem idempotente: zera e recria tudo.
-- ============================================================

DO $$
DECLARE
  pol   record;
  tbls  text[] := ARRAY[
    'clinicas', 'dentistas', 'pacientes', 'fichas',
    'agendamentos', 'horarios_disponiveis',
    'orcamentos', 'orcamento_itens', 'pagamentos',
    'despesas', 'receitas_manuais',
    'procedimentos', 'procedimentos_padrao',
    'configuracoes_clinica', 'bot_config',
    'instancias_whatsapp', 'conversas_bot', 'mensagens_bot',
    'notificacoes', 'convites',
    'clinica_usuarios', 'users', 'secretarias',
    'planejamentos', 'planejamento_etapas',
    'planejamento_secoes', 'planejamento_procedimentos',
    'paciente_documentos', 'google_tokens'
  ];
  t     text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- PARTE 3: CLINICAS
-- Usuário vê somente a própria clínica ativa.
-- Escrita: admin apenas.
-- ============================================================

ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinicas_select_own"
ON public.clinicas FOR SELECT TO authenticated
USING (id = public.get_my_clinica_id());

CREATE POLICY "clinicas_update_admin"
ON public.clinicas FOR UPDATE TO authenticated
USING  (id = public.get_my_clinica_id() AND public.is_clinic_admin())
WITH CHECK (id = public.get_my_clinica_id() AND public.is_clinic_admin());

-- ============================================================
-- PARTE 4: DENTISTAS
-- Leitura: todos os membros ativos da clínica.
-- Update: somente o próprio registro (perfil).
-- Insert/Delete: service role apenas (onboarding, invite, remoção).
-- ============================================================

ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dentistas_select_clinic_members"
ON public.dentistas FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "dentistas_update_own"
ON public.dentistas FOR UPDATE TO authenticated
USING  (user_id = auth.uid() AND public.belongs_to_active_clinic(clinica_id))
WITH CHECK (user_id = auth.uid() AND public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 5: PACIENTES
-- Todos os roles da clínica: leitura e escrita.
-- ============================================================

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pacientes_all_clinic_members"
ON public.pacientes FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 6: FICHAS (PRONTUÁRIOS)
-- Leitura: todos os roles (secretária visualiza).
-- Escrita clínica: admin + dentista apenas.
-- Delete: admin apenas.
-- ============================================================

ALTER TABLE public.fichas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fichas_select_clinic_members"
ON public.fichas FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "fichas_insert_dentistas"
ON public.fichas FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

CREATE POLICY "fichas_update_dentistas"
ON public.fichas FOR UPDATE TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

CREATE POLICY "fichas_delete_admin"
ON public.fichas FOR DELETE TO authenticated
USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin());

-- ============================================================
-- PARTE 7: AGENDAMENTOS
-- Todos os roles da clínica: leitura e escrita.
-- Secretária cria/edita/cancela; dentista/admin idem.
-- ============================================================

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agendamentos_all_clinic_members"
ON public.agendamentos FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 8: HORARIOS_DISPONIVEIS
-- Leitura: todos da clínica.
-- Escrita: admin + dentista (próprio horário).
-- ============================================================

ALTER TABLE public.horarios_disponiveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_select_clinic_members"
ON public.horarios_disponiveis FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "horarios_write_dentistas"
ON public.horarios_disponiveis FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

-- ============================================================
-- PARTE 9: ORCAMENTOS
-- Leitura: todos.
-- Insert/Delete: admin + dentista.
-- Update: todos (secretária atualiza status operacional; app restringe campos).
-- ============================================================

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamentos_select_clinic_members"
ON public.orcamentos FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "orcamentos_insert_dentistas"
ON public.orcamentos FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

CREATE POLICY "orcamentos_update_clinic_members"
ON public.orcamentos FOR UPDATE TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "orcamentos_delete_dentistas"
ON public.orcamentos FOR DELETE TO authenticated
USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

-- ============================================================
-- PARTE 10: ORCAMENTO_ITENS
-- Segue os orçamentos: escrita somente dentistas.
-- ============================================================

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_itens_select_clinic_members"
ON public.orcamento_itens FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "orcamento_itens_write_dentistas"
ON public.orcamento_itens FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

-- ============================================================
-- PARTE 11: PAGAMENTOS
-- Todos os roles: operação de pagamento (registro é operacional).
-- ============================================================

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos_all_clinic_members"
ON public.pagamentos FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 12: DESPESAS (FINANCEIRO — INDIVIDUAL)
-- Financeiro é individual por dentista.
-- Admin/dentista: somente próprios registros.
-- Secretária: leitura + escrita operacional de toda a clínica.
-- ============================================================

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- SELECT: secretária vê tudo; admin/dentista vê apenas seus registros
CREATE POLICY "despesas_select"
ON public.despesas FOR SELECT TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
);

-- INSERT: qualquer membro da clínica
CREATE POLICY "despesas_insert"
ON public.despesas FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- UPDATE/DELETE: secretária (tudo na clínica) ou dono do registro
CREATE POLICY "despesas_update"
ON public.despesas FOR UPDATE TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
)
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "despesas_delete"
ON public.despesas FOR DELETE TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
);

-- ============================================================
-- PARTE 13: RECEITAS_MANUAIS (FINANCEIRO — INDIVIDUAL)
-- Mesmo padrão que despesas.
-- ============================================================

ALTER TABLE public.receitas_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receitas_manuais_select"
ON public.receitas_manuais FOR SELECT TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
);

CREATE POLICY "receitas_manuais_insert"
ON public.receitas_manuais FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "receitas_manuais_update"
ON public.receitas_manuais FOR UPDATE TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
)
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "receitas_manuais_delete"
ON public.receitas_manuais FOR DELETE TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    public.get_my_role() = 'secretaria'
    OR public.is_own_finance_record(dentista_id)
  )
);

-- ============================================================
-- PARTE 14: PROCEDIMENTOS
-- Leitura: todos.
-- Escrita: admin apenas (controle de catálogo da clínica).
-- ============================================================

ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedimentos_select_clinic_members"
ON public.procedimentos FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "procedimentos_write_admin"
ON public.procedimentos FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin());

-- ============================================================
-- PARTE 15: PROCEDIMENTOS_PADRAO
-- Dados de referência — leitura pública para autenticados.
-- Escrita: service role apenas.
-- ============================================================

ALTER TABLE public.procedimentos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procedimentos_padrao_select"
ON public.procedimentos_padrao FOR SELECT TO authenticated
USING (true);

-- ============================================================
-- PARTE 16: CONFIGURACOES_CLINICA
-- Leitura: todos.
-- Escrita: admin apenas.
-- ============================================================

ALTER TABLE public.configuracoes_clinica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_clinica_select"
ON public.configuracoes_clinica FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "configuracoes_clinica_write_admin"
ON public.configuracoes_clinica FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin());

-- ============================================================
-- PARTE 17: BOT_CONFIG
-- Leitura: todos.
-- Escrita: admin + secretária (whatsapp_config permission).
-- ============================================================

ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_config_select"
ON public.bot_config FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "bot_config_write_admin_secretaria"
ON public.bot_config FOR ALL TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND
  public.get_my_role() IN ('admin', 'secretaria')
)
WITH CHECK (
  public.belongs_to_active_clinic(clinica_id) AND
  public.get_my_role() IN ('admin', 'secretaria')
);

-- ============================================================
-- PARTE 18: INSTANCIAS_WHATSAPP
-- Leitura: todos.
-- Escrita: admin + secretária.
-- ============================================================

ALTER TABLE public.instancias_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instancias_whatsapp_select"
ON public.instancias_whatsapp FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "instancias_whatsapp_write_admin_secretaria"
ON public.instancias_whatsapp FOR UPDATE TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND
  public.get_my_role() IN ('admin', 'secretaria')
)
WITH CHECK (
  public.belongs_to_active_clinic(clinica_id) AND
  public.get_my_role() IN ('admin', 'secretaria')
);

-- ============================================================
-- PARTE 19: CONVERSAS_BOT / MENSAGENS_BOT
-- INSERT: somente via service role (webhook route no backend valida
--         assinatura antes de usar createServiceClient — sem policy
--         pública de INSERT para autenticados ou anônimos).
-- SELECT/UPDATE: membros da clínica.
-- ============================================================

ALTER TABLE public.conversas_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_bot_select"
ON public.conversas_bot FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "conversas_bot_update"
ON public.conversas_bot FOR UPDATE TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

ALTER TABLE public.mensagens_bot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_bot_select"
ON public.mensagens_bot FOR SELECT TO authenticated
USING (
  conversa_id IN (
    SELECT id FROM public.conversas_bot cb
    WHERE public.belongs_to_active_clinic(cb.clinica_id)
  )
);

-- ============================================================
-- PARTE 20: NOTIFICACOES
-- Leitura: registro destinado ao role atual ou à clínica.
-- Escrita: qualquer membro da clínica (service actions).
-- ============================================================

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select"
ON public.notificacoes FOR SELECT TO authenticated
USING (
  public.belongs_to_active_clinic(clinica_id) AND (
    para_role = 'all'
    OR para_role = public.get_my_role()
  )
);

CREATE POLICY "notificacoes_insert"
ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "notificacoes_update_own"
ON public.notificacoes FOR UPDATE TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 21: CONVITES
-- Leitura: admin da clínica.
-- Escrita: service role somente (via server actions com service client).
-- Não expor tokens client-side.
-- ============================================================

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "convites_select_admin"
ON public.convites FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin());

-- ============================================================
-- PARTE 22: CLINICA_USUARIOS
-- SELECT: próprio vínculo OU admin da clínica ativa.
-- Escrita: service role apenas.
-- ============================================================

ALTER TABLE public.clinica_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinica_usuarios_select"
ON public.clinica_usuarios FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR (
    public.is_clinic_admin() AND
    clinica_id = public.get_my_clinica_id()
  )
);

-- ============================================================
-- PARTE 23: USERS (IDENTIDADE)
-- Cada usuário acessa somente o próprio registro.
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_update_own"
ON public.users FOR UPDATE TO authenticated
USING  (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================
-- PARTE 24: SECRETARIAS
-- SELECT: próprio registro OU admin da clínica.
-- Escrita: service role apenas.
-- ============================================================

ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secretarias_select"
ON public.secretarias FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR (
    public.is_clinic_admin() AND
    clinica_id = public.get_my_clinica_id()
  )
);

-- ============================================================
-- PARTE 25: PACIENTE_DOCUMENTOS
-- Todos os membros da clínica: leitura e escrita.
-- ============================================================

ALTER TABLE public.paciente_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_documentos_all_clinic_members"
ON public.paciente_documentos FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id))
WITH CHECK (public.belongs_to_active_clinic(clinica_id));

-- ============================================================
-- PARTE 26: GOOGLE_TOKENS
-- Somente o próprio dentista acessa.
-- ============================================================

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_tokens_own"
ON public.google_tokens FOR ALL TO authenticated
USING (
  dentista_id IN (
    SELECT id FROM public.dentistas
    WHERE user_id = auth.uid()
      AND clinica_id = public.get_my_clinica_id()
  )
)
WITH CHECK (
  dentista_id IN (
    SELECT id FROM public.dentistas
    WHERE user_id = auth.uid()
      AND clinica_id = public.get_my_clinica_id()
  )
);

-- ============================================================
-- PARTE 27: PLANEJAMENTOS + ETAPAS (tabelas opcionais)
-- Escrita: admin + dentista. Leitura: todos.
-- Criadas em bloco condicional para evitar erro se não existirem.
-- ============================================================

DO $$
BEGIN
  -- planejamentos
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planejamentos'
  ) THEN
    ALTER TABLE public.planejamentos ENABLE ROW LEVEL SECURITY;

    EXECUTE $p$
      CREATE POLICY "planejamentos_select"
      ON public.planejamentos FOR SELECT TO authenticated
      USING (public.belongs_to_active_clinic(clinica_id))
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamentos_write_dentistas"
      ON public.planejamentos FOR INSERT TO authenticated
      WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamentos_update_dentistas"
      ON public.planejamentos FOR UPDATE TO authenticated
      USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
      WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamentos_delete_admin"
      ON public.planejamentos FOR DELETE TO authenticated
      USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin())
    $p$;
  END IF;

  -- planejamento_etapas
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'planejamento_etapas'
  ) THEN
    ALTER TABLE public.planejamento_etapas ENABLE ROW LEVEL SECURITY;

    EXECUTE $p$
      CREATE POLICY "planejamento_etapas_select"
      ON public.planejamento_etapas FOR SELECT TO authenticated
      USING (public.belongs_to_active_clinic(clinica_id))
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamento_etapas_write_dentistas"
      ON public.planejamento_etapas FOR INSERT TO authenticated
      WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamento_etapas_update_dentistas"
      ON public.planejamento_etapas FOR UPDATE TO authenticated
      USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
      WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
    $p$;

    EXECUTE $p$
      CREATE POLICY "planejamento_etapas_delete_admin"
      ON public.planejamento_etapas FOR DELETE TO authenticated
      USING (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_admin())
    $p$;
  END IF;
END $$;

-- ============================================================
-- PARTE 28: PLANEJAMENTO_SECOES + PROCEDIMENTOS (FIX BUG)
-- Fix: planejamento_procedimentos usava auth.uid() como clinica_id.
-- ============================================================

ALTER TABLE public.planejamento_secoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejamento_secoes_select"
ON public.planejamento_secoes FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "planejamento_secoes_write_dentistas"
ON public.planejamento_secoes FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

ALTER TABLE public.planejamento_procedimentos ENABLE ROW LEVEL SECURITY;

-- FIX: policy anterior usava auth.uid() como clinica_id (bug)
CREATE POLICY "planejamento_procedimentos_select"
ON public.planejamento_procedimentos FOR SELECT TO authenticated
USING (public.belongs_to_active_clinic(clinica_id));

CREATE POLICY "planejamento_procedimentos_write_dentistas"
ON public.planejamento_procedimentos FOR ALL TO authenticated
USING  (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista())
WITH CHECK (public.belongs_to_active_clinic(clinica_id) AND public.is_clinic_dentista());

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================

COMMIT;
