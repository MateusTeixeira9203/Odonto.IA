/**
 * POST /api/whatsapp/webhook
 *
 * Recebe eventos da Evolution API, processa mensagens recebidas e
 * responde via WhatsApp.
 *
 * Segurança: valida o header `apikey` contra EVOLUTION_API_KEY.
 *
 * Mapeamento de colunas (migration 002):
 *   telefone       = número do WhatsApp do paciente
 *   etapa          = estado atual da conversa
 *   ativo          = false quando transferido para humano
 *   ultimo_contato = timestamp da última interação
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWhatsAppText } from '@/lib/whatsapp/evolution';
import { processMessage, type ConversaBot } from '@/lib/whatsapp/message-handler';
import { STATES } from '@/lib/whatsapp/states';

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    messageType?: string;
  };
}

function extrairNumero(remoteJid: string): string {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function extrairTexto(payload: EvolutionWebhookPayload): string | null {
  const msg = payload.data?.message;
  if (!msg) return null;
  return msg.conversation ?? msg.extendedTextMessage?.text ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Valida autenticação do webhook
  const apiKey = req.headers.get('apikey');
  if (apiKey !== process.env.EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let payload: EvolutionWebhookPayload;
  try {
    payload = await req.json() as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Processa apenas mensagens recebidas (não enviadas pelo bot)
  if (payload.event !== 'messages.upsert' || payload.data?.key?.fromMe) {
    return NextResponse.json({ ok: true });
  }

  const texto = extrairTexto(payload);
  if (!texto?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const numero   = extrairNumero(payload.data.key.remoteJid);
  const instance = payload.instance;

  // Localiza a clínica via variável de ambiente (MVP)
  const clinicaId = process.env.EVOLUTION_DEFAULT_CLINICA_ID;
  if (!clinicaId) {
    console.error('[webhook] EVOLUTION_DEFAULT_CLINICA_ID não definida');
    return NextResponse.json({ error: 'Clínica não configurada' }, { status: 500 });
  }

  const db = createServiceClient();

  // Recupera conversa ativa ou cria nova (coluna: telefone)
  const { data: conversaExistente } = await db
    .from('conversas_bot')
    .select('*')
    .eq('clinica_id', clinicaId)
    .eq('telefone', numero)
    .order('ultimo_contato', { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversa: ConversaBot;

  if (conversaExistente) {
    conversa = conversaExistente as ConversaBot;
  } else {
    const { data: nova, error } = await db
      .from('conversas_bot')
      .insert({
        clinica_id: clinicaId,
        telefone:   numero,
        etapa:      STATES.INICIO,
        contexto:   {},
        ativo:      true,
      })
      .select()
      .single();

    if (error || !nova) {
      console.error('[webhook] Erro ao criar conversa:', error);
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
    conversa = nova as ConversaBot;
  }

  // Conversa transferida para humano (ativo = false) — não responde
  if (!conversa.ativo) {
    return NextResponse.json({ ok: true });
  }

  try {
    const resposta = await processMessage(conversa, texto);

    // Texto vazio = estado HUMANO, bot silencia (ativo já foi setado no handler)
    if (resposta.texto) {
      await sendWhatsAppText(instance, numero, resposta.texto);
    }
  } catch (err) {
    console.error('[webhook] Erro ao processar/enviar mensagem:', err);
    // Retorna 200 para Evolution API não reenviar o webhook
  }

  return NextResponse.json({ ok: true });
}
