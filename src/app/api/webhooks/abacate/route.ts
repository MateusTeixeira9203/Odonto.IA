import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { BillingConfirmedSchema } from '@/lib/billing/schemas';
import { logBilling } from '@/lib/billing/logger';
import { limiteDentistasParaPlano } from '@/lib/planos';
import type { PlanoId } from '@/lib/planos';

export const dynamic = 'force-dynamic';

const PROVIDER = 'abacatepay' as const;

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * POST /api/webhooks/abacate
 *
 * Recebe eventos de billing (assinatura de plano) da Abacate Pay.
 * Evento tratado: billing.confirmed
 *
 * Resolução de clínica:
 *   1. Lê clinicId de event.data.customer.metadata.clinicId (embedded no checkout).
 *   2. Fallback para users.active_clinica_id em eventos legados (sem clinicId).
 *
 * Segurança:
 *   - HMAC-SHA256 timing-safe em todos os requests
 *   - Zod valida shape do payload
 *   - Membership do usuário na clínica é validada antes do upgrade
 *   - Idempotência via billing_events.external_event_id UNIQUE
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

  // Extrai event type sem validação completa — skip barato para eventos irrelevantes
  const eventType = typeof raw === 'object' && raw !== null && 'event' in raw
    ? String((raw as Record<string, unknown>).event)
    : 'unknown';

  if (eventType !== 'billing.confirmed') {
    logBilling({ provider: PROVIDER, event_type: eventType, outcome: 'skipped' });
    return NextResponse.json({ received: true, skipped: true });
  }

  // Validação Zod completa apenas para eventos que serão processados
  const parsed = BillingConfirmedSchema.safeParse(raw);
  if (!parsed.success) {
    logBilling({ provider: PROVIDER, event_type: eventType, outcome: 'invalid_payload', reason: parsed.error.message });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const event    = parsed.data;
  const paymentId = event.data.id;
  const { userId, clinicId: clinicIdFromMeta, plano } = event.data.customer.metadata;
  const service  = createServiceClient();

  // ── 1. Resolução de clínica ────────────────────────────────────────────────
  //
  // Fonte primária: clinicId emitido no momento da criação do checkout (payment-time).
  // Sem esse campo, o evento é legado — resolve via active_clinica_id (race condition
  // conhecida: usuário pode ter trocado de clínica desde o checkout).

  let clinicId: string;

  if (clinicIdFromMeta) {
    clinicId = clinicIdFromMeta;
  } else {
    logBilling({
      provider: PROVIDER,
      event_type: eventType,
      payment_id: paymentId,
      outcome: 'skipped',
      reason: 'Legacy event: clinicId absent in metadata, falling back to active_clinica_id',
    });
    const { data: userRec } = await service
      .from('users')
      .select('active_clinica_id')
      .eq('id', userId)
      .maybeSingle();

    if (!userRec?.active_clinica_id) {
      logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, outcome: 'not_found', reason: 'User or active clinic not found' });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    clinicId = userRec.active_clinica_id as string;
  }

  // ── 2. Idempotência ────────────────────────────────────────────────────────

  const { data: existingEvent } = await service
    .from('billing_events')
    .select('id')
    .eq('external_event_id', paymentId)
    .maybeSingle();

  if (existingEvent) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinicId, plan: plano, outcome: 'duplicate' });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── 3. Validação de membership ─────────────────────────────────────────────
  //
  // userId deve ter membership ativa na clínica informada.
  // Impede que metadados adulterados upgradem clínicas de terceiros.

  const { data: membership } = await service
    .from('clinica_usuarios')
    .select('id')
    .eq('usuario_id', userId)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!membership) {
    logBilling({
      provider: PROVIDER, event_type: eventType, payment_id: paymentId,
      clinic_id: clinicId, outcome: 'unauthorized',
      reason: 'userId has no active membership in clinicId',
    });
    await service.from('billing_events').insert({
      external_event_id: paymentId,
      provider: PROVIDER,
      event_type: eventType,
      clinica_id: clinicId,
      outcome: 'error',
      payload: event.data as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── 4. Upgrade de plano ────────────────────────────────────────────────────

  const { error: updateError } = await service
    .from('clinicas')
    .update({
      plano,
      status_assinatura:  'ativo',
      trial_ends_at:      null,
      limite_dentistas:   limiteDentistasParaPlano(plano as PlanoId),
    })
    .eq('id', clinicId);

  if (updateError) {
    logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinicId, plan: plano, outcome: 'error', reason: 'DB update failed' });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }

  // ── 5. Registro de auditoria ───────────────────────────────────────────────

  await service.from('billing_events').insert({
    external_event_id: paymentId,
    provider:          PROVIDER,
    event_type:        eventType,
    clinica_id:        clinicId,
    outcome:           'processed',
    payload:           event.data as unknown as Record<string, unknown>,
  });

  logBilling({ provider: PROVIDER, event_type: eventType, payment_id: paymentId, clinic_id: clinicId, plan: plano, outcome: 'processed' });
  return NextResponse.json({ received: true });
}
