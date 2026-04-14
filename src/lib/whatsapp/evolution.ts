/**
 * Cliente para a Evolution API — envio de mensagens WhatsApp.
 * Todas as chamadas são server-side apenas.
 */

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;

function headers(): HeadersInit {
  if (!API_KEY) throw new Error('EVOLUTION_API_KEY não definida');
  return { 'Content-Type': 'application/json', apikey: API_KEY };
}

function baseUrl(): string {
  if (!BASE_URL) throw new Error('EVOLUTION_API_URL não definida');
  return BASE_URL.replace(/\/$/, '');
}

/** Envia mensagem de texto simples */
export async function sendWhatsAppText(
  instance: string,
  number: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/message/sendText/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}

export interface WhatsAppButton {
  label: string;
  value: string;
}

/**
 * Envia um arquivo (documento, imagem) via Evolution API usando base64.
 * Usado para enviar PDFs de orçamento ao paciente.
 */
export async function sendWhatsAppFile(
  instance: string,
  number: string,
  base64: string,
  filename: string,
  caption?: string,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/message/sendMedia/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number,
      mediatype: 'document',
      mimetype:  'application/pdf',
      media:     base64,
      fileName:  filename,
      caption:   caption ?? '',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}

// ─── List Messages ────────────────────────────────────────────────────────────

export interface ListRow {
  rowId: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

/**
 * Envia uma List Message interativa (balão com opções clicáveis).
 * Disponível para todos os números no WhatsApp (personal e Business).
 */
export async function sendWhatsAppList(
  instance: string,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  sections: ListSection[],
  footer?: string,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/message/sendList/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number,
      title,
      description,
      buttonText,
      footerText: footer ?? '',
      sections,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}

/**
 * Envia mensagem com botões de resposta rápida.
 * Nota: botões requerem número com canal Business na Evolution API.
 */
export async function sendWhatsAppButtons(
  instance: string,
  number: string,
  text: string,
  buttons: WhatsAppButton[],
): Promise<void> {
  const res = await fetch(`${baseUrl()}/message/sendButtons/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number,
      options: {
        title: text,
        buttons: buttons.map(b => ({ label: b.label, value: b.value })),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}
