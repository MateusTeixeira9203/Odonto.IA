CREATE TABLE IF NOT EXISTS notificacoes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id   UUID        NOT NULL REFERENCES clinicas(id) ON DELETE CASCADE,
  para_role    TEXT        NOT NULL DEFAULT 'secretaria',
  de_dentista_id UUID      REFERENCES dentistas(id) ON DELETE SET NULL,
  tipo         TEXT        NOT NULL,
  titulo       TEXT        NOT NULL,
  mensagem     TEXT        NOT NULL,
  href         TEXT,
  lida         BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select" ON notificacoes
  FOR SELECT USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

CREATE POLICY "notificacoes_insert" ON notificacoes
  FOR INSERT WITH CHECK (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

CREATE POLICY "notificacoes_update" ON notificacoes
  FOR UPDATE USING (
    clinica_id IN (SELECT clinica_id FROM dentistas WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS notificacoes_clinica_lida_idx
  ON notificacoes (clinica_id, lida, created_at DESC);
