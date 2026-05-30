-- Migration 061: Billing idempotency
--
-- billing_events: tabela de auditoria e idempotência para webhooks de pagamento.
--   Garante que o mesmo evento não seja processado mais de uma vez via UNIQUE em external_event_id.
--
-- pagamentos.external_payment_id: vincula um pagamento ao ID de cobrança do provedor.
--   Permite idempotência no webhook de cobranças avulsas.

-- ── billing_events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id text        NOT NULL,
  provider          text        NOT NULL CHECK (provider IN ('abacatepay')),
  event_type        text        NOT NULL,
  clinica_id        uuid        REFERENCES clinicas(id) ON DELETE SET NULL,
  outcome           text        NOT NULL DEFAULT 'processed'
                                CHECK (outcome IN ('processed', 'duplicate', 'error')),
  payload           jsonb       NOT NULL DEFAULT '{}',
  processed_at      timestamptz NOT NULL DEFAULT now()
);

-- UNIQUE no external_event_id garante deduplicação de eventos duplicados
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_external_id
  ON billing_events(external_event_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_clinica_id
  ON billing_events(clinica_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_processed_at
  ON billing_events(processed_at DESC);

-- RLS habilitado; apenas service role acessa (sem política user-facing por ora)
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- ── pagamentos.external_payment_id ───────────────────────────────────────────

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS external_payment_id text;

-- Índice único parcial: deduplicação sem penalizar rows sem external_payment_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_external_payment_id
  ON pagamentos(external_payment_id)
  WHERE external_payment_id IS NOT NULL;
