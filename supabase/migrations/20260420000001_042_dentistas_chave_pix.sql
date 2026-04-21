-- Adiciona campo chave_pix na tabela dentistas
-- Cada dentista pode cadastrar sua própria chave PIX para receber pagamentos

ALTER TABLE dentistas ADD COLUMN IF NOT EXISTS chave_pix text;
