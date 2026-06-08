import { sendText, sendButtons } from '../client';
import { createServiceClient } from '@/lib/supabase/service';
import type { DadosColeta, WabaIncomingMessage } from '../types';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendamentoContext {
  conversa: { id: string; paciente_id: string | null; dentista_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  dadosColeta: DadosColeta;
  supabase: ReturnType<typeof createServiceClient>;
  config: unknown;
}

export async function handleAgendamentoFlow(c: AgendamentoContext) {
  const { conversa, ctx, clinicaId, accessToken, dadosColeta, supabase } = c;
  const texto = (ctx.message.text?.body ?? ctx.message.button?.text ?? '').trim().toLowerCase();

  if (!conversa.paciente_id || !conversa.dentista_id) {
    await sendText(ctx.from, 'Não encontrei seus dados. Digite *oi* para recomeçar.', ctx.phoneNumberId, accessToken);
    return;
  }

  if (!dadosColeta.etapa_agendamento) {
    if (!['sim', 's', 'yes'].includes(texto)) {
      await sendText(ctx.from, 'Tudo certo! Se precisar de algo, é só chamar.', ctx.phoneNumberId, accessToken);
      await supabase.from('conversas_bot').update({ estado: 'encerrado' }).eq('id', conversa.id);
      return;
    }
    const dias = getProximasDatas(5);
    await sendButtons(
      ctx.from,
      'Escolha uma data para sua consulta:',
      dias.map((d) => ({ id: `data_${d.iso}`, title: d.label })),
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({ dados_coleta: { ...dadosColeta, etapa_agendamento: 'data' } }).eq('id', conversa.id);
    return;
  }

  if (dadosColeta.etapa_agendamento === 'data') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (!payload.startsWith('data_')) {
      await sendText(ctx.from, 'Por favor, escolha uma das opções acima.', ctx.phoneNumberId, accessToken);
      return;
    }
    const dataISO = payload.replace('data_', '');
    const horarios = await getHorariosDisponiveis(supabase, clinicaId, conversa.dentista_id, dataISO);
    if (horarios.length === 0) {
      await sendText(ctx.from, 'Não há horários disponíveis nessa data. Escolha outro dia digitando *agenda*.', ctx.phoneNumberId, accessToken);
      return;
    }
    await sendButtons(
      ctx.from,
      `Horários disponíveis em ${formatDateBR(dataISO)}:`,
      horarios.slice(0, 3).map((h) => ({ id: `hora_${dataISO}_${h}`, title: h })),
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({
      dados_coleta: { ...dadosColeta, data_agendamento: dataISO, etapa_agendamento: 'hora' },
    }).eq('id', conversa.id);
    return;
  }

  if (dadosColeta.etapa_agendamento === 'hora') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (!payload.startsWith('hora_')) {
      await sendText(ctx.from, 'Por favor, escolha um horário acima.', ctx.phoneNumberId, accessToken);
      return;
    }
    const parts = payload.replace('hora_', '').split('_');
    const dataISO = parts[0];
    const hora    = parts[1];

    const dataHora = `${dataISO}T${hora}:00-03:00`;
    await supabase.from('agendamentos').insert({
      clinica_id:      clinicaId,
      paciente_id:     conversa.paciente_id,
      dentista_id:     conversa.dentista_id,
      data_hora:       dataHora,
      duracao_minutos: 30,
      status:          'scheduled',
      origem:          'whatsapp',
    });

    await sendText(
      ctx.from,
      `✅ Consulta agendada!\n📅 ${formatDateBR(dataISO)} às ${hora}\n\nEnviaremos um lembrete antes. Até lá! 😊`,
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({ estado: 'encerrado', dados_coleta: {} }).eq('id', conversa.id);
  }
}

function getProximasDatas(n: number): { iso: string; label: string }[] {
  const result: { iso: string; label: string }[] = [];
  let d = new Date();
  while (result.length < n) {
    d = addDays(d, 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      result.push({
        iso:   format(d, 'yyyy-MM-dd'),
        label: format(d, "EEE dd/MM", { locale: ptBR }),
      });
    }
  }
  return result;
}

async function getHorariosDisponiveis(
  supabase: ReturnType<typeof createServiceClient>,
  clinicaId: string,
  dentistaId: string,
  dataISO: string,
): Promise<string[]> {
  const diaSemana = new Date(dataISO + 'T12:00:00').getDay();
  const { data: horarios } = await supabase
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim')
    .eq('clinica_id', clinicaId)
    .eq('dentista_id', dentistaId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true)
    .order('hora_inicio');

  if (!horarios || horarios.length === 0) return [];

  const slots: string[] = [];
  for (const h of horarios as { hora_inicio: string; hora_fim: string }[]) {
    const [startH, startM] = h.hora_inicio.split(':').map(Number);
    const [endH, endM]     = h.hora_fim.split(':').map(Number);
    let cur = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (cur + 30 <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0');
      const mm = String(cur % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
      cur += 30;
    }
  }
  return slots;
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
