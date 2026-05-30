-- Performance indexes for financial date-range queries
CREATE INDEX IF NOT EXISTS idx_pagamentos_clinica_data_pago
  ON pagamentos (clinica_id, data_pagamento)
  WHERE data_pagamento IS NOT NULL AND status = 'pago';

CREATE INDEX IF NOT EXISTS idx_pagamentos_clinica_dentista_status
  ON pagamentos (clinica_id, dentista_id, status);

CREATE INDEX IF NOT EXISTS idx_pagamentos_clinica_pendente
  ON pagamentos (clinica_id, status, data_vencimento)
  WHERE status = 'pendente';
