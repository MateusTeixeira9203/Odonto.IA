/**
 * Lembretes automáticos de consulta via WhatsApp.
 *
 * Fluxo:
 *  1. Carrega todas as clínicas com reminder_enabled = true em bot_config
 *  2. Para cada clínica, busca agendamentos dentro do intervalo configurado (reminder_hours)
 *     com whatsapp_reminder_sent = false
 *  3. Formata a mensagem usando o template da clínica (substitui {data} e {hora})
 *  4. Envia via WhatsApp e marca whatsapp_reminder_sent = true
 */

import { createServiceClient } from '@/lib/supabase/service';
import { sendText } from './provider';

const BRT_OFFSET_H = 3;

const DEFAULT_REMINDER_MESSAGE =
  '🔔 Lembrete: Sua consulta está agendada para {data} às {hora}. Confirme sua presença respondendo CONFIRMO.';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BotConfigRow {
  clinica_id:       string;
  reminder_hours:   number;
  reminder_message: string;
}

interface AgendamentoComRelacoes {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  paciente: {
    nome: string;
    whatsapp: string | null;
    telefone: string | null;
  } | null;
  dentista: { nome: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extrairDataHoraBRT(iso: string): { data: string; hora: string } {
  const d    = new Date(new Date(iso).getTime() - BRT_OFFSET_H * 3_600_000);
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { data, hora };
}

function montarMensagem(template: string, ag: AgendamentoComRelacoes): string {
  const { data, hora } = extrairDataHoraBRT(ag.data_hora);
  return template.replace(/\{data\}/g, data).replace(/\{hora\}/g, hora);
}

/** Retorna o phone_number_id configurado para a clínica (multi-tenant futuro). */
async function resolverPhoneNumberId(clinicaId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from('clinicas')
    .select('whatsapp_phone_number_id')
    .eq('id', clinicaId)
    .maybeSingle();

  return (data?.whatsapp_phone_number_id as string | null)
    ?? process.env.WHATSAPP_PHONE_NUMBER_ID
    ?? null;
}

// ─── Resultado ────────────────────────────────────────────────────────────────

export interface ReminderResult {
  total:    number;
  enviados: number;
  erros:    number;
  detalhes: Array<{ agendamento_id: string; status: 'enviado' | 'sem_numero' | 'erro'; motivo?: string }>;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function sendReminders(): Promise<ReminderResult> {
  const db  = createServiceClient();
  const now = new Date();

  const { data: configs, error: configError } = await db
    .from('bot_config')
    .select('clinica_id, reminder_hours, reminder_message')
    .eq('reminder_enabled', true);

  if (configError) throw new Error(`Erro ao carregar bot_config: ${configError.message}`);

  const resultado: ReminderResult = { total: 0, enviados: 0, erros: 0, detalhes: [] };
  if (!configs || configs.length === 0) return resultado;

  for (const config of configs as BotConfigRow[]) {
    const hours    = config.reminder_hours ?? 24;
    const template = config.reminder_message ?? DEFAULT_REMINDER_MESSAGE;
    const em       = new Date(now.getTime() + hours * 3_600_000);

    const phoneNumberId = await resolverPhoneNumberId(config.clinica_id);
    if (!phoneNumberId) {
      console.warn(`[reminders] phone_number_id não configurado para clínica ${config.clinica_id}`);
      continue;
    }

    const { data: agendamentos, error } = await db
      .from('agendamentos')
      .select(`
        id, data_hora, duracao_minutos,
        paciente:pacientes (nome, whatsapp, telefone),
        dentista:dentistas (nome)
      `)
      .eq('clinica_id', config.clinica_id)
      .gte('data_hora', now.toISOString())
      .lte('data_hora', em.toISOString())
      .eq('whatsapp_reminder_sent', false)
      .neq('status', 'cancelled');

    if (error) {
      console.error(`[reminders] Erro ao buscar agendamentos da clínica ${config.clinica_id}:`, error.message);
      continue;
    }

    const lista = (agendamentos ?? []) as unknown as AgendamentoComRelacoes[];
    resultado.total += lista.length;

    for (const ag of lista) {
      const numero = ag.paciente?.whatsapp ?? ag.paciente?.telefone ?? null;

      if (!numero) {
        resultado.erros++;
        resultado.detalhes.push({ agendamento_id: ag.id, status: 'sem_numero' });
        continue;
      }

      try {
        const mensagem = montarMensagem(template, ag);
        await sendText(phoneNumberId, numero, mensagem);

        await db
          .from('agendamentos')
          .update({ whatsapp_reminder_sent: true })
          .eq('id', ag.id);

        resultado.enviados++;
        resultado.detalhes.push({ agendamento_id: ag.id, status: 'enviado' });
      } catch (err) {
        const motivo = err instanceof Error ? err.message : String(err);
        console.error(`[reminders] Erro ao enviar lembrete para agendamento ${ag.id}:`, motivo);
        resultado.erros++;
        resultado.detalhes.push({ agendamento_id: ag.id, status: 'erro', motivo });
      }
    }
  }

  console.info(
    `[reminders] Concluído: ${resultado.enviados}/${resultado.total} enviados, ${resultado.erros} erros`,
  );

  return resultado;
}
