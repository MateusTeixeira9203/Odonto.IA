/**
 * Máquina de estados do bot WhatsApp — fluxo via List Messages (balões interativos).
 *
 * Fluxo principal:
 *   INICIO → [sendDentistList] → AGUARDANDO_DENTISTA
 *   AGUARDANDO_DENTISTA + rowId=dentistaId → [sendDateList] → AGUARDANDO_DATA
 *   AGUARDANDO_DATA + rowId="YYYY-MM-DD"  → [sendHoraList] → AGUARDANDO_HORA
 *   AGUARDANDO_HORA  + rowId=isoSlot      → [cria agendamento] → CONFIRMADO
 *
 * Estados legados (COLETANDO_NOME, etc.) redirecionam para INICIO para reiniciar
 * o fluxo de lista se uma conversa antiga ainda estiver em andamento.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { STATES, type BotState } from './states';
import { sendWhatsAppText } from './evolution';
import {
  sendDentistList,
  sendDateList,
  sendHoraList,
  ROW_HUMANO,
  type DentistListItem,
  type SlotInfo,
  type HoraListResult,
} from '@/services/whatsapp.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Linha real da tabela conversas_bot */
export interface ConversaBot {
  id: string;
  clinica_id: string;
  telefone: string;
  etapa: string;
  contexto: Record<string, unknown>;
  paciente_id: string | null;
  ativo: boolean;
  ultimo_contato: string;
  created_at: string;
}

export interface BotResponse {
  /** Texto vazio = bot já enviou a mensagem diretamente (list message ou silêncio). */
  texto: string;
  novoEstado: BotState;
  novoContexto?: Record<string, unknown>;
}

interface BotContexto {
  paciente_nome?: string;
  /** true = primeiro contato do paciente; usa msg_novo_paciente no template */
  is_novo_paciente?: boolean;
  dentista_id?: string;
  dentista_nome?: string;
  /** Datas disponíveis para o dentista selecionado — "YYYY-MM-DD" */
  datas_disponiveis?: string[];
  /** Data selecionada pelo paciente — "YYYY-MM-DD" */
  data_selecionada?: string;
  /** Slots disponíveis para a data selecionada — ISO UTC strings */
  horarios_slots?: string[];
  duracao_minutos?: number;
}

// ─── Fuso horário BRT ──────────────────────────────────────────────────────────

const BRT_OFFSET_H = 3;

