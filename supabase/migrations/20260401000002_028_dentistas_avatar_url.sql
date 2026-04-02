-- Adiciona coluna de avatar/foto de perfil aos dentistas
ALTER TABLE dentistas ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Cria bucket de avatares público (sem autenticação para leitura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
