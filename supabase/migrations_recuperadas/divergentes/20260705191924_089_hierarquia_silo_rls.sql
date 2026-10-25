-- Spec: plans/specs/spec-hierarquia-papeis-planos.md
-- Achata a hierarquia: cada dentista opera um silo proprio; secretaria e o hub que ve tudo.
-- admin perde a visao clinica ampla (so mantem poderes administrativos: convite/config).

-- ── Helper: dono OR secretaria ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_own_clinical_record(record_dentista_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT record_dentista_id = public.get_my_dentista_id()
    OR public.get_my_role() = 'secretaria'
$$;

-- ── pacientes: dono OR secretaria (secretaria cadastra e reatribui) ───────────
DROP POLICY IF EXISTS pacientes_access ON pacientes;
CREATE POLICY pacientes_access ON pacientes
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id))
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

-- ── fichas: SELECT dono OR secretaria; escrita so dono ────────────────────────
DROP POLICY IF EXISTS fichas_delete_admin ON fichas;
DROP POLICY IF EXISTS fichas_insert_dentistas ON fichas;
DROP POLICY IF EXISTS fichas_select_clinic_members ON fichas;
DROP POLICY IF EXISTS fichas_update_dentistas ON fichas;

CREATE POLICY fichas_select ON fichas
  FOR SELECT
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

CREATE POLICY fichas_write_own ON fichas
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND dentista_id = get_my_dentista_id())
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_clinic_dentista() AND dentista_id = get_my_dentista_id());

-- ── orcamentos: SELECT dono OR secretaria; INSERT/DELETE so dono; UPDATE dono OR secretaria ──
DROP POLICY IF EXISTS orcamentos_delete_dentistas ON orcamentos;
DROP POLICY IF EXISTS orcamentos_insert_dentistas ON orcamentos;
DROP POLICY IF EXISTS orcamentos_select_clinic_members ON orcamentos;
DROP POLICY IF EXISTS orcamentos_update_clinic_members ON orcamentos;

CREATE POLICY orcamentos_select ON orcamentos
  FOR SELECT
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

CREATE POLICY orcamentos_insert_own ON orcamentos
  FOR INSERT
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_clinic_dentista() AND dentista_id = get_my_dentista_id());

CREATE POLICY orcamentos_update ON orcamentos
  FOR UPDATE
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id))
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

CREATE POLICY orcamentos_delete_own ON orcamentos
  FOR DELETE
  USING (belongs_to_active_clinic(clinica_id) AND dentista_id = get_my_dentista_id());

-- ── orcamento_itens (sem dentista_id proprio; join via orcamento_id) ──────────
DROP POLICY IF EXISTS orcamento_itens_select_clinic_members ON orcamento_itens;
DROP POLICY IF EXISTS orcamento_itens_write_dentistas ON orcamento_itens;

CREATE POLICY orcamento_itens_select ON orcamento_itens
  FOR SELECT
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_itens.orcamento_id AND is_own_clinical_record(o.dentista_id))
  );

CREATE POLICY orcamento_itens_insert_own ON orcamento_itens
  FOR INSERT
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_itens.orcamento_id AND o.dentista_id = get_my_dentista_id())
  );

CREATE POLICY orcamento_itens_update ON orcamento_itens
  FOR UPDATE
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_itens.orcamento_id AND is_own_clinical_record(o.dentista_id))
  )
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_itens.orcamento_id AND is_own_clinical_record(o.dentista_id))
  );

CREATE POLICY orcamento_itens_delete_own ON orcamento_itens
  FOR DELETE
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM orcamentos o WHERE o.id = orcamento_itens.orcamento_id AND o.dentista_id = get_my_dentista_id())
  );

-- ── agendamentos: dono OR secretaria (ela agenda) ─────────────────────────────
DROP POLICY IF EXISTS agendamentos_all_clinic_members ON agendamentos;
CREATE POLICY agendamentos_access ON agendamentos
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id))
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

-- ── pagamentos: dono OR secretaria (ela recebe/lanca) ─────────────────────────
DROP POLICY IF EXISTS pagamentos_all_clinic_members ON pagamentos;
CREATE POLICY pagamentos_access ON pagamentos
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id))
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

-- ── planejamentos: SELECT dono OR secretaria; escrita so dono ────────────────
DROP POLICY IF EXISTS planejamentos_delete_admin ON planejamentos;
DROP POLICY IF EXISTS planejamentos_select ON planejamentos;
DROP POLICY IF EXISTS planejamentos_update_dentistas ON planejamentos;
DROP POLICY IF EXISTS planejamentos_write_dentistas ON planejamentos;

CREATE POLICY planejamentos_select ON planejamentos
  FOR SELECT
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

CREATE POLICY planejamentos_write_own ON planejamentos
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND dentista_id = get_my_dentista_id())
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_clinic_dentista() AND dentista_id = get_my_dentista_id());

