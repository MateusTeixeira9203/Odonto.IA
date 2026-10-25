-- Fix: auth.uid() avaliado uma vez por query em vez de por linha
-- Tabelas afetadas: agendamentos, pagamentos, dentistas, planejamentos,
-- planejamento_etapas, planejamento_secoes, paciente_documentos,
-- horarios_disponiveis, notificacoes, despesas, google_tokens,
-- bot_config, ficha_arquivos

-- agendamentos
DROP POLICY IF EXISTS agendamentos_dentista_policy ON agendamentos;
DROP POLICY IF EXISTS agendamentos_secretaria_policy ON agendamentos;

CREATE POLICY agendamentos_dentista_policy ON agendamentos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY agendamentos_secretaria_policy ON agendamentos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
        AND role = 'secretaria'
    )
  );

-- pagamentos
DROP POLICY IF EXISTS pagamentos_all_policy ON pagamentos;
CREATE POLICY pagamentos_all_policy ON pagamentos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- dentistas (insert)
DROP POLICY IF EXISTS dentistas_insert_own_policy ON dentistas;
CREATE POLICY dentistas_insert_own_policy ON dentistas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- planejamentos
DROP POLICY IF EXISTS planejamentos_all_policy ON planejamentos;
CREATE POLICY planejamentos_all_policy ON planejamentos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- planejamento_etapas
DROP POLICY IF EXISTS planejamento_etapas_all_policy ON planejamento_etapas;
CREATE POLICY planejamento_etapas_all_policy ON planejamento_etapas
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- planejamento_secoes
DROP POLICY IF EXISTS planejamento_secoes_policy ON planejamento_secoes;
CREATE POLICY planejamento_secoes_policy ON planejamento_secoes
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- paciente_documentos
DROP POLICY IF EXISTS paciente_documentos_policy ON paciente_documentos;
CREATE POLICY paciente_documentos_policy ON paciente_documentos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- horarios_disponiveis
DROP POLICY IF EXISTS horarios_disponiveis_all_policy ON horarios_disponiveis;
CREATE POLICY horarios_disponiveis_all_policy ON horarios_disponiveis
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- notificacoes
DROP POLICY IF EXISTS notificacoes_select ON notificacoes;
DROP POLICY IF EXISTS notificacoes_insert ON notificacoes;
DROP POLICY IF EXISTS notificacoes_update ON notificacoes;

CREATE POLICY notificacoes_select ON notificacoes
  FOR SELECT TO authenticated
  USING (
    para_dentista_id IN (
      SELECT id FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY notificacoes_insert ON notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id IN (
      SELECT clinica_id FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY notificacoes_update ON notificacoes
  FOR UPDATE TO authenticated
  USING (
    para_dentista_id IN (
      SELECT id FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

-- despesas
DROP POLICY IF EXISTS despesas_all_policy ON despesas;
CREATE POLICY despesas_all_policy ON despesas
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- google_tokens
DROP POLICY IF EXISTS google_tokens_own_policy ON google_tokens;
CREATE POLICY google_tokens_own_policy ON google_tokens
  FOR ALL TO authenticated
  USING (dentista_id IN (
    SELECT id FROM dentistas WHERE user_id = (SELECT auth.uid())
  ));

-- bot_config
DROP POLICY IF EXISTS bot_config_manage ON bot_config;
CREATE POLICY bot_config_manage ON bot_config
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- ficha_arquivos
DROP POLICY IF EXISTS ficha_arquivos_all_policy ON ficha_arquivos;
CREATE POLICY ficha_arquivos_all_policy ON ficha_arquivos
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- receitas_manuais
DROP POLICY IF EXISTS receitas_manuais_all_policy ON receitas_manuais;
CREATE POLICY receitas_manuais_all_policy ON receitas_manuais
  FOR ALL TO authenticated
  USING (
    clinica_id IN (
      SELECT clinica_id FROM dentistas
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Índices faltando para FKs sem cobertura
CREATE INDEX IF NOT EXISTS idx_agendamentos_created_by ON agendamentos(created_by);
CREATE INDEX IF NOT EXISTS idx_notificacoes_de_dentista_id ON notificacoes(de_dentista_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_etapas_clinica_id ON planejamento_etapas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_secoes_clinica_id ON planejamento_secoes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_secoes_paciente_id ON planejamento_secoes(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planejamentos_clinica_id ON planejamentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_planejamentos_dentista_id ON planejamentos(dentista_id);
CREATE INDEX IF NOT EXISTS idx_receitas_manuais_dentista_id ON receitas_manuais(dentista_id);

-- Índice duplicado em configuracoes_clinica
DROP INDEX IF EXISTS idx_configuracoes_clinica_clinica_id;

-- Índices duplicados em mensagens_bot
DROP INDEX IF EXISTS idx_mensagens_bot_conversa_id;
DROP INDEX IF EXISTS idx_mensagens_bot_created_at;