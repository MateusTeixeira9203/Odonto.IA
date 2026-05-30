type BillingOutcome =
  | 'processed'
  | 'skipped'
  | 'duplicate'
  | 'error'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'not_found'
  | 'unauthorized';

export interface BillingLog {
  provider: 'abacatepay';
  event_type: string;
  payment_id?: string;
  clinic_id?: string;
  plan?: string;
  outcome: BillingOutcome;
  reason?: string;
}

/**
 * Emite um log estruturado de evento de billing.
 * Campos mínimos: provider, event_type, outcome.
 * Todos os outros campos são opcionais mas devem ser preenchidos sempre que disponíveis.
 */
export function logBilling(entry: BillingLog): void {
  const tag = `[billing/${entry.provider}]`;
  const payload: Record<string, string | undefined> = {
    event_type: entry.event_type,
    outcome:    entry.outcome,
  };

  if (entry.payment_id) payload.payment_id = entry.payment_id;
  if (entry.clinic_id)  payload.clinic_id  = entry.clinic_id;
  if (entry.plan)       payload.plan       = entry.plan;
  if (entry.reason)     payload.reason     = entry.reason;

  if (entry.outcome === 'error' || entry.outcome === 'not_found') {
    console.error(tag, payload);
  } else if (
    entry.outcome === 'invalid_signature' ||
    entry.outcome === 'invalid_payload' ||
    entry.outcome === 'unauthorized'
  ) {
    console.warn(tag, payload);
  } else {
    console.log(tag, payload);
  }
}
