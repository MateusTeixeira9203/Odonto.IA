/**
 * Funções administrativas para a Evolution API.
 * Usadas apenas em Route Handlers server-side (nunca no cliente).
 */

const BRT_OFFSET_H = 3;

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error('EVOLUTION_API_URL não definida');
  return url.replace(/\/$/, '');
}

function adminHeaders(): HeadersInit {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error('EVOLUTION_API_KEY não definida');
  return { 'Content-Type': 'application/json', apikey: key };
}

export interface InstanceCreateResult {
  instanceName: string;
  qrcode: string | null;
}

/**
 * Cria uma nova instância na Evolution API e configura o webhook.
 */
export async function createInstance(instanceName: string): Promise<InstanceCreateResult> {
  const webhookUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') +
    '/api/whatsapp/webhook';

  const res = await fetch(`${baseUrl()}/instance/create`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      number: null,
      webhook: webhookUrl,
      webhook_by_events: true,
      events: ['messages'],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // A Evolution API pode retornar o qrcode em diferentes caminhos
  const qrcode =
    (data.qrcode as string | null) ??
    ((data.hash as Record<string, unknown> | undefined)?.qrcode as string | null) ??
    null;

  return { instanceName, qrcode };
}

/**
 * Obtém o QR Code atual para escanear.
 * Retorna string (base64 ou data-URL) ou null se não disponível.
 */
export async function getQRCode(instanceName: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl()}/instance/qrcode/${instanceName}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return null;

    const data = await res.json() as Record<string, unknown>;
    return (
      (data.base64 as string | null) ??
      ((data.qrcode as Record<string, unknown> | undefined)?.base64 as string | null) ??
      (data.qrcode as string | null) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Retorna o estado da conexão.
 * Valores possíveis (Evolution API): 'open', 'close', 'connecting'
 */
export async function getInstanceStatus(instanceName: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl()}/instance/connectionState/${instanceName}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return 'error';

    const data = await res.json() as Record<string, unknown>;
    const state =
      (data.state as string | undefined) ??
      ((data.instance as Record<string, unknown> | undefined)?.state as string | undefined) ??
      'unknown';

    return state;
  } catch {
    return 'error';
  }
}

/**
 * Deleta (desconecta e remove) uma instância.
 */
export async function deleteInstance(instanceName: string): Promise<void> {
  // Tenta logout primeiro, depois delete
  try {
    await fetch(`${baseUrl()}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    });
  } catch { /* ignora */ }

  const res = await fetch(`${baseUrl()}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}

/** Mapeia estado Evolution API → status interno */
export function mapEvolutionStatus(state: string): 'connecting' | 'connected' | 'error' | 'inactive' {
  if (state === 'open') return 'connected';
  if (state === 'connecting') return 'connecting';
  if (state === 'close') return 'inactive';
  return 'error';
}

export { BRT_OFFSET_H };
