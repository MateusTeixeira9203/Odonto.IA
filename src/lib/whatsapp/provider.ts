/**
 * Abstração do provider WhatsApp.
 *
 * Todos os consumidores (reminders, dex-handler, message-handler, send-pdf, etc.)
 * importam daqui — nunca do adaptador diretamente.
 *
 * Para trocar de provedor: altere getProvider() abaixo.
 * Para plugar as credenciais Meta: preencha as vars de ambiente e remova os TODO.
 */

import { MetaProvider } from './providers/meta';

// ─── Tipos de saída ────────────────────────────────────────────────────────────

export interface ListRow {
  rowId: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface InteractiveListOptions {
  title: string;
  description: string;
  buttonText: string;
  sections: ListSection[];
  footer?: string;
}

// ─── Tipos de entrada (mensagens recebidas) ────────────────────────────────────

export type InboundMessageType = 'text' | 'image' | 'document' | 'interactive_reply' | 'unknown';

export interface InboundMessage {
  /** Número do remetente (sem @s.whatsapp.net, sem prefixo) */
  from: string;
  /** phone_number_id do destinatário (identifica a clínica no multi-tenant) */
  phoneNumberId: string;
  /** ID único da mensagem no provider */
  messageId: string;
  type: InboundMessageType;
  /** Texto digitado (type=text) */
  text?: string;
  /** ID da opção selecionada numa lista interativa (type=interactive_reply) */
  selectedRowId?: string;
  /** Media ID para download posterior (type=image|document) */
  mediaId?: string;
  /** MIME type da mídia */
  mediaMimeType?: string;
  /** Nome do contato (pode ser null) */
  pushName?: string | null;
}

// ─── Interface do provider ─────────────────────────────────────────────────────

export interface WhatsAppProvider {
  /**
   * Envia mensagem de texto simples.
   * @param phoneNumberId  Identifica qual número da clínica está enviando
   * @param to             Número do destinatário (sem prefixo)
   * @param text           Conteúdo da mensagem
   */
  sendText(phoneNumberId: string, to: string, text: string): Promise<void>;

  /**
   * Envia arquivo (PDF de orçamento, etc.) codificado em base64.
   * @param mimeType  ex: 'application/pdf'
   */
  sendFile(
    phoneNumberId: string,
    to: string,
    base64: string,
    filename: string,
    caption?: string,
    mimeType?: string,
  ): Promise<void>;

  /**
   * Envia lista interativa com opções clicáveis.
   * Requer aprovação WABA na Meta — no stub, cai como texto formatado.
   */
  sendInteractiveList(
    phoneNumberId: string,
    to: string,
    opts: InteractiveListOptions,
  ): Promise<void>;

  /**
   * Baixa mídia a partir de um media ID (retorna base64).
   * Necessário porque a Meta não envia mídia inline no webhook.
   */
  downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string }>;

  /**
   * Valida o webhook GET de verificação da Meta.
   * @returns O `hub.challenge` se válido, null se inválido
   */
  verifyWebhook(params: Record<string, string>): string | null;

  /**
   * Parseia o payload POST do webhook da Meta em mensagens normalizadas.
   * Ignora status updates, delivery receipts, etc.
   */
  parseInbound(body: unknown): InboundMessage[];
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

let _provider: WhatsAppProvider | null = null;

export function getProvider(): WhatsAppProvider {
  if (!_provider) _provider = new MetaProvider();
  return _provider;
}

// ─── Atalhos convenientes ──────────────────────────────────────────────────────

export function sendText(phoneNumberId: string, to: string, text: string): Promise<void> {
  return getProvider().sendText(phoneNumberId, to, text);
}

export function sendFile(
  phoneNumberId: string,
  to: string,
  base64: string,
  filename: string,
  caption?: string,
  mimeType?: string,
): Promise<void> {
  return getProvider().sendFile(phoneNumberId, to, base64, filename, caption, mimeType);
}

export function sendInteractiveList(
  phoneNumberId: string,
  to: string,
  opts: InteractiveListOptions,
): Promise<void> {
  return getProvider().sendInteractiveList(phoneNumberId, to, opts);
}

export function downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  return getProvider().downloadMedia(mediaId);
}
