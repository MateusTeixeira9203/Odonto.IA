/**
 * Camada de abstração para a Evolution API — uso exclusivo server-side.
 * Toda lógica de chamada HTTP para a Evolution API passa por aqui.
 * Nunca importar evolution.ts / evolution-admin.ts diretamente nas páginas.
 */

import {
  sendWhatsAppText,
  sendWhatsAppFile,
  sendWhatsAppList,
} from '@/lib/whatsapp/evolution';
import {
  getInstanceStatus,
  getQRCode as fetchQRCode,
  mapEvolutionStatus,
} from '@/lib/whatsapp/evolution-admin';
import { getBotMensagens, parseTemplate, type TemplateVars } from '@/lib/whatsapp/template';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WhatsAppStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WhatsAppInstanceInfo {
  instanceName: string;
  status: WhatsAppStatus;
  qrcode: string | null;
}

export interface DentistListItem {
  id: string;
  nome: string;
  especialidade: string | null;
}

export interface SlotInfo {
  /** ISO UTC datetime string */
  iso: string;
  /** Formatted label "14:00" */
  label: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Row ID especial para opção "Falar com atendente" nas listas */
export const ROW_HUMANO = '__humano__';

const BRT_OFFSET_H = 3;

// ─── Funções de instância ─────────────────────────────────────────────────────

/**
 * Busca a instância de uma clínica no banco (sem chamar a Evolution API).
 */
export async function getInstanceForClinica(
  clinicaId: string,
): Promise<WhatsAppInstanceInfo | null> {
  const db = createServiceClient();
  const { data } = await db
    .from('instancias_whatsapp')
    .select('instance_name, status, qrcode')
    .eq('clinica_id', clinicaId)
    .maybeSingle();

  if (!data) return null;

  return {
    instanceName: data.instance_name as string,
    status:       normalizeStatus(data.status as string),
    qrcode:       (data.qrcode as string | null) ?? null,
  };
}

/**
 * Consulta o status ao vivo na Evolution API e atualiza o banco.
 */
export async function getLiveStatus(
  clinicaId: string,
): Promise<WhatsAppInstanceInfo | null> {
  const db = createServiceClient();

  const { data: instancia } = await db
    .from('instancias_whatsapp')
    .select('id, instance_name, qrcode')
    .eq('clinica_id', clinicaId)
    .maybeSingle();

  if (!instancia) return null;

  const instanceName = instancia.instance_name as string;
  const rawState     = await getInstanceStatus(instanceName);
  const novoStatus   = mapEvolutionStatus(rawState);

  let qrcode = instancia.qrcode as string | null;
  if (novoStatus === 'connecting') {
    const novoQr = await fetchQRCode(instanceName);
    if (novoQr) qrcode = novoQr;
  } else if (novoStatus === 'connected') {
    qrcode = null;
  }

  await db
    .from('instancias_whatsapp')
    .update({ status: novoStatus, qrcode, updated_at: new Date().toISOString() })
    .eq('id', instancia.id as string);

  return {
    instanceName,
    status: normalizeStatus(novoStatus),
    qrcode,
  };
}

// ─── Funções de envio ─────────────────────────────────────────────────────────

/**
 * Envia uma mensagem de texto para um número WhatsApp.
 */
export async function sendMessage(
  instanceName: string,
  to: string,
  text: string,
): Promise<void> {
  await sendWhatsAppText(instanceName, to, text);
}

/**
 * Envia um arquivo (PDF) para um número WhatsApp via base64.
 */
export async function sendFile(
  instanceName: string,
  to: string,
  base64: string,
  filename: string,
  caption?: string,
): Promise<void> {
  await sendWhatsAppFile(instanceName, to, base64, filename, caption);
}

// ─── Funções de List Messages ─────────────────────────────────────────────────

/**
 * Envia a lista interativa de dentistas para o paciente escolher.
 * Usa as mensagens personalizadas da clínica (ou defaults) como título e descrição.
 * Inclui uma opção "Falar com atendente" (rowId = ROW_HUMANO).
 * Retorna os dentistas enviados, para persistir no contexto da conversa.
 *
 * @param isNovoPaciente  true = primeiro contato; usa msg_novo_paciente
 *                        false = paciente já cadastrado; usa msg_paciente_antigo
 */
export async function sendDentistList(
  instanceName: string,
  to: string,
  clinicaId: string,
  pacienteNome: string,
  isNovoPaciente: boolean = false,
): Promise<DentistListItem[]> {
  const db = createServiceClient();

  // Busca dentistas, nome da clínica e mensagens configuradas em paralelo
  const [{ data: dentistasRaw }, { data: clinicaRaw }, mensagens] = await Promise.all([
    db.from('dentistas')
      .select('id, nome, especialidade')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .in('role', ['admin', 'dentista'])
      .order('nome'),
    db.from('clinicas').select('nome').eq('id', clinicaId).maybeSingle(),
    getBotMensagens(clinicaId),
  ]);

  const dentistas   = (dentistasRaw ?? []) as DentistListItem[];
  const clinicaNome = (clinicaRaw?.nome as string | null) ?? 'Clínica';
  const primeiroNome = pacienteNome.split(' ')[0];

  if (!dentistas.length) {
    await sendWhatsAppText(
      instanceName,
      to,
      'No momento não há dentistas disponíveis para agendamento.\n' +
      'Por favor, entre em contato diretamente conosco.',
    );
    return [];
  }

  const vars: TemplateVars = { nome: primeiroNome, clinica: clinicaNome };

  const titulo   = parseTemplate(mensagens.titulo_menu_principal, vars);
  const descricao = parseTemplate(
    isNovoPaciente ? mensagens.msg_novo_paciente : mensagens.msg_paciente_antigo,
    vars,
  );

  await sendWhatsAppList(
    instanceName,
    to,
    `Olá, ${primeiroNome}! 👋`,
    descricao,
    titulo,
    [
      {
        title: 'Dentistas Disponíveis',
        rows: dentistas.map(d => ({
          rowId:       d.id,
          title:       d.nome,
          description: d.especialidade ?? 'Clínico Geral',
        })),
      },
      {
        title: 'Outras Opções',
        rows: [{
          rowId:       ROW_HUMANO,
          title:       'Falar com Atendente',
          description: 'Transferir para um humano',
        }],
      },
    ],
    'Odonto.IA — Assistente Virtual',
  );

  return dentistas;
}

/**
 * Envia a lista interativa com os próximos dias úteis disponíveis para o dentista.
 * Retorna as datas enviadas como strings "YYYY-MM-DD".
 */
export async function sendDateList(
  instanceName: string,
  to: string,
  clinicaId: string,
  dentistaId: string,
  dentistaNome: string,
): Promise<string[]> {
  const db = createServiceClient();

  // Dias da semana em que o dentista atende
  const { data: grade } = await db
    .from('horarios_disponiveis')
    .select('dia_semana')
    .eq('dentista_id', dentistaId)
    .eq('clinica_id', clinicaId)
    .eq('ativo', true);

  const diasAtivos = new Set((grade ?? []).map(g => g.dia_semana as number));

  if (!diasAtivos.size) {
    await sendWhatsAppText(
      instanceName,
      to,
      `${dentistaNome} não tem horários cadastrados no momento.\n` +
      'Por favor, entre em contato diretamente com nossa equipe.',
    );
    return [];
  }

  const DIAS_PT  = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hoje     = utcToBRT(new Date());
  const amanha   = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);

