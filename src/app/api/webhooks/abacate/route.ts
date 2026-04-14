import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { PlanoId } from '@/lib/planos';

// Garante que a rota não seja cacheada (execução sempre dinâmica)
export const dynamic = 'force-dynamic';

interface AbacateBillingEvent {
  event: string;
  data: {
    id: string;
    status: string;
    customer?: {
      email?: string;
      metadata?: {
        userId?: string;
        plano?: string;
      };
    };
  };
}

/**
 * POST /api/webhooks/abacate
 * Recebe eventos da Abacate Pay e atualiza o plano/status da clínica.
 * Evento tratado: billing.confirmed
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.ABACATE_PAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Abacate Webhook] ABACATE_PAY_WEBHOOK_SECRET não configurado');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();

  // Verificação de assinatura HMAC-SHA256
  const signature = request.headers.get('x-webhook-signature') ?? '';
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  ) {
    console.warn('[Abacate Webhook] Assinatura inválida');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: AbacateBillingEvent;
  try {
    event = JSON.parse(body) as AbacateBillingEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Apenas processa confirmações de pagamento
  if (event.event !== 'billing.confirmed') {
    return NextResponse.json({ received: true, skipped: true });
  }

  const userId = event.data.customer?.metadata?.userId;
  const planoRaw = event.data.customer?.metadata?.plano;
  const email = event.data.customer?.email;

  if (!userId || !planoRaw) {
    console.error('[Abacate Webhook] Metadados ausentes:', { userId, planoRaw, email });
    return NextResponse.json({ error: 'Missing metadata (userId or plano)' }, { status: 400 });
  }

  const validPlanos: PlanoId[] = ['SOLO', 'BASICO', 'CLINICA'];
  if (!validPlanos.includes(planoRaw as PlanoId)) {
    console.error('[Abacate Webhook] Plano inválido:', planoRaw);
    return NextResponse.json({ error: `Invalid plan: ${planoRaw}` }, { status: 400 });
  }

  const plano = planoRaw as PlanoId;
  const service = createServiceClient();

  // Busca a clínica do usuário
  const { data: dentista, error: dentistaErr } = await service
    .from('dentistas')
    .select('clinica_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (dentistaErr || !dentista) {
    console.error('[Abacate Webhook] Dentista não encontrado para userId:', userId, dentistaErr);
    return NextResponse.json({ error: 'Dentista not found' }, { status: 404 });
  }

  // Atualiza plano, status e remove trial
  const { error: updateError } = await service
    .from('clinicas')
    .update({
      plano,
      status_assinatura: 'ativo',
      trial_ends_at: null,
    })
    .eq('id', dentista.clinica_id);

  if (updateError) {
    console.error('[Abacate Webhook] Erro ao atualizar clínica:', updateError);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }

  console.log(`[Abacate Webhook] Plano ${plano} ativado para clinica_id=${dentista.clinica_id}`);
  return NextResponse.json({ received: true });
}
