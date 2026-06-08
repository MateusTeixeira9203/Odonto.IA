import type { OutboundMessage, OutboundInteractiveMessage, InteractiveButton } from './types';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: OutboundMessage,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: `WhatsApp API error ${res.status}: ${JSON.stringify(body)}` };
    }
    return {};
  } catch (err) {
    return { error: String(err) };
  }
}

export async function sendText(
  to: string,
  body: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<{ error?: string }> {
  return sendWhatsAppMessage(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

export async function sendButtons(
  to: string,
  text: string,
  buttons: { id: string; title: string }[],
  phoneNumberId: string,
  accessToken: string,
): Promise<{ error?: string }> {
  const payload: OutboundInteractiveMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map<InteractiveButton>((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };
  return sendWhatsAppMessage(phoneNumberId, accessToken, payload);
}

export async function downloadMediaUrl(
  mediaId: string,
  accessToken: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { error: `Media lookup error ${res.status}` };
    const data = await res.json() as { url?: string };
    return { url: data.url };
  } catch (err) {
    return { error: String(err) };
  }
}