  const datas: { iso: string; label: string }[] = [];
  const cursor = new Date(amanha);

  // Máximo 30 iterações para evitar loop infinito se dentista não tiver dias cadastrados
  for (let i = 0; i < 30 && datas.length < 5; i++) {
    const diaSemana = cursor.getDay();
    if (diasAtivos.has(diaSemana)) {
      const d = String(cursor.getDate()).padStart(2, '0');
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const y = cursor.getFullYear();
      datas.push({
        iso:   `${y}-${m}-${d}`,
        label: `${DIAS_PT[diaSemana]}, ${d}/${m}`,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!datas.length) {
    await sendWhatsAppText(
      instanceName,
      to,
      `Não encontrei datas disponíveis para ${dentistaNome} nos próximos 30 dias.\n` +
      'Por favor, entre em contato com nossa equipe.',
    );
    return [];
  }

  await sendWhatsAppList(
    instanceName,
    to,
    '📅 Escolha uma Data',
    `Quais datas estão disponíveis para consultar com ${dentistaNome}?`,
    'Ver Datas',
    [{
      title: 'Próximas Datas Disponíveis',
      rows:  datas.map(d => ({ rowId: d.iso, title: d.label })),
    }],
    'Odonto.IA — Assistente Virtual',
  );

  return datas.map(d => d.iso);
}

export interface HoraListResult {
  slots: SlotInfo[];
  /** Duração real de cada consulta em minutos, lida do horario_disponivel do dentista. */
  duracaoMinutos: number;
}

/**
 * Envia a lista interativa com os horários disponíveis para a data selecionada.
 * Retorna os slots enviados e a duração real da consulta, para persistir no contexto.
 */
export async function sendHoraList(
  instanceName: string,
  to: string,
  clinicaId: string,
  dentistaId: string,
  dateISO: string,
): Promise<HoraListResult> {
  const db = createServiceClient();

  const [year, month, day] = dateISO.split('-').map(Number);
  const diaSemana = new Date(year, month - 1, day).getDay();

  const { data: grade } = await db
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim, intervalo_minutos')
    .eq('dentista_id', dentistaId)
    .eq('clinica_id', clinicaId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true);

  if (!grade?.length) {
    await sendWhatsAppText(
      instanceName,
      to,
      'Não encontrei horários para essa data. Por favor, escolha outra data.',
    );
    return { slots: [], duracaoMinutos: 30 };
  }

  const duracaoMinutos = (grade[0].intervalo_minutos as number | null) ?? 30;

  // Janela UTC do dia selecionado em horário de Brasília
  const diaStartUTC = new Date(Date.UTC(year, month - 1, day, BRT_OFFSET_H, 0));
  const diaEndUTC   = new Date(Date.UTC(year, month - 1, day + 1, BRT_OFFSET_H, 0));

  const { data: agendados } = await db
    .from('agendamentos')
    .select('data_hora')
    .eq('dentista_id', dentistaId)
    .neq('status', 'cancelled')
    .gte('data_hora', diaStartUTC.toISOString())
    .lt('data_hora', diaEndUTC.toISOString());

  const ocupados = new Set(
    (agendados ?? []).map(a => new Date(a.data_hora as string).toISOString()),
  );

  const agora  = new Date();
  const slots: SlotInfo[] = [];

  for (const regra of grade as Array<{ hora_inicio: string; hora_fim: string; intervalo_minutos: number }>) {
    const [hiH, hiM] = regra.hora_inicio.split(':').map(Number);
    const [hfH, hfM] = regra.hora_fim.split(':').map(Number);
    let slotMin = hiH * 60 + hiM;
    const fimMin = hfH * 60 + hfM;

    while (slotMin < fimMin && slots.length < 10) {
      const hh = Math.floor(slotMin / 60);
      const mm = slotMin % 60;
      const slotUTC = new Date(Date.UTC(year, month - 1, day, hh + BRT_OFFSET_H, mm));

      if (slotUTC > agora && !ocupados.has(slotUTC.toISOString())) {
        slots.push({
          iso:   slotUTC.toISOString(),
          label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        });
      }
      slotMin += regra.intervalo_minutos;
    }
  }

  if (!slots.length) {
    await sendWhatsAppText(
      instanceName,
      to,
      'Não há horários disponíveis para essa data. Por favor, escolha outra data.',
    );
    return { slots: [], duracaoMinutos };
  }

  const DIAS_PT   = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dLabel    = String(day).padStart(2, '0');
  const mLabel    = String(month).padStart(2, '0');
  const diaLabel  = DIAS_PT[diaSemana];

  await sendWhatsAppList(
    instanceName,
    to,
    `⏰ Horários — ${diaLabel}, ${dLabel}/${mLabel}`,
    'Qual horário você prefere?',
    'Ver Horários',
    [{
      title: 'Horários Disponíveis',
      rows:  slots.map(s => ({ rowId: s.iso, title: s.label })),
    }],
    'Odonto.IA — Assistente Virtual',
  );

  return { slots, duracaoMinutos };
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function normalizeStatus(raw: string): WhatsAppStatus {
  if (raw === 'connected' || raw === 'open')                              return 'connected';
  if (raw === 'connecting')                                                return 'connecting';
  if (raw === 'inactive' || raw === 'close' || raw === 'disconnected')   return 'disconnected';
  return 'error';
}

function utcToBRT(d: Date): Date {
  return new Date(d.getTime() - BRT_OFFSET_H * 3_600_000);
}
