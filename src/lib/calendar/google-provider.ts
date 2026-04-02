import { google } from 'googleapis';
import { createServiceClient } from '@/lib/supabase/service';

function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI devem estar configurados'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Gera a URL de autorização OAuth2 do Google. O dentistaId é passado via state. */
export function getGoogleAuthUrl(dentistaId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: dentistaId,
    prompt: 'consent', // garante refresh_token mesmo que já tenha autorizado antes
  });
}

/** Troca o código OAuth2 pelos tokens e salva na tabela google_tokens. */
export async function exchangeCodeForTokens(
  code: string,
  dentistaId: string
): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Google não retornou access_token');
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3_600_000).toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase.from('google_tokens').upsert(
    {
      dentista_id: dentistaId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dentista_id' }
  );

  if (error) throw new Error(`Erro ao salvar tokens: ${error.message}`);
}

/** Remove os tokens do Google Calendar de um dentista (desconectar). */
export async function revokeGoogleTokens(dentistaId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('google_tokens')
    .select('access_token')
    .eq('dentista_id', dentistaId)
    .maybeSingle();

  if (data?.access_token) {
    const oauth2Client = createOAuth2Client();
    try {
      await oauth2Client.revokeToken(data.access_token);
    } catch {
      // Ignorar erro de revogação — pode já ter expirado
    }
  }

  await supabase.from('google_tokens').delete().eq('dentista_id', dentistaId);
}

/** Retorna um OAuth2Client autenticado, renovando o token se expirado. */
async function getAuthenticatedClient(dentistaId: string) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('dentista_id', dentistaId)
    .maybeSingle<{ access_token: string; refresh_token: string | null; expires_at: string }>();

  if (!data) return null;

  const oauth2Client = createOAuth2Client();

  // Renovar se expirado ou a menos de 60s do vencimento
  const isExpiringSoon = new Date(data.expires_at).getTime() < Date.now() + 60_000;

  if (isExpiringSoon && data.refresh_token) {
    oauth2Client.setCredentials({ refresh_token: data.refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();

    const newExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3_600_000).toISOString();

    await supabase
      .from('google_tokens')
      .update({
        access_token: credentials.access_token!,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('dentista_id', dentistaId);

    oauth2Client.setCredentials(credentials);
  } else {
    oauth2Client.setCredentials({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? undefined,
    });
  }

  return oauth2Client;
}

export interface AppointmentData {
  pacienteNome: string;
  dentistaNome: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
}

function buildEventBody(data: AppointmentData) {
  const start = new Date(data.dataHora);
  const end = new Date(start.getTime() + data.duracaoMinutos * 60_000);

  const description = [
    `Dentista: ${data.dentistaNome}`,
    data.observacoes ? `Obs: ${data.observacoes}` : null,
    '\nGerado pelo Dent IA',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary: `Consulta — ${data.pacienteNome}`,
    description,
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
  };
}

/**
 * Cria um evento no Google Calendar do dentista.
 * Retorna o eventId do Google, ou null se o dentista não tiver tokens.
 */
export async function createGoogleCalendarEvent(
  dentistaId: string,
  data: AppointmentData
): Promise<string | null> {
  const auth = await getAuthenticatedClient(dentistaId);
  if (!auth) return null;

  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: buildEventBody(data),
  });

  return res.data.id ?? null;
}

/**
 * Atualiza um evento existente no Google Calendar.
 * Silencioso se o dentista não tiver tokens ou o evento não existir.
 */
export async function updateGoogleCalendarEvent(
  dentistaId: string,
  eventId: string,
  data: AppointmentData
): Promise<void> {
  const auth = await getAuthenticatedClient(dentistaId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: buildEventBody(data),
    });
  } catch (err: unknown) {
    // Evento pode ter sido deletado manualmente no Google — ignorar 404
    const status = (err as { code?: number }).code;
    if (status !== 404 && status !== 410) throw err;
  }
}

/**
 * Deleta um evento no Google Calendar.
 * Silencioso se o dentista não tiver tokens ou o evento não existir.
 */
export async function deleteGoogleCalendarEvent(
  dentistaId: string,
  eventId: string
): Promise<void> {
  const auth = await getAuthenticatedClient(dentistaId);
  if (!auth) return;

  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status !== 404 && status !== 410) throw err;
  }
}

/** Verifica se um dentista tem o Google Calendar conectado. */
export async function isGoogleCalendarConnected(dentistaId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('google_tokens')
    .select('id')
    .eq('dentista_id', dentistaId)
    .maybeSingle();
  return !!data;
}
