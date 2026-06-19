/**
 * Camada de negócio WhatsApp — uso exclusivo server-side.
 * Toda lógica de negócio (listas interativas, agendamento, etc.) passa por aqui.
 * O envio usa o provider abstrato — nunca importar evolution.ts diretamente.
 */

import { sendText, sendInteractiveList, type ListSection } from '@/lib/whatsapp/provider';
import { getBotMensagens, parseTemplate, type TemplateVars } from '@/lib/whatsapp/template';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WhatsAppStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WhatsAppInstanceInfo {
  phoneNumberId: string;
  status: WhatsAppStatus;
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

export interface HoraListResult {
  slots: SlotInfo[];
  duracaoMinutos: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const ROW_HUMANO = '__humano__';

const BRT_OFFSET_H = 3;

// ─── Funções de instância (compatibilidade multi-tenant) ──────────────────────

/**
 * Busca o phone_number_id configurado para a clínica.
 * Usado pelo dashboard de configurações para exibir status.
 */
export async function getInstanceForClinica(
  clinicaId: string,
): Promise<WhatsAppInstanceInfo | null> {
  const db = createServiceClient();
  const { data } = await db
    .from('clinicas')
    .select('whatsapp_phone_number_id')
    .eq('id', clinicaId)
    .maybeSingle();

  const phoneNumberId =
    (data?.whatsapp_phone_number_id as string | null) ??
    process.env.WHATSAPP_PHONE_NUMBER_ID ??
    null;

  if (!phoneNumberId) return null;

  // TODO: chamar Graph API para verificar status real da conexão quando credenciais estiverem prontas
  return { phoneNumberId, status: 'disconnected' };
}

// ─── Funções de envio ─────────────────────────────────────────────────────────

export async function sendMessage(
  phoneNumberId: string,
  to: string,
  text: string,
): Promise<void> {
  await sendText(phoneNumberId, to, text);
}

// ─── Funções de List Messages ─────────────────────────────────────────────────

export async function sendDentistList(
  phoneNumberId: string,
  to: string,
  clinicaId: string,
  pacienteNome: string,
  isNovoPaciente = false,
): Promise<DentistListItem[]> {
  const db = createServiceClient();

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
    await sendText(
      phoneNumberId,
      to,
      'No momento não há dentistas disponíveis para agendamento.\n' +
      'Por favor, entre em contato diretamente conosco.',
    );
    return [];
  }

  const vars: TemplateVars = { nome: primeiroNome, clinica: clinicaNome };

  const titulo    = parseTemplate(mensagens.titulo_menu_principal, vars);
  const descricao = parseTemplate(
    isNovoPaciente ? mensagens.msg_novo_paciente : mensagens.msg_paciente_antigo,
    vars,
  );

  const sections: ListSection[] = [
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
  ];

  await sendInteractiveList(phoneNumberId, to, {
    title:       `Olá, ${primeiroNome}! 👋`,
    description: descricao,
    buttonText:  titulo,
    sections,
    footer:      'Odonto.IA — Assistente Virtual',
  });

  return dentistas;
}

export async function sendDateList(
  phoneNumberId: string,
  to: string,
  clinicaId: string,
  dentistaId: string,
  dentistaNome: string,
): Promise<string[]> {
  const db = createServiceClient();

  const { data: grade } = await db
    .from('horarios_disponiveis')
    .select('dia_semana')
    .eq('dentista_id', dentistaId)
    .eq('clinica_id', clinicaId)
    .eq('ativo', true);

  const diasAtivos = new Set((grade ?? []).map(g => g.dia_semana as number));

  if (!diasAtivos.size) {
    await sendText(
      phoneNumberId,
      to,
      `${dentistaNome} não tem horários cadastrados no momento.\n` +
      'Por favor, entre em contato diretamente com nossa equipe.',
    );
    return [];
  }

  const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hoje    = utcToBRT(new Date());
  const amanha  = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);

  const datas: { iso: string; label: string }[] = [];
  const cursor = new Date(amanha);

  for (let i = 0; i < 30 && datas.length < 5; i++) {
    const diaSemana = cursor.getDay();
    if (diasAtivos.has(diaSemana)) {
      const d = String(cursor.getDate()).padStart(2, '0');
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const y = cursor.getFullYear();
      datas.push({ iso: `${y}-${m}-${d}`, label: `${DIAS_PT[diaSemana]}, ${d}/${m}` });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!datas.length) {
    await sendText(
      phoneNumberId,
      to,
      `Não encontrei datas disponíveis para ${dentistaNome} nos próximos 30 dias.\n` +
      'Por favor, entre em contato com nossa equipe.',
    );
    return [];
  }

  await sendInteractiveList(phoneNumberId, to, {
    title:       '📅 Escolha uma Data',
    description: `Quais datas estão disponíveis para consultar com ${dentistaNome}?`,
    buttonText:  'Ver Datas',
    sections: [{
      title: 'Próximas Datas Disponíveis',
      rows:  datas.map(d => ({ rowId: d.iso, title: d.label })),
    }],
    footer: 'Odonto.IA — Assistente Virtual',
  });

  return datas.map(d => d.iso);
}

export async function sendHoraList(
  phoneNumberId: string,
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
    await sendText(phoneNumberId, to, 'Não encontrei horários para essa data. Por favor, escolha outra data.');
    return { slots: [], duracaoMinutos: 30 };
  }

  const duracaoMinutos = (grade[0].intervalo_minutos as number | null) ?? 30;

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
    await sendText(phoneNumberId, to, 'Não há horários disponíveis para essa data. Por favor, escolha outra data.');
    return { slots: [], duracaoMinutos };
  }

  const DIAS_PT  = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dLabel   = String(day).padStart(2, '0');
  const mLabel   = String(month).padStart(2, '0');
  const diaLabel = DIAS_PT[diaSemana];

  await sendInteractiveList(phoneNumberId, to, {
    title:       `⏰ Horários — ${diaLabel}, ${dLabel}/${mLabel}`,
    description: 'Qual horário você prefere?',
    buttonText:  'Ver Horários',
    sections: [{
      title: 'Horários Disponíveis',
      rows:  slots.map(s => ({ rowId: s.iso, title: s.label })),
    }],
    footer: 'Odonto.IA — Assistente Virtual',
  });

  return { slots, duracaoMinutos };
}

// ─── Helper interno ───────────────────────────────────────────────────────────

function utcToBRT(d: Date): Date {
  return new Date(d.getTime() - BRT_OFFSET_H * 3_600_000);
}
