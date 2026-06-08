import { z } from 'zod';

// ── Subscription billing — POST /api/webhooks/abacate ─────────────────────────
//
// Evento enviado pela Abacate Pay quando uma assinatura de plano é confirmada.
// `clinicId` ausente em eventos legados (criados antes de embedermos o ID no checkout).

export const BillingConfirmedSchema = z.object({
  event: z.literal('billing.confirmed'),
  data: z.object({
    id: z.string().min(1),
    status: z.string(),
    customer: z.object({
      email: z.string().optional(),
      metadata: z.object({
        userId: z.string().min(1),
        clinicId: z.string().min(1).optional(), // opcional: backward compat com checkouts antigos
        plano: z.enum(['SOLO', 'BASICO', 'CLINICA']), // BASICO mantido para backward compat com webhooks antigos
      }),
    }),
  }),
});

export type BillingConfirmedEvent = z.infer<typeof BillingConfirmedSchema>;

// ── Charge payment — POST /api/webhooks/abacatepay ────────────────────────────
//
// Evento enviado quando uma cobrança avulsa (Pix/boleto) de paciente é paga.
// `clinicId` é emitido diretamente no campo `data.metadata.clinica_id`.

export const ChargeEventSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.string().min(1),
    status: z.string(),
    amount: z.number().int().min(1),
    metadata: z
      .object({
        orcamento_id: z.string().min(1),
        paciente_id: z.string().min(1),
        clinica_id: z.string().min(1),
        forma_pagamento: z.string().optional(),
      })
      .optional(),
  }),
});

export type ChargeEvent = z.infer<typeof ChargeEventSchema>;
