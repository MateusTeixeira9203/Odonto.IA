/**
 * Máquina de estados do bot WhatsApp.
 *
 * Colunas reais de conversas_bot (migration 002):
 *   telefone, etapa, contexto, ultimo_contato, ativo (false = transferido para humano)
 */

import { createServiceClient } from '@/lib/supabase/service';
import { STATES, type BotState } from './states';
import { sendOrcamentoWhatsApp } from './send-pdf';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Linha real da tabela conversas_bot */
export interface ConversaBot {
  id: string;
  clinica_id: string;
  telefone: string;
  etapa: string;
  contexto: Record<string, unknown>;
  paciente_id: string | null;
  ativo: boolean;           // false = transferido para humano
  ultimo_contato: string;
  created_at: string;
}

export interface BotResponse {
  texto: string;
  novoEstado: BotState;
  novoContexto?: Record<string, unknown>;
}

interface DentistaOpcao {
  id: string;
  nome: string;
}

interface BotContexto {
  nome?: string;
  motivo?: string;
  dentista_id?: string;
  dentista_nome?: string;
  dentistas_opcoes?: DentistaOpcao[];
  horarios_slots?: string[];   // ISO UTC strings
  duracao_minutos?: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Fuso horário do Brasil (UTC-3) em horas */
const BRT_OFFSET_H = 3;
const MAX_SLOTS = 8;
const DIAS_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira',
  'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado',
];

// ─── Helpers de data/hora ─────────────────────────────────────────────────────

/** Converte Date UTC para "Date equivalente em BRT" */
function utcToBRT(d: Date): Date {
  return new Date(d.getTime() - BRT_OFFSET_H * 3_600_000);
}

/** Cria Date UTC a partir de data+hora em BRT */
function brtToUTC(year: number, month: number, day: number, hh: number, mm: number): Date {
  return new Date(Date.UTC(year, month, day, hh + BRT_OFFSET_H, mm));
}

function formatarSlot(utcDate: Date): string {
  const brt = utcToBRT(utcDate);
  const dia  = DIAS_SEMANA[brt.getDay()];
  const d    = String(brt.getDate()).padStart(2, '0');
  const m    = String(brt.getMonth() + 1).padStart(2, '0');
  const hh   = String(brt.getHours()).padStart(2, '0');
  const mm   = String(brt.getMinutes()).padStart(2, '0');
  return `${dia}, ${d}/${m} às ${hh}:${mm}`;
}

// ─── Banco de dados ───────────────────────────────────────────────────────────

/** Schema real de mensagens_bot: direcao='entrada'/'saida', conteudo, clinica_id */
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

async function buscarDentistas(clinicaId: string): Promise<DentistaOpcao[]> {
  const db = createServiceClient();
  const { data } = await db
    .from('dentistas')
    .select('id, nome')
    .eq('clinica_id', clinicaId)
    .eq('ativo', true)
    .in('role', ['admin', 'dentista'])
    .order('nome');
  return (data ?? []) as DentistaOpcao[];
}

/**
 * Gera slots disponíveis para um dentista nos próximos 7 dias.
 * Consulta horarios_disponiveis para montar a grade e agendamentos para
 * excluir horários já ocupados.
 */
