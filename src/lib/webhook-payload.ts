/**
 * Standardized outbound webhook payload shape for future integrations.
 *
 * When the system needs to emit events to external services (Zapier, n8n,
 * custom webhooks, etc.), all payloads must follow this structure so
 * downstream consumers have a consistent contract.
 *
 * Example future usage:
 *   const payload = buildWebhookPayload(EVENTS.ORCAMENTO_APROVADO, {
 *     clinicaId: '...',
 *     entityType: ENTITY_TYPES.ORCAMENTO,
 *     entityId: orcamento.id,
 *     actorId: dentista.id,
 *     data: { paciente_nome: paciente.nome, total: orcamento.total },
 *   });
 *   await emitWebhook(clinicaId, payload);
 */

import type { OdontoEvent, EntityType } from './events';

export type WebhookPayload = {
  /** Odonto.IA event name — dot-notation (e.g. 'orcamento.aprovado') */
  event:       OdontoEvent;
  /** ISO 8601 timestamp of when the event occurred */
  timestamp:   string;
  /** Clinic that owns the event */
  clinica_id:  string;
  /** Entity that triggered the event */
  entity: {
    type: EntityType;
    id:   string;
  };
  /** User (dentista/secretaria) who triggered the action */
  actor?: {
    id:   string;
    nome: string;
  };
  /** Event-specific data — structure depends on event type */
  data?: Record<string, unknown>;
};

/** Builds a typed, timestamped webhook payload ready for delivery */
export function buildWebhookPayload(
  event: OdontoEvent,
  params: {
    clinicaId:  string;
    entityType: EntityType;
    entityId:   string;
    actorId?:   string;
    actorNome?: string;
    data?:      Record<string, unknown>;
  },
): WebhookPayload {
  const payload: WebhookPayload = {
    event,
    timestamp:  new Date().toISOString(),
    clinica_id: params.clinicaId,
    entity: {
      type: params.entityType,
      id:   params.entityId,
    },
    data: params.data,
  };

  if (params.actorId) {
    payload.actor = {
      id:   params.actorId,
      nome: params.actorNome ?? '',
    };
  }

  return payload;
}
