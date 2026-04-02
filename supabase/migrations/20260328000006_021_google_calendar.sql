-- google_tokens: armazena tokens OAuth2 do Google Calendar por dentista
CREATE TABLE google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dentista_id UUID REFERENCES dentistas(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Dentista acessa apenas seus próprios tokens (via user_id em dentistas)
CREATE POLICY "google_tokens_own_policy" ON google_tokens
  FOR ALL TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM dentistas WHERE id = google_tokens.dentista_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM dentistas WHERE id = google_tokens.dentista_id)
  );

-- Coluna para rastrear o event_id do Google Calendar por agendamento
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS google_event_id TEXT;
