
CREATE TABLE IF NOT EXISTS procedimentos_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text,
  preco_sugerido numeric(10,2),
  duracao_minutos int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO procedimentos_padrao (nome, categoria, preco_sugerido, duracao_minutos) VALUES
('Consulta e avaliação', 'Geral', 150.00, 30),
('Limpeza (profilaxia)', 'Geral', 200.00, 45),
('Restauração simples (resina)', 'Restauração', 250.00, 60),
('Restauração composta (resina)', 'Restauração', 350.00, 90),
('Extração simples', 'Cirurgia', 250.00, 30),
('Extração de siso', 'Cirurgia', 600.00, 60),
('Tratamento de canal (unirradicular)', 'Endodontia', 800.00, 90),
('Tratamento de canal (birradicular)', 'Endodontia', 1000.00, 120),
('Tratamento de canal (multirradicular)', 'Endodontia', 1200.00, 120),
('Clareamento dental (caseiro)', 'Estética', 500.00, 30),
('Clareamento dental (LED)', 'Estética', 800.00, 90),
('Faceta de resina', 'Estética', 600.00, 60),
('Faceta de porcelana', 'Estética', 1500.00, 60),
('Prótese total (dentadura)', 'Prótese', 1800.00, 60),
('Prótese parcial removível', 'Prótese', 1200.00, 60),
('Coroa de porcelana', 'Prótese', 1500.00, 60),
('Implante dentário', 'Implante', 3500.00, 120),
('Raspagem periodontal', 'Periodontia', 350.00, 60),
('Gengivoplastia', 'Periodontia', 800.00, 60),
('Aplicação de flúor', 'Prevenção', 80.00, 20),
('Selante de fissura', 'Prevenção', 120.00, 30),
('Radiografia periapical', 'Radiologia', 50.00, 15),
('Radiografia panorâmica', 'Radiologia', 150.00, 15);
