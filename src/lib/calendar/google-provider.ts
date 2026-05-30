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
    '\nGerado pelo Odonto.IA',
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

/**
 * Retorna um mapa de dentistaId → conectado para uma lista de dentistas.
 * Usado pela secretária para saber quais dentistas têm GCal conectado.
 */
export async function getCalendarConnectedMap(
  dentistaIds: string[],
): Promise<Record<string, boolean>> {
  if (!dentistaIds.length) return {};
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('google_tokens')
    .select('dentista_id')
    .in('dentista_id', dentistaIds);

  const connected = new Set((data ?? []).map((r) => r.dentista_id as string));
  return Object.fromEntries(dentistaIds.map((id) => [id, connected.has(id)]));
}

export interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   string[];
}

/**
 * Importa eventos do Google Calendar primário do dentista para a tabela
 * `agendamentos`. Usa `ical_uid` do Google como chave de deduplicação.
 *
 * Estratégia de matching de paciente:
 *   1. Tenta extrair o nome do padrão "Consulta — Nome"
 *   2. Busca paciente por nome (case-insensitive) na clínica
 *   3. Se não encontrar, cria novo paciente com esse nome
 *
 * @param dentistaId  ID do dentista cujo GCal será lido
 * @param clinicaId   ID da clínica onde os agendamentos serão criados
 * @param janelaDias  Quantos dias a partir de hoje buscar (default: 90)
 */
export async function importGoogleCalendarEvents(
  dentistaId: string,
  clinicaId:  string,
  janelaDias  = 90,
): Promise<ImportResult> {
  const auth = await getAuthenticatedClient(dentistaId);
  if (!auth) throw new Error('Google Calendar não conectado para este dentista');

  const calendar = google.calendar({ version: 'v3', auth });
  const supabase = createServiceClient();

  const now = new Date();
  const fim = new Date(now.getTime() + janelaDias * 86_400_000);

  const { data: gcData } = await calendar.events.list({
    calendarId:   'primary',
    timeMin:      now.toISOString(),
    timeMax:      fim.toISOString(),
    singleEvents: true,
    orderBy:      'startTime',
    maxResults:   500,
  });

  const events = gcData.items ?? [];
  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const event of events) {
    // Ignorar eventos de dia inteiro (sem horário)
    if (!event.start?.dateTime || !event.end?.dateTime) {
      skipped++;
      continue;
    }

    const gcEventId = event.id;
    const iCalUID   = event.iCalUID ?? gcEventId;
    if (!gcEventId || !iCalUID) { skipped++; continue; }

    // Deduplicação — pular se ical_uid já importado
    const { data: existente } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('ical_uid', iCalUID)
      .maybeSingle();

    if (existente) { skipped++; continue; }

    // Também pular se google_event_id já existe (eventos criados pelo Odonto.IA)
    const { data: existenteGE } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('google_event_id', gcEventId)
      .maybeSingle();

    if (existenteGE) { skipped++; continue; }

    // Extrair nome do paciente do título do evento
    let pacienteNome = (event.summary ?? '').trim() || 'Paciente Importado';
    const consultaMatch = pacienteNome.match(/^Consulta\s*[—\-]\s*(.+)$/i);
    if (consultaMatch?.[1]) pacienteNome = consultaMatch[1].trim();

    // Encontrar ou criar paciente
    let pacienteId: string;
    try {
      const { data: pacienteExistente } = await supabase
        .from('pacientes')
        .select('id')
        .eq('clinica_id', clinicaId)
        .ilike('nome', pacienteNome)
        .limit(1)
        .maybeSingle();

      if (pacienteExistente) {
        pacienteId = pacienteExistente.id as string;
      } else {
        const { data: novoPaciente, error: errP } = await supabase
          .from('pacientes')
          .insert({ clinica_id: clinicaId, nome: pacienteNome })
          .select('id')
          .single();
        if (errP || !novoPaciente) throw new Error(errP?.message ?? 'Erro ao criar paciente');
        pacienteId = (novoPaciente as { id: string }).id;
      }
    } catch (err) {
      errors.push(`"${pacienteNome}": ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Calcular duração em minutos
    const dtStart = new Date(event.start.dateTime);
    const dtEnd   = new Date(event.end.dateTime);
    const duracaoMinutos = Math.max(15, Math.round((dtEnd.getTime() - dtStart.getTime()) / 60_000));

    // Criar agendamento
    const { error: errA } = await supabase
      .from('agendamentos')
      .insert({
        clinica_id:      clinicaId,
        dentista_id:     dentistaId,
        paciente_id:     pacienteId,
        data_hora:       event.start.dateTime,
        duracao_minutos: duracaoMinutos,
        status:          'scheduled',
        origem:          'app',
        observacoes:     event.description?.substring(0, 500) ?? null,
        google_event_id: gcEventId,
        ical_uid:        iCalUID,
      });

    if (errA) {
      errors.push(`Agendamento "${pacienteNome}": ${errA.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped, errors };
}
