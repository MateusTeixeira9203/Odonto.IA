import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ChargeEventSchema } from '@/lib/billing/schemas';
import { logBilling } from '@/lib/billing/logger';

export const dynamic = 'force-dynamic';

const PROVIDER = 'abacatepay' as const;

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * POST /api/webhooks/abacatepay
 *
 * Recebe confirmações de pagamento de cobrança Pix/boleto da Abacate Pay
 * e registra o pagamento no orçamento vinculado.
 *
 * Diferente de /api/webhooks/abacate (billing de assinatura de plano),
 * este endpoint trata cobranças avulsas de pacientes.
 *
 * Resolução de clínica:
 *   Lida diretamente do campo metadata.clinica_id embedded na cobrança.
 *   Validada cruzando com o orcamento_id via eq('clinica_id', clinica_id).
 *
 * Segurança:
 *   - HMAC-SHA256 timing-safe
 *   - Zod valida shape do payload
 *   - Clínica validada via cross-check com orcamentos.clinica_id
 *   - Idempotência via pagamentos.external_payment_id UNIQUE
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.ABACATE_PAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logBilling({ provider: PROVIDER, event_type: 'unknown', outcome: 'error', reason: 'ABACATE_PAY_WEBHOOK_SECRET not configured' });
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-webhook-signature') ?? '';

  if (!verifySignature(body, signature, webhookSecret)) {
    logBilling({ provider: PROVIDER, event_type: 'unknown', outcome: 'invalid_signature' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const parsed = ChargeEventSchema.safeParse(raw);
  if (!parsed.success) {
    logBilling({ provider: PROVIDER, event_type: 'unknown', outcome: 'invalid_payload', reason: parsed.error.message });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const event     = parsed.data;
  const eventType = event.event;
  const paymentId = event.data.id;

  if (eventType !== 'charge.paid' && eventType !== 'billing.confirmed') {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, outcome: 'skipped' });
    return NextResponse.json({ received: true, skipped: true });
  }

  const meta = event.data.metadata;
  if (!meta?.orcamento_id || !meta.paciente_id || !meta.clinica_id) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, outcome: 'invalid_payload', reason: 'Missing required metadata fields' });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { orcamento_id, paciente_id, clinica_id, forma_pagamento } = meta;
  const service = createServiceClient();

  // ── 1. Idempotência ────────────────────────────────────────────────────────

  const { data: existingPag } = await service
    .from('pagamentos')
    .select('id')
    .eq('external_payment_id', paymentId)
    .maybeSingle();

  if (existingPag) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinica_id, outcome: 'duplicate' });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── 2. Validação cruzada: orçamento pertence à clínica ────────────────────

  const { data: orcamento, error: orcError } = await service
    .from('orcamentos')
    .select('id, status, dentista_id, total')
    .eq('id', orcamento_id)
    .eq('clinica_id', clinica_id)
    .maybeSingle();

  if (orcError || !orcamento) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinica_id, outcome: 'not_found', reason: `orcamento_id=${orcamento_id} not found for clinica_id=${clinica_id}` });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── 3. Registrar pagamento ─────────────────────────────────────────────────

  const valorReais = event.data.amount / 100;
  const hoje = new Date().toISOString().split('T')[0];

  const { error: pagError } = await service.from('pagamentos').insert({
    orcamento_id,
    paciente_id,
    dentista_id:          orcamento.dentista_id ?? null,
    clinica_id,
    valor:                valorReais,
    status:               'pago',
    forma_pagamento:      forma_pagamento ?? 'pix',
    data_pagamento:       hoje,
    external_payment_id:  paymentId,
  });

  if (pagError) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinica_id, outcome: 'error', reason: 'Failed to insert pagamento' });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  // ── 4. Atualizar status do orçamento ──────────────────────────────────────

  if (orcamento.status !== 'aprovado') {
    await service
      .from('orcamentos')
      .update({ status: 'aprovado' })
      .eq('id', orcamento_id)
      .eq('clinica_id', clinica_id);
  }

  logBilling({
    provider: PROVIDER,
    event_type: eventType,
    payment_id: paymentId,
    clinic_id: clinica_id,
    outcome: 'processed',
    reason: `R$ ${valorReais.toFixed(2)} — orcamento_id=${orcamento_id}`,
  });
  return NextResponse.json({ received: true });
}
