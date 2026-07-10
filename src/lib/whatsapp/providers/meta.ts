/**
 * Adaptador Meta WhatsApp Business API (Graph API v25.0).
 *
 * ─── COMO PLUGAR O CORAÇÃO ────────────────────────────────────────────────────
 * 1. Preencha no .env.local:
 *      WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx      ← do painel Meta → Configuração da API
 *      WHATSAPP_APP_SECRET=xxxxxxxxx         ← Meta App → Configurações → Segredo do app
 *      WHATSAPP_VERIFY_TOKEN=qualquer-string ← você inventa, deve bater com o webhook config
 *      WHATSAPP_PHONE_NUMBER_ID=113490...    ← "Identificação do número de telefone" no painel
 *
 * 2. No painel Meta → Webhook → Configurar:
 *      URL:          https://sua-url.app/api/whatsapp/webhook
 *      Verify token: igual ao WHATSAPP_VERIFY_TOKEN acima
 *      Assinar campos: messages, message_deliveries
 *
 * 3. Remova os comentários "TODO: stub" abaixo conforme implementar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type {
  WhatsAppProvider,
  InboundMessage,
  InteractiveListOptions,
} from '../provider';

const GRAPH_URL = 'https://graph.facebook.com/v25.0';

// ─── Tipos internos do payload Meta ───────────────────────────────────────────

interface MetaTextMessage {
  type: 'text';
  text: { body: string };
}

interface MetaImageMessage {
  type: 'image';
  image: { id: string; mime_type: string };
}

interface MetaDocumentMessage {
  type: 'document';
  document: { id: string; mime_type: string };
}

interface MetaInteractiveMessage {
  type: 'interactive';
  interactive: {
    type: 'list_reply' | 'button_reply';
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

type MetaMessage =
  | MetaTextMessage
  | MetaImageMessage
  | MetaDocumentMessage
  | MetaInteractiveMessage
  | { type: string };

interface MetaWebhookEntry {
  changes: Array<{
    value: {
      metadata: {
        phone_number_id: string;
        display_phone_number: string;
      };
      messages?: Array<
        MetaMessage & {
          id: string;
          from: string;
          profile?: { name: string };
        }
      >;
    };
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

// ─── Adaptador ────────────────────────────────────────────────────────────────

export class MetaProvider implements WhatsAppProvider {

  private get accessToken(): string {
    const t = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!t) throw new Error('WHATSAPP_ACCESS_TOKEN não definida — preencha o .env.local');
    return t;
  }

  private get appSecret(): string {
    const s = process.env.WHATSAPP_APP_SECRET;
    if (!s) throw new Error('WHATSAPP_APP_SECRET não definida — preencha o .env.local');
    return s;
  }

  private get verifyToken(): string {
    const v = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!v) throw new Error('WHATSAPP_VERIFY_TOKEN não definida — preencha o .env.local');
    return v;
  }

  private headers(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // ── sendText ────────────────────────────────────────────────────────────────

  async sendText(phoneNumberId: string, to: string, text: string): Promise<void> {
    // TODO: stub — descomentar quando credenciais estiverem no .env.local
    /*
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }
    */
    console.log(`[meta:sendText] TODO phoneNumberId=${phoneNumberId} to=${to} text="${text.slice(0, 60)}..."`);
  }

  // ── sendFile ────────────────────────────────────────────────────────────────

  async sendFile(
    phoneNumberId: string,
    to: string,
    base64: string,
    filename: string,
    caption?: string,
    mimeType = 'application/pdf',
  ): Promise<void> {
    // TODO: stub — Meta requer upload de mídia em 2 etapas:
    //   1. POST /{phone-number-id}/media → retorna media_id
    //   2. POST /{phone-number-id}/messages com { type: 'document', document: { id: media_id } }
    /*
    // Etapa 1: upload
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mimeType }), filename);
    form.append('type', mimeType);
    form.append('messaging_product', 'whatsapp');

    const uploadRes = await fetch(`${GRAPH_URL}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form,
    });
    if (!uploadRes.ok) throw new Error(`Meta upload erro ${uploadRes.status}`);
    const { id: mediaId } = await uploadRes.json() as { id: string };

    // Etapa 2: envio
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: { id: mediaId, filename, caption: caption ?? '' },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }
    */
    console.log(`[meta:sendFile] TODO phoneNumberId=${phoneNumberId} to=${to} file=${filename}`);
  }

  // ── sendInteractiveList ─────────────────────────────────────────────────────

  async sendInteractiveList(
    phoneNumberId: string,
    to: string,
    opts: InteractiveListOptions,
  ): Promise<void> {
    // TODO: stub — lista interativa requer WABA aprovado pela Meta.
    //   Formato: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages
    /*
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: opts.title },
          body: { text: opts.description },
          footer: opts.footer ? { text: opts.footer } : undefined,
          action: {
            button: opts.buttonText,
            sections: opts.sections.map(s => ({
              title: s.title,
              rows: s.rows.map(r => ({
                id: r.rowId,
                title: r.title,
                description: r.description ?? '',
              })),
            })),
          },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Meta API erro ${res.status}: ${body}`);
    }
    */

    // Fallback textual até WABA ser aprovado
    const texto = [
      `*${opts.title}*`,
      opts.description,
      '',
      ...opts.sections.flatMap(s => [
        `_${s.title}_`,
        ...s.rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`),
      ]),
      opts.footer ? `\n_${opts.footer}_` : '',
    ].join('\n').trim();

    await this.sendText(phoneNumberId, to, texto);
  }

  // ── downloadMedia ───────────────────────────────────────────────────────────

  async downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string }> {
    // TODO: stub — na Meta, mídia não vem inline no webhook (ao contrário da Evolution).
    //   Precisa de 2 chamadas:
    //   1. GET /{media-id} → retorna { url, mime_type }
    //   2. GET {url} com Authorization header → retorna o binário
    /*
    // Passo 1: obter URL de download
    const metaRes = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    if (!metaRes.ok) throw new Error(`Meta media lookup erro ${metaRes.status}`);
    const { url, mime_type } = await metaRes.json() as { url: string; mime_type: string };

    // Passo 2: baixar binário (URL é temporária ~5 min)
    const fileRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    if (!fileRes.ok) throw new Error(`Meta media download erro ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: mime_type };
    */
    console.log(`[meta:downloadMedia] TODO mediaId=${mediaId}`);
    throw new Error('downloadMedia não implementado — complete o stub em providers/meta.ts');
  }

  // ── verifyWebhook ───────────────────────────────────────────────────────────

  verifyWebhook(params: Record<string, string>): string | null {
    const mode      = params['hub.mode'];
    const token     = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }

  // ── parseInbound ────────────────────────────────────────────────────────────

  parseInbound(body: unknown): InboundMessage[] {
    const payload = body as MetaWebhookPayload;

    if (payload?.object !== 'whatsapp_business_account') return [];

    const result: InboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;

        const phoneNumberId = value.metadata?.phone_number_id ?? '';

        for (const msg of value.messages) {
          const base: Omit<InboundMessage, 'type'> = {
            from:          msg.from,
            phoneNumberId,
            messageId:     msg.id,
            pushName:      msg.profile?.name ?? null,
          };

          if (msg.type === 'text' && 'text' in msg) {
            result.push({ ...base, type: 'text', text: (msg as MetaTextMessage).text.body });
            continue;
          }

          if (msg.type === 'image' && 'image' in msg) {
            const m = msg as MetaImageMessage;
            result.push({ ...base, type: 'image', mediaId: m.image.id, mediaMimeType: m.image.mime_type });
            continue;
          }

          if (msg.type === 'document' && 'document' in msg) {
            const m = msg as MetaDocumentMessage;
            result.push({ ...base, type: 'document', mediaId: m.document.id, mediaMimeType: m.document.mime_type });
            continue;
          }

          if (msg.type === 'interactive' && 'interactive' in msg) {
            const m = msg as MetaInteractiveMessage;
            const rowId =
              m.interactive.list_reply?.id ??
              m.interactive.button_reply?.id ??
              '';
            result.push({ ...base, type: 'interactive_reply', selectedRowId: rowId });
            continue;
          }

          result.push({ ...base, type: 'unknown' });
        }
      }
    }

    return result;
  }

  // ── validateSignature (segurança) ──────────────────────────────────────────

  /**
   * Valida a assinatura HMAC-SHA256 do header X-Hub-Signature-256.
   * Deve ser chamada no webhook POST antes de processar qualquer payload.
   */
  validateSignature(rawBody: string, signature: string): boolean {
    // Fail-closed: sem a secret não há como validar → rejeita (segurança > conveniência).
    if (!process.env.WHATSAPP_APP_SECRET) {
      console.warn('[meta] WHATSAPP_APP_SECRET não definida — rejeitando payload (fail-closed)');
      return false;
    }

    const expected = 'sha256=' + createHmac('sha256', this.appSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // Comparação timing-safe (mesmo padrão do webhook AbacatePay).
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  }
}
