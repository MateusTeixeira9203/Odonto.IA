import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { handleIncomingMessage } from '@/lib/whatsapp/bot-engine';
import type { WabaMessage, WabaIncomingMessage } from '@/lib/whatsapp/types';

// GET — verificação do webhook exigida pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // token nulo/vazio nunca deve casar com rows sem token configurado
  if (mode !== 'subscribe' || !challenge || !token) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: config } = await supabase
    .from('bot_config')
    .select('webhook_verify_token')
    .eq('webhook_verify_token', token)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// POST — recebe mensagens e eventos
export async function POST(req: NextRequest) {
  // Verifica assinatura HMAC-SHA256 da Meta (X-Hub-Signature-256)
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const sig     = req.headers.get('x-hub-signature-256');
    const rawBody = await req.text();

    if (!sig) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    try {
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: WabaMessage;
    try {
      body = JSON.parse(rawBody) as WabaMessage;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    return processWebhook(body);
  }

  // Sem META_APP_SECRET configurado — aceita mas loga aviso (setup inicial)
  let body: WabaMessage;
  try {
    body = await req.json() as WabaMessage;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  console.warn('[webhook/whatsapp] META_APP_SECRET não configurado — verificação de assinatura desabilitada');
  return processWebhook(body);
}

async function processWebhook(body: WabaMessage): Promise<NextResponse> {
  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;

      const { value } = change;
      const phoneNumberId = value.metadata.phone_number_id;

      for (const msg of value.messages ?? []) {
        const contact = value.contacts?.find((c) => c.wa_id === msg.from);
        await handleIncomingMessage({
          phoneNumberId,
          from: msg.from,
          fromName: contact?.profile.name ?? '',
          message: msg as WabaIncomingMessage,
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}
