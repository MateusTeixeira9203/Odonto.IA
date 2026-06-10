-- Adiciona 'pago' como status válido de orçamento
ALTER TABLE orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_status_check;

ALTER TABLE orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'pago'));