async function buscarHorariosDisponiveis(
  dentistaId: string,
  clinicaId: string,
): Promise<{ slots: Date[]; duracaoMinutos: number }> {
  const db = createServiceClient();

  // Grade de horários cadastrada para o dentista
  const { data: grade } = await db
    .from('horarios_disponiveis')
    .select('dia_semana, hora_inicio, hora_fim, intervalo_minutos')
    .eq('dentista_id', dentistaId)
    .eq('clinica_id', clinicaId)
    .eq('ativo', true);

  if (!grade?.length) return { slots: [], duracaoMinutos: 30 };

  const duracaoMinutos = grade[0].intervalo_minutos as number ?? 30;

  // Janela: amanhã até daqui a 7 dias
  const agora = new Date();
  const agoraBRT = utcToBRT(agora);
  const inicio  = new Date(agoraBRT);
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);

  // Agendamentos já existentes nessa janela (exceto cancelados)
  const inicioUTC = brtToUTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0);
  const fimUTC    = brtToUTC(fim.getFullYear(), fim.getMonth(), fim.getDate(), 23, 59);

  const { data: agendados } = await db
    .from('agendamentos')
    .select('data_hora')
    .eq('dentista_id', dentistaId)
    .neq('status', 'cancelado')
    .gte('data_hora', inicioUTC.toISOString())
    .lte('data_hora', fimUTC.toISOString());

  const ocupados = new Set(
    (agendados ?? []).map(a => new Date(a.data_hora as string).toISOString()),
  );

  // Gera todos os slots candidatos
  const slots: Date[] = [];
  const cursor = new Date(inicio);

  while (cursor < fim && slots.length < MAX_SLOTS) {
    const diaSemana = cursor.getDay(); // 0=dom … 6=sáb (em BRT)

    const regras = (grade as Array<{
      dia_semana: number;
      hora_inicio: string;
      hora_fim: string;
      intervalo_minutos: number;
    }>).filter(r => r.dia_semana === diaSemana);

    for (const regra of regras) {
      const [hiH, hiM] = regra.hora_inicio.split(':').map(Number);
      const [hfH, hfM] = regra.hora_fim.split(':').map(Number);

      let slotMin = hiH * 60 + hiM;
      const fimMin = hfH * 60 + hfM;

      while (slotMin < fimMin && slots.length < MAX_SLOTS) {
        const slotUTC = brtToUTC(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          Math.floor(slotMin / 60),
          slotMin % 60,
        );

        if (slotUTC > agora && !ocupados.has(slotUTC.toISOString())) {
          slots.push(slotUTC);
        }
        slotMin += regra.intervalo_minutos;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return { slots, duracaoMinutos };
}

async function criarOuBuscarPaciente(
  clinicaId: string,
  nome: string,
  telefone: string,
): Promise<string> {
  const db = createServiceClient();

  // Tenta encontrar pelo número de WhatsApp
  const { data: existente } = await db
    .from('pacientes')
    .select('id')
    .eq('clinica_id', clinicaId)
    .eq('whatsapp', telefone)
    .maybeSingle();

  if (existente) return existente.id as string;

  // Cria novo paciente
  const { data: novo, error } = await db
    .from('pacientes')
    .insert({ clinica_id: clinicaId, nome, whatsapp: telefone })
    .select('id')
    .single();

  if (error || !novo) throw new Error(`Erro ao criar paciente: ${error?.message}`);
  return novo.id as string;
}

async function criarAgendamento(
  clinicaId: string,
  pacienteId: string,
  dentistaId: string,
  dataHora: Date,
  duracaoMinutos: number,
  motivo: string,
): Promise<string> {
  const db = createServiceClient();

  const { data, error } = await db
    .from('agendamentos')
    .insert({
      clinica_id:       clinicaId,
      paciente_id:      pacienteId,
      dentista_id:      dentistaId,
      data_hora:        dataHora.toISOString(),
      duracao_minutos:  duracaoMinutos,
      status:           'agendado',
      origem:           'bot',
      observacoes:      motivo,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Erro ao criar agendamento: ${error?.message}`);
  return data.id as string;
}

// ─── Helpers de mensagem ──────────────────────────────────────────────────────

function mensagemMenuPrincipal(): string {
  return (
    'Como posso ajudar?\n\n' +
    '1️⃣ Agendar consulta\n' +
    '3️⃣ Falar com atendente\n\n' +
    'Digite o número da opção. A qualquer momento, envie *cancelar* para recomeçar.'
  );
}

function mensagemHorariosNaoDisponiveis(dentistaNome: string): string {
  return (
    `Não encontrei horários disponíveis com *${dentistaNome}* nos próximos 7 dias.\n\n` +
    'Por favor, entre em contato diretamente com nossa equipe.\nEnvie *3* para falar com um atendente.'
  );
}

// ─── Estado: OFERECENDO_HORARIOS (helper compartilhado) ───────────────────────

async function resolverHorariosEResponder(
  conversa: ConversaBot,
  ctx: BotContexto,
): Promise<BotResponse> {
  const dentistaId   = ctx.dentista_id!;
  const dentistaNome = ctx.dentista_nome ?? 'o dentista';

  const { slots, duracaoMinutos } = await buscarHorariosDisponiveis(
    dentistaId,
    conversa.clinica_id,
  );

  if (!slots.length) {
    return {
      texto: mensagemHorariosNaoDisponiveis(dentistaNome),
      novoEstado: STATES.INICIO,
      novoContexto: {},
    };
  }

  const lista = slots
    .map((s, i) => `${i + 1}. ${formatarSlot(s)}`)
    .join('\n');

  const novoCtx: BotContexto = {
    ...ctx,
    horarios_slots: slots.map(s => s.toISOString()),
    duracao_minutos: duracaoMinutos,
  };

  return {
    texto:
      `Horários disponíveis com *${dentistaNome}*:\n\n${lista}\n\n` +
      'Digite o *número* do horário desejado:',
    novoEstado: STATES.AGUARDANDO_CONFIRMACAO,
    novoContexto: novoCtx as Record<string, unknown>,
  };
}

// ─── Processador principal ────────────────────────────────────────────────────

/**
 * Processa uma mensagem recebida do paciente e retorna a resposta do bot.
 * Persiste histórico e atualiza estado/contexto da conversa.
 */
export async function processMessage(
  conversa: ConversaBot,
  texto: string,
): Promise<BotResponse> {
  await salvarMensagem(conversa, 'entrada', texto);

  const input = texto.trim();
  const ctx   = (conversa.contexto ?? {}) as BotContexto;

  // Atalhos globais
  if (/^(cancelar|recomeçar|restart)$/i.test(input)) {
    const resposta: BotResponse = {
      texto:
        'Ok, voltamos ao início! 😊\n\n' +
        'Olá! Sou a assistente virtual da clínica.\n\n' +
        mensagemMenuPrincipal(),
      novoEstado: STATES.INICIO,
      novoContexto: {},
    };
    await salvarMensagem(conversa, 'saida', resposta.texto);
    await atualizarConversa(conversa.id, resposta.novoEstado, resposta.novoContexto ?? {});
    return resposta;
  }

  // Solicitação de orçamento — funciona em qualquer estado
  if (/or[cç]amento/i.test(input)) {
    const textoResposta = await sendOrcamentoWhatsApp(
      conversa.telefone,
      conversa.paciente_id,
      conversa.clinica_id,
    );
    const etapaAtual = conversa.etapa as BotState;
    await salvarMensagem(conversa, 'saida', textoResposta);
    // Não altera estado nem contexto — o paciente continua de onde estava
    await atualizarConversa(conversa.id, etapaAtual, ctx as Record<string, unknown>);
    return { texto: textoResposta, novoEstado: etapaAtual };
  }

  if (/^(humano|atendente|pessoa|ajuda)$/i.test(input)) {
    const resposta: BotResponse = {
      texto: 'Certo! Vou chamar nossa equipe. Um momento... 👩‍⚕️',
      novoEstado: STATES.HUMANO,
      novoContexto: ctx as Record<string, unknown>,
    };
    await salvarMensagem(conversa, 'saida', resposta.texto);
    await atualizarConversa(conversa.id, resposta.novoEstado, resposta.novoContexto ?? {});
    // Marca como transferido (ativo = false)
    const db = createServiceClient();
    await db.from('conversas_bot').update({ ativo: false }).eq('id', conversa.id);
    return resposta;
  }

  let resposta: BotResponse;

  switch (conversa.etapa as BotState) {

    // ── INICIO ──────────────────────────────────────────────────────────────
    case STATES.INICIO:
    default: {
      resposta = {
        texto:
          'Olá! 👋 Sou a assistente virtual da clínica.\n\n' +
          mensagemMenuPrincipal(),
        novoEstado: STATES.INICIO,
        novoContexto: {},
      };
      break;
    }

    // Menu embutido no INICIO — após primeira resposta o etapa ainda é INICIO
    // Detectamos a escolha aqui mesmo
    // (conversa.etapa === 'inicio' e já enviamos o menu antes)

    // ── COLETANDO_NOME ────────────────────────────────────────────────────
    case STATES.COLETANDO_NOME: {
      if (input.length < 2) {
        resposta = { texto: 'Por favor, informe seu nome completo.', novoEstado: STATES.COLETANDO_NOME };
        break;
      }
      const nome = input.replace(/\b\w/g, c => c.toUpperCase());
      resposta = {
        texto: `Olá, *${nome}*! 😊\n\nQual é o motivo da consulta? (Ex: dor de dente, limpeza, ortodontia...)`,
        novoEstado: STATES.COLETANDO_MOTIVO,
        novoContexto: { ...ctx, nome },
      };
      break;
    }

    // ── COLETANDO_MOTIVO ──────────────────────────────────────────────────
    case STATES.COLETANDO_MOTIVO: {
      if (input.length < 3) {
        resposta = { texto: 'Por favor, descreva brevemente o motivo da consulta.', novoEstado: STATES.COLETANDO_MOTIVO };
        break;
      }
      const ctxComMotivo: BotContexto = { ...ctx, motivo: input };
      const dentistas = await buscarDentistas(conversa.clinica_id);

      if (!dentistas.length) {
        resposta = {
          texto: 'Não consegui encontrar dentistas disponíveis no momento.\nEnvie *3* para falar com nossa equipe.',
          novoEstado: STATES.INICIO,
          novoContexto: {},
        };
        break;
      }

      if (dentistas.length === 1) {
        // Pula seleção e já oferece horários
        const ctxComDentista: BotContexto = {
          ...ctxComMotivo,
          dentista_id:   dentistas[0].id,
          dentista_nome: dentistas[0].nome,
        };
        resposta = await resolverHorariosEResponder(
          conversa,
          ctxComDentista,
        );
      } else {
        const lista = dentistas.map((d, i) => `${i + 1}. ${d.nome}`).join('\n');
        resposta = {
          texto: `Com qual dentista prefere consultar?\n\n${lista}\n\nDigite o número da opção:`,
          novoEstado: STATES.SELECIONANDO_DENTISTA,
          novoContexto: { ...ctxComMotivo, dentistas_opcoes: dentistas } as Record<string, unknown>,
        };
      }
      break;
    }

    // ── SELECIONANDO_DENTISTA ─────────────────────────────────────────────
    case STATES.SELECIONANDO_DENTISTA: {
      const opcoes = (ctx.dentistas_opcoes ?? []) as DentistaOpcao[];
      const idx    = parseInt(input) - 1;

      if (isNaN(idx) || idx < 0 || idx >= opcoes.length) {
        const lista = opcoes.map((d, i) => `${i + 1}. ${d.nome}`).join('\n');
        resposta = {
          texto: `Opção inválida. Por favor, escolha entre:\n\n${lista}`,
          novoEstado: STATES.SELECIONANDO_DENTISTA,
        };
        break;
      }

      const dentista = opcoes[idx];
      resposta = await resolverHorariosEResponder(conversa, {
        ...ctx,
        dentista_id:   dentista.id,
        dentista_nome: dentista.nome,
      });
      break;
    }

    // ── AGUARDANDO_CONFIRMACAO ────────────────────────────────────────────
    case STATES.AGUARDANDO_CONFIRMACAO: {
      const slots = (ctx.horarios_slots ?? []) as string[];
      const idx   = parseInt(input) - 1;

      if (isNaN(idx) || idx < 0 || idx >= slots.length) {
        const lista = slots.map((s, i) => `${i + 1}. ${formatarSlot(new Date(s))}`).join('\n');
        resposta = {
          texto: `Opção inválida. Escolha um número de 1 a ${slots.length}:\n\n${lista}`,
          novoEstado: STATES.AGUARDANDO_CONFIRMACAO,
        };
        break;
      }

      const dataHora      = new Date(slots[idx]);
      const dentistaId    = ctx.dentista_id!;
      const dentistaNome  = ctx.dentista_nome ?? 'o dentista';
      const duracaoMin    = (ctx.duracao_minutos as number | undefined) ?? 30;
      const nomePaciente  = (ctx.nome as string | undefined) ?? 'Paciente';
      const motivo        = (ctx.motivo as string | undefined) ?? '';

      try {
        // Cria ou recupera paciente
        const pacienteId = await criarOuBuscarPaciente(
          conversa.clinica_id,
          nomePaciente,
          conversa.telefone,
        );

        // Vincula paciente_id à conversa se ainda não vinculado
        if (!conversa.paciente_id) {
          const db = createServiceClient();
          await db
            .from('conversas_bot')
            .update({ paciente_id: pacienteId })
            .eq('id', conversa.id);
        }

        // Cria o agendamento
        await criarAgendamento(
          conversa.clinica_id,
          pacienteId,
          dentistaId,
          dataHora,
          duracaoMin,
          motivo,
        );

        const slotFormatado = formatarSlot(dataHora);
        resposta = {
          texto:
            `✅ Agendamento confirmado!\n\n` +
            `👤 Paciente: *${nomePaciente}*\n` +
            `🦷 Dentista: *${dentistaNome}*\n` +
            `📅 Data/hora: *${slotFormatado}*\n\n` +
            'Até lá! Se precisar de algo, é só chamar. 😊\n\n' +
            'Para agendar novamente, envie qualquer mensagem.',
          novoEstado: STATES.CONFIRMADO,
          novoContexto: {},
        };
      } catch (err) {
        console.error('[bot] Erro ao criar agendamento:', err);
        resposta = {
          texto:
            'Desculpe, ocorreu um erro ao confirmar seu agendamento. ' +
            'Por favor, tente novamente ou envie *3* para falar com nossa equipe.',
          novoEstado: STATES.AGUARDANDO_CONFIRMACAO,
        };
      }
      break;
    }

    // ── CONFIRMADO ────────────────────────────────────────────────────────
    case STATES.CONFIRMADO: {
      resposta = {
        texto:
          'Olá novamente! 😊\n\n' +
          mensagemMenuPrincipal(),
        novoEstado: STATES.INICIO,
        novoContexto: {},
      };
      break;
    }

    // ── HUMANO ────────────────────────────────────────────────────────────
    case STATES.HUMANO: {
      // Bot não responde — humano assumiu o atendimento
      return {
        texto: '',
        novoEstado: STATES.HUMANO,
        novoContexto: ctx as Record<string, unknown>,
      };
    }
  }

  // Lógica especial: INICIO com mensagem "1" entra no fluxo de agendamento
  if (conversa.etapa === STATES.INICIO && resposta.novoEstado === STATES.INICIO) {
    if (input === '1') {
      resposta = {
        texto: 'Ótimo! Para começar, qual é o seu *nome completo*?',
        novoEstado: STATES.COLETANDO_NOME,
        novoContexto: {},
      };
    } else if (input === '3') {
      resposta = {
        texto: 'Certo! Vou chamar nossa equipe. Um momento... 👩‍⚕️',
        novoEstado: STATES.HUMANO,
        novoContexto: {},
      };
      await salvarMensagem(conversa, 'saida', resposta.texto);
      await atualizarConversa(conversa.id, resposta.novoEstado, resposta.novoContexto ?? {});
      const db = createServiceClient();
      await db.from('conversas_bot').update({ ativo: false }).eq('id', conversa.id);
      return resposta;
    }
  }

  await salvarMensagem(conversa, 'saida', resposta.texto);
  await atualizarConversa(
    conversa.id,
    resposta.novoEstado,
    resposta.novoContexto ?? (ctx as Record<string, unknown>),
  );
  return resposta;
}