function formatarSlotParaConfirmacao(iso: string): string {
  const d = new Date(new Date(iso).getTime() - BRT_OFFSET_H * 3_600_000);
  const dia = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}, ${dd}/${mm} às ${hh}:${min}`;
}

// ─── Persistência ─────────────────────────────────────────────────────────────

async function salvarMensagem(
  conversa: ConversaBot,
  direcao: 'entrada' | 'saida',
  conteudo: string,
): Promise<void> {
  const db = createServiceClient();
  await db.from('mensagens_bot').insert({
    conversa_id: conversa.id,
    clinica_id:  conversa.clinica_id,
    direcao,
    conteudo,
    tipo: 'texto',
  });
}

async function atualizarConversa(
  conversa_id: string,
  etapa: string,
  contexto: Record<string, unknown>,
): Promise<void> {
  const db = createServiceClient();
  await db
    .from('conversas_bot')
    .update({ etapa, contexto, ultimo_contato: new Date().toISOString() })
    .eq('id', conversa_id);
}

// ─── Helpers de negócio ───────────────────────────────────────────────────────

async function criarAgendamento(
  clinicaId: string,
  pacienteId: string,
  dentistaId: string,
  dataHora: Date,
  duracaoMinutos: number,
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from('agendamentos').insert({
    clinica_id:      clinicaId,
    paciente_id:     pacienteId,
    dentista_id:     dentistaId,
    data_hora:       dataHora.toISOString(),
    duracao_minutos: duracaoMinutos,
    status:          'agendado',
    origem:          'bot',
  });
  if (error) throw new Error(`Erro ao criar agendamento: ${error.message}`);
}

async function transferirParaHumano(conversaId: string): Promise<void> {
  const db = createServiceClient();
  await db.from('conversas_bot').update({ ativo: false }).eq('id', conversaId);
}

// ─── Processador principal ────────────────────────────────────────────────────

/**
 * Processa uma mensagem recebida e retorna a resposta do bot.
 * `texto` pode ser texto digitado OU o `selectedRowId` de uma list message.
 * `instancia` é necessário para enviar list messages diretamente.
 */
export async function processMessage(
  conversa: ConversaBot,
  texto: string,
  instancia: string,
): Promise<BotResponse> {
  await salvarMensagem(conversa, 'entrada', texto);

  const input = texto.trim();
  const ctx   = (conversa.contexto ?? {}) as BotContexto;

  // ── Atalho global: transferir para humano ────────────────────────────────────
  if (
    input === ROW_HUMANO ||
    /^(humano|atendente|pessoa|ajuda|falar com atendente)$/i.test(input)
  ) {
    await sendWhatsAppText(
      instancia,
      conversa.telefone,
      'Certo! Vou chamar nossa equipe. Um momento... 👩‍⚕️',
    );
    await salvarMensagem(conversa, 'saida', 'Certo! Vou chamar nossa equipe. Um momento... 👩‍⚕️');
    await transferirParaHumano(conversa.id);
    await atualizarConversa(conversa.id, STATES.HUMANO, {});
    return { texto: '', novoEstado: STATES.HUMANO };
  }

  // ── Atalho global: reiniciar ─────────────────────────────────────────────────
  if (/^(cancelar|recomeçar|restart|menu|inicio)$/i.test(input)) {
    return iniciarFluxo(conversa, ctx.paciente_nome ?? 'você', instancia);
  }

  // ── Estados do fluxo de lista ────────────────────────────────────────────────
  const etapa = conversa.etapa as BotState;

  switch (etapa) {

    // ── AGUARDANDO_DENTISTA ──────────────────────────────────────────────────
    case STATES.AGUARDANDO_DENTISTA: {
      // Valida se o rowId recebido é um dentista desta clínica
      const db = createServiceClient();
      const { data: dentista } = await db
        .from('dentistas')
        .select('id, nome')
        .eq('clinica_id', conversa.clinica_id)
        .eq('id', input)
        .eq('ativo', true)
        .maybeSingle();

      if (!dentista) {
        // Texto inválido ou rowId desconhecido → avisa e reenvia a lista de dentistas
        const nudge = 'Não entendi. 🤔 Por favor, use as opções da lista abaixo:';
        await sendWhatsAppText(instancia, conversa.telefone, nudge);
        await salvarMensagem(conversa, 'saida', nudge);
        await sendDentistList(
          instancia,
          conversa.telefone,
          conversa.clinica_id,
          ctx.paciente_nome ?? 'você',
          ctx.is_novo_paciente ?? false,
        );
        await salvarMensagem(conversa, 'saida', '[Lista de dentistas reenviada]');
        await atualizarConversa(conversa.id, etapa, ctx as Record<string, unknown>);
        return { texto: '', novoEstado: etapa };
      }

      const novoCtx: BotContexto = {
        ...ctx,
        dentista_id:   dentista.id as string,
        dentista_nome: dentista.nome as string,
      };

      const datas = await sendDateList(
        instancia,
        conversa.telefone,
        conversa.clinica_id,
        dentista.id as string,
        dentista.nome as string,
      );

      const label = `[Lista de datas enviada para ${dentista.nome as string}]`;
      await salvarMensagem(conversa, 'saida', label);

      if (!datas.length) {
        // Sem datas disponíveis — volta ao início
        await atualizarConversa(conversa.id, STATES.INICIO, {});
        return { texto: '', novoEstado: STATES.INICIO };
      }

      const ctx2: BotContexto = { ...novoCtx, datas_disponiveis: datas };
      await atualizarConversa(conversa.id, STATES.AGUARDANDO_DATA, ctx2 as Record<string, unknown>);
      return { texto: '', novoEstado: STATES.AGUARDANDO_DATA };
    }

    // ── AGUARDANDO_DATA ──────────────────────────────────────────────────────
    case STATES.AGUARDANDO_DATA: {
      const datas = (ctx.datas_disponiveis ?? []) as string[];

      if (!datas.includes(input)) {
        // Texto inválido → avisa e reenvia a lista de datas
        const nudge = 'Não entendi. 🤔 Por favor, use as opções da lista abaixo:';
        await sendWhatsAppText(instancia, conversa.telefone, nudge);
        await salvarMensagem(conversa, 'saida', nudge);
        await sendDateList(
          instancia,
          conversa.telefone,
          conversa.clinica_id,
          ctx.dentista_id!,
          ctx.dentista_nome ?? 'o dentista',
        );
        await salvarMensagem(conversa, 'saida', '[Lista de datas reenviada]');
        await atualizarConversa(conversa.id, etapa, ctx as Record<string, unknown>);
        return { texto: '', novoEstado: etapa };
      }

      const dentistaId   = ctx.dentista_id!;
      const dentistaNome = ctx.dentista_nome ?? 'o dentista';

      const { slots, duracaoMinutos }: HoraListResult = await sendHoraList(
        instancia,
        conversa.telefone,
        conversa.clinica_id,
        dentistaId,
        input,
      );

      const label = `[Lista de horários enviada — ${input} com ${dentistaNome}]`;
      await salvarMensagem(conversa, 'saida', label);

      if (!slots.length) {
        // Sem slots para essa data — volta para lista de datas
        await sendDateList(
          instancia,
          conversa.telefone,
          conversa.clinica_id,
          dentistaId,
          dentistaNome,
        );
        await atualizarConversa(
          conversa.id,
          STATES.AGUARDANDO_DATA,
          { ...ctx, data_selecionada: undefined } as Record<string, unknown>,
        );
        return { texto: '', novoEstado: STATES.AGUARDANDO_DATA };
      }

      const ctx2: BotContexto = {
        ...ctx,
        data_selecionada: input,
        horarios_slots:   slots.map(s => s.iso),
        duracao_minutos:  duracaoMinutos,
      };
      await atualizarConversa(conversa.id, STATES.AGUARDANDO_HORA, ctx2 as Record<string, unknown>);
      return { texto: '', novoEstado: STATES.AGUARDANDO_HORA };
    }

    // ── AGUARDANDO_HORA ──────────────────────────────────────────────────────
    case STATES.AGUARDANDO_HORA: {
      const slots        = (ctx.horarios_slots ?? []) as string[];
      const dentistaId   = ctx.dentista_id!;
      const dentistaNome = ctx.dentista_nome ?? 'o dentista';
      const duracaoMin   = (ctx.duracao_minutos as number | undefined) ?? 30;

      if (!slots.includes(input)) {
        // Texto inválido → avisa e reenvia a lista de horários
        const nudge = 'Não entendi. 🤔 Por favor, use as opções da lista abaixo:';
        await sendWhatsAppText(instancia, conversa.telefone, nudge);
        await salvarMensagem(conversa, 'saida', nudge);
        await sendHoraList(
          instancia,
          conversa.telefone,
          conversa.clinica_id,
          dentistaId,
          ctx.data_selecionada!,
        );
        await salvarMensagem(conversa, 'saida', '[Lista de horários reenviada]');
        await atualizarConversa(conversa.id, etapa, ctx as Record<string, unknown>);
        return { texto: '', novoEstado: etapa };
      }

      const dataHora = new Date(input);

      // Cria ou recupera o paciente
      const pacienteId = await garantirPaciente(
        conversa.clinica_id,
        conversa.telefone,
        ctx.paciente_nome ?? 'Paciente WhatsApp',
        conversa,
      );

      try {
        await criarAgendamento(
          conversa.clinica_id,
          pacienteId,
          dentistaId,
          dataHora,
          duracaoMin,
        );

        const slotFormatado = formatarSlotParaConfirmacao(input);
        const confirmacao =
          `✅ *Agendamento Confirmado!*\n\n` +
          `🦷 Dentista: *${dentistaNome}*\n` +
          `📅 Data/hora: *${slotFormatado}*\n\n` +
          'Até lá! Qualquer dúvida, é só chamar. 😊\n\n' +
          '_Para agendar novamente, envie qualquer mensagem._';

        await salvarMensagem(conversa, 'saida', confirmacao);
        await atualizarConversa(conversa.id, STATES.CONFIRMADO, {});
        return { texto: confirmacao, novoEstado: STATES.CONFIRMADO };
      } catch (err) {
        console.error('[message-handler] Erro ao criar agendamento:', err);
        const erro = 'Desculpe, ocorreu um erro ao confirmar o agendamento. Por favor, tente novamente.';
        await salvarMensagem(conversa, 'saida', erro);
        await atualizarConversa(conversa.id, etapa, ctx as Record<string, unknown>);
        return { texto: erro, novoEstado: etapa };
      }
    }

    // ── CONFIRMADO ────────────────────────────────────────────────────────────
    case STATES.CONFIRMADO: {
      // Paciente voltou a falar → reinicia fluxo
      return iniciarFluxo(conversa, ctx.paciente_nome ?? 'você', instancia);
    }

    // ── HUMANO ────────────────────────────────────────────────────────────────
    case STATES.HUMANO: {
      // Bot silencia enquanto humano está no controle
      return { texto: '', novoEstado: STATES.HUMANO };
    }

    // ── Estados legados / INICIO ──────────────────────────────────────────────
    case STATES.INICIO:
    default: {
      return iniciarFluxo(conversa, ctx.paciente_nome ?? 'você', instancia);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Dispara o sendDentistList e avança para AGUARDANDO_DENTISTA. */
async function iniciarFluxo(
  conversa: ConversaBot,
  pacienteNome: string,
  instancia: string,
): Promise<BotResponse> {
  const ctx = (conversa.contexto ?? {}) as BotContexto;
  const dentistas = await sendDentistList(
    instancia,
    conversa.telefone,
    conversa.clinica_id,
    pacienteNome,
    ctx.is_novo_paciente ?? false,
  );

  const label = '[Lista de dentistas enviada]';
  await salvarMensagem(conversa, 'saida', label);

  if (!dentistas.length) {
    await atualizarConversa(conversa.id, STATES.INICIO, {});
    return { texto: '', novoEstado: STATES.INICIO };
  }

  // Preserva is_novo_paciente para que re-nudges no estado AGUARDANDO_DENTISTA
  // continuem usando a mensagem correta (novo vs. antigo paciente).
  const novoCtx: BotContexto = {
    paciente_nome:    pacienteNome,
    is_novo_paciente: ctx.is_novo_paciente,
  };
  await atualizarConversa(
    conversa.id,
    STATES.AGUARDANDO_DENTISTA,
    novoCtx as Record<string, unknown>,
  );
  return { texto: '', novoEstado: STATES.AGUARDANDO_DENTISTA };
}

/**
 * Garante que o paciente existe em `pacientes`.
 * Cria se não existir e vincula ao `paciente_id` da conversa.
 */
async function garantirPaciente(
  clinicaId: string,
  telefone: string,
  nome: string,
  conversa: ConversaBot,
): Promise<string> {
  if (conversa.paciente_id) return conversa.paciente_id;

  const db = createServiceClient();

  const { data: existente } = await db
    .from('pacientes')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('whatsapp', telefone)
    .maybeSingle();

  if (existente) {
    await db.from('conversas_bot').update({ paciente_id: existente.id }).eq('id', conversa.id);
    return existente.id as string;
  }

  const { data: novo, error } = await db
    .from('pacientes')
    .insert({ clinica_id: clinicaId, nome, whatsapp: telefone })
    .select('id')
    .single();

  if (error || !novo) throw new Error(`Erro ao criar paciente: ${error?.message}`);

  await db.from('conversas_bot').update({ paciente_id: novo.id }).eq('id', conversa.id);
  return novo.id as string;
}
