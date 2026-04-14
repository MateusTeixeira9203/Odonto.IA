import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Payload de evento de cobrança da Abacate Pay.
 * Usado para pagamentos avulsos (Pix/boleto) vinculados a orçamentos.
 */
interface AbacateChargeEvent {
  event: string;
  data: {
    id: string;
    status: string;
    amount: number; // em centavos
    metadata?: {
      orcamento_id?: string;
      paciente_id?: string;
      clinica_id?: string;
      forma_pagamento?: string;
    };
  };
}

/**
 * POST /api/webhooks/abacatepay
 * Recebe confirmações de pagamento de cobrança Pix/boleto da Abacate Pay
 * e registra o pagamento no orçamento vinculado.
 *
 * Diferente de /api/webhooks/abacate (billing de assinaturas de plano),
 * este endpoint trata cobranças avulsas de pacientes.
 *
 * Metadados esperados na cobrança:
 *   metadata.orcamento_id — ID do orçamento a ser pago
 *   metadata.paciente_id  — ID do paciente
 *   metadata.clinica_id   — ID da clínica (validação extra)
 *   metadata.forma_pagamento — "pix" | "boleto" (opcional, default "pix")
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.ABACATE_PAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[AbacatePay Webhook] ABACATE_PAY_WEBHOOK_SECRET não configurado');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();

  // Verificação de assinatura HMAC-SHA256 (mesmo padrão do webhook de billing)
  const signature = request.headers.get('x-webhook-signature') ?? '';
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

  if (signature.length !== expectedSignature.length) {
    console.warn('[AbacatePay Webhook] Tamanho de assinatura inválido');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('[AbacatePay Webhook] Assinatura inválida');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: AbacateChargeEvent;
  try {
    event = JSON.parse(body) as AbacateChargeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Apenas processa confirmações de cobrança
  if (event.event !== 'charge.paid' && event.event !== 'billing.confirmed') {
    return NextResponse.json({ received: true, skipped: true });
  }

  const { orcamento_id, paciente_id, clinica_id, forma_pagamento } = event.data.metadata ?? {};

  if (!orcamento_id || !paciente_id || !clinica_id) {
    console.error('[AbacatePay Webhook] Metadados de orçamento ausentes:', event.data.metadata);
    return NextResponse.json(
      { error: 'Missing metadata (orcamento_id, paciente_id, clinica_id)' },
      { status: 400 },
    );
  }

  const valorReais = event.data.amount / 100; // Abacate Pay envia em centavos
  const hoje = new Date().toISOString().split('T')[0];

  const service = createServiceClient();

  // Verifica que o orçamento pertence à clínica informada
  const { data: orcamento, error: orcError } = await service
    .from('orcamentos')
    .select('id, status, dentista_id, total')
    .eq('id', orcamento_id)
    .eq('clinica_id', clinica_id)
    .maybeSingle();

  if (orcError || !orcamento) {
    console.error('[AbacatePay Webhook] Orçamento não encontrado:', { orcamento_id, clinica_id });
    return NextResponse.json({ error: 'Orcamento not found' }, { status: 404 });
  }

  // Insere o registro de pagamento
  const { error: pagError } = await service.from('pagamentos').insert({
    orcamento_id,
    paciente_id,
    dentista_id: orcamento.dentista_id ?? null,
    clinica_id,
    valor: valorReais,
    status: 'pago',
    forma_pagamento: forma_pagamento ?? 'pix',
    data_pagamento: hoje,
  });

  if (pagError) {
    console.error('[AbacatePay Webhook] Erro ao inserir pagamento:', pagError);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }

  // Atualiza o status do orçamento para 'aprovado' se ainda não estava
  if (orcamento.status !== 'aprovado') {
    await service
      .from('orcamentos')
      .update({ status: 'aprovado' })
      .eq('id', orcamento_id)
      .eq('clinica_id', clinica_id);
  }

  console.log(
    `[AbacatePay Webhook] Pagamento R$ ${valorReais.toFixed(2)} registrado — orcamento_id=${orcamento_id}`,
  );
  return NextResponse.json({ received: true });
}
