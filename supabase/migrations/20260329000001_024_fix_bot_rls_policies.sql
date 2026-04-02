-- Corrige policies de mensagens_bot e conversas_bot que usavam dentistas.id
-- em vez de dentistas.user_id (erro na migration 023).
-- Adiciona índices de performance para o painel WhatsApp.

DROP POLICY IF EXISTS "mensagens_select" ON mensagens_bot;
CREATE POLICY "mensagens_select" ON mensagens_bot
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM dentistas
      WHERE clinica_id = (
        SELECT clinica_id FROM conversas_bot WHERE id = mensagens_bot.conversa_id
      )
    )
  );

DROP POLICY IF EXISTS "conversas_select" ON conversas_bot;
CREATE POLICY "conversas_select" ON conversas_bot
  FOR SELECT
  USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversas_update" ON conversas_bot;
CREATE POLICY "conversas_update" ON conversas_bot
  FOR UPDATE
  USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_mensagens_bot_conversa    ON mensagens_bot(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_bot_conversa_ts ON mensagens_bot(conversa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversas_bot_clinica_ts  ON conversas_bot(clinica_id, ultimo_contato DESC);