-- ── planejamento_etapas (sem dentista_id proprio; join via planejamento_id) ──
DROP POLICY IF EXISTS planejamento_etapas_delete_admin ON planejamento_etapas;
DROP POLICY IF EXISTS planejamento_etapas_select ON planejamento_etapas;
DROP POLICY IF EXISTS planejamento_etapas_update_dentistas ON planejamento_etapas;
DROP POLICY IF EXISTS planejamento_etapas_write_dentistas ON planejamento_etapas;

CREATE POLICY planejamento_etapas_select ON planejamento_etapas
  FOR SELECT
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM planejamentos p WHERE p.id = planejamento_etapas.planejamento_id AND is_own_clinical_record(p.dentista_id))
  );

CREATE POLICY planejamento_etapas_write_own ON planejamento_etapas
  FOR ALL
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM planejamentos p WHERE p.id = planejamento_etapas.planejamento_id AND p.dentista_id = get_my_dentista_id())
  )
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM planejamentos p WHERE p.id = planejamento_etapas.planejamento_id AND p.dentista_id = get_my_dentista_id())
  );

-- ── planejamento_secoes (sem dentista_id proprio; join via paciente_id) ──────
DROP POLICY IF EXISTS planejamento_secoes_select ON planejamento_secoes;
DROP POLICY IF EXISTS planejamento_secoes_write_dentistas ON planejamento_secoes;

CREATE POLICY planejamento_secoes_select ON planejamento_secoes
  FOR SELECT
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_secoes.paciente_id AND is_own_clinical_record(pc.dentista_id))
  );

CREATE POLICY planejamento_secoes_write_own ON planejamento_secoes
  FOR ALL
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_secoes.paciente_id AND pc.dentista_id = get_my_dentista_id())
  )
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_secoes.paciente_id AND pc.dentista_id = get_my_dentista_id())
  );

-- ── planejamento_procedimentos (legado, nao escrito hoje; join via paciente_id) ──
DROP POLICY IF EXISTS planejamento_procedimentos_select ON planejamento_procedimentos;
DROP POLICY IF EXISTS planejamento_procedimentos_write_dentistas ON planejamento_procedimentos;

CREATE POLICY planejamento_procedimentos_select ON planejamento_procedimentos
  FOR SELECT
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_procedimentos.paciente_id AND is_own_clinical_record(pc.dentista_id))
  );

CREATE POLICY planejamento_procedimentos_write_own ON planejamento_procedimentos
  FOR ALL
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_procedimentos.paciente_id AND pc.dentista_id = get_my_dentista_id())
  )
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = planejamento_procedimentos.paciente_id AND pc.dentista_id = get_my_dentista_id())
  );

-- ── paciente_documentos: dono OR secretaria (join via paciente_id) ───────────
DROP POLICY IF EXISTS paciente_documentos_all_clinic_members ON paciente_documentos;
CREATE POLICY paciente_documentos_access ON paciente_documentos
  FOR ALL
  USING (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = paciente_documentos.paciente_id AND is_own_clinical_record(pc.dentista_id))
  )
  WITH CHECK (
    belongs_to_active_clinic(clinica_id)
    AND EXISTS (SELECT 1 FROM pacientes pc WHERE pc.id = paciente_documentos.paciente_id AND is_own_clinical_record(pc.dentista_id))
  );

-- ── procedimentos (catalogo): SELECT dono OR secretaria; escrita so dono (remove admin) ──
DROP POLICY IF EXISTS procedimentos_delete_own_or_admin ON procedimentos;
DROP POLICY IF EXISTS procedimentos_insert_own ON procedimentos;
DROP POLICY IF EXISTS procedimentos_select_own_admin_secretaria ON procedimentos;
DROP POLICY IF EXISTS procedimentos_update_own_or_admin ON procedimentos;

CREATE POLICY procedimentos_select ON procedimentos
  FOR SELECT
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

CREATE POLICY procedimentos_write_own ON procedimentos
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND dentista_id = get_my_dentista_id())
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_clinic_dentista() AND dentista_id = get_my_dentista_id());

-- ── horarios_disponiveis: dentista so a propria agenda; secretaria/bot veem/gerenciam todas ──
DROP POLICY IF EXISTS horarios_select_clinic_members ON horarios_disponiveis;
DROP POLICY IF EXISTS horarios_write_dentistas ON horarios_disponiveis;

CREATE POLICY horarios_access ON horarios_disponiveis
  FOR ALL
  USING (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id))
  WITH CHECK (belongs_to_active_clinic(clinica_id) AND is_own_clinical_record(dentista_id));

-- ── clinicas.plano: remove BASICO (fundido em CLINICA) ────────────────────────
UPDATE clinicas SET plano = 'CLINICA' WHERE plano = 'BASICO';
UPDATE clinicas SET limite_dentistas = 5 WHERE plano = 'CLINICA' AND limite_dentistas > 5;

ALTER TABLE clinicas DROP CONSTRAINT IF EXISTS clinicas_plano_check;
ALTER TABLE clinicas ADD CONSTRAINT clinicas_plano_check CHECK (plano = ANY (ARRAY['SOLO'::text, 'CLINICA'::text]));
