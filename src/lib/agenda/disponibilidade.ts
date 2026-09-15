/**
 * R-64 — disponibilidade compartilhada. Extrai e generaliza a lógica que antes só existia
 * dentro de `whatsapp.service.ts:sendHoraList` (1 dia) para 1 semana inteira — é o que a
 * grade do "Marcar retorno" precisa de uma vez. Único lugar que lê `horarios_disponiveis`
 * pra decidir "livre"; `sendHoraList` (F4) e `RetornoSemanaGrid` (F2) consomem daqui.
 *
 * Minutos são sempre no fuso da clínica (BRT/`America/Sao_Paulo`, via `Intl` — nunca offset
 * fixo, mesmo motivo do `hora-brt.ts`: sobrevive a uma eventual mudança de DST sozinho).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { janelaDaVisao } from '@/app/dashboard/agendamentos/_components/date-helpers';

const TZ = 'America/Sao_Paulo';

export interface BlocoHorario {
  inicioMin: number;
  fimMin: number;
}

export interface OcupadoDia {
  id: string;
  inicioMin: number;
  duracaoMin: number;
  pacienteNome: string | null;
  /** R-102 — true quando este intervalo é um compromisso pessoal, não uma consulta. */
  bloqueio?: boolean;
}

export interface DisponibilidadeDia {
  data: string;
  diaSemana: number;
  /** Há uma grade de expediente ativa para este dia da semana. Sem ela, o retorno
   *  trata o dia como agenda livre e deixa o profissional escolher a hora. */
  temGrade: boolean;
  livres: BlocoHorario[];
  ocupados: OcupadoDia[];
  /** Passo entre horários (`horarios_disponiveis.intervalo_minutos`) — não previsto na
   *  1ª versão deste tipo (a grade do modal não precisa, aceita qualquer clique de 15min),
   *  mas o `sendHoraList` do WhatsApp (F4) precisa pra enumerar a lista de opções. 30 quando
   *  não há grade cadastrada pro dia (mesmo fallback de antes; `livres` vazio já barra tudo). */
  intervaloMinutos: number;
}

type GradeRow = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  almoco_inicio: string | null;
  almoco_fim: string | null;
  intervalo_minutos: number | null;
};

type AgendadoRow = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  paciente: { nome: string } | null;
};

type BloqueioRow = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
};

function horaParaMin(hhmmss: string): number {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
}

/** A grade de retorno sempre começa no domingo para conseguir indexar domingo–sábado, mas
 * a agenda operacional é segunda–sábado. `janelaDaVisao('semana')` interpreta um domingo
 * como encerramento da semana anterior; por isso a consulta precisa usar a segunda seguinte
 * como âncora, enquanto o array de dias continua começando no domingo. */
export function janelaDaSemanaDisponibilidade(semanaInicioISO: string): { de: string; ate: string } {
  const [ano, mes, dia] = semanaInicioISO.split('-').map(Number);
  const segunda = new Date(Date.UTC(ano, mes - 1, dia + 1, 12));
  const ancora = [
    segunda.getUTCFullYear(),
    String(segunda.getUTCMonth() + 1).padStart(2, '0'),
    String(segunda.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return janelaDaVisao('semana', ancora);
}

/** Minuto do dia → "HH:mm". Usado pelo `RetornoSemanaGrid` (resumo/render) e pelo
 *  `sendHoraList` (label + rowId da lista do WhatsApp) — mesma conta, um lugar só. */
export function formatHora(minutoDoDia: number): string {
  const h = Math.floor(minutoDoDia / 60);
  const m = minutoDoDia % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Expediente MENOS almoço. */
function livresDoDia(g: GradeRow): BlocoHorario[] {
  const inicio = horaParaMin(g.hora_inicio);
  const fim = horaParaMin(g.hora_fim);
  if (!g.almoco_inicio || !g.almoco_fim) return [{ inicioMin: inicio, fimMin: fim }];

  const almocoInicio = horaParaMin(g.almoco_inicio);
  const almocoFim = horaParaMin(g.almoco_fim);
  const blocos: BlocoHorario[] = [];
  if (almocoInicio > inicio) blocos.push({ inicioMin: inicio, fimMin: Math.min(almocoInicio, fim) });
  if (almocoFim < fim) blocos.push({ inicioMin: Math.max(almocoFim, inicio), fimMin: fim });
  return blocos;
}

/** Instante UTC → {dia da clínica, minuto do dia} na clínica, num `Intl` só. */
function partesBRT(d: Date): { data: string; minutoDoDia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)!.value;
  return {
    data: `${get('year')}-${get('month')}-${get('day')}`,
    minutoDoDia: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/**
 * 1 chamada, retorna os 7 dias (domingo a sábado). 2 queries (não 7):
 * `horarios_disponiveis` do dentista de uma vez + `agendamentos` na semana inteira —
 * mesmo padrão de "não pré-filtrar, buscar o intervalo inteiro" que a `WeekView` já usa.
 */
export async function getDisponibilidadeSemana(params: {
  dentistaId: string;
  clinicaId: string;
  semanaInicioISO: string;
}): Promise<DisponibilidadeDia[]> {
  const { dentistaId, clinicaId, semanaInicioISO } = params;
  const db = createServiceClient();
  const { de, ate } = janelaDaSemanaDisponibilidade(semanaInicioISO);

  const [
    { data: gradeRaw, error: gradeError },
    { data: agendadosRaw, error: agendadosError },
    { data: bloqueiosRaw, error: bloqueiosError },
  ] = await Promise.all([
      db.from('horarios_disponiveis')
        .select('dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim, intervalo_minutos')
        .eq('dentista_id', dentistaId)
        .eq('clinica_id', clinicaId)
        .eq('ativo', true),
      db.from('agendamentos')
        .select('id, data_hora, duracao_minutos, paciente:pacientes(nome)')
        .eq('dentista_id', dentistaId)
        .eq('clinica_id', clinicaId)
        .neq('status', 'cancelled')
        .gte('data_hora', de)
        .lt('data_hora', ate),
      // R-102 — compromisso pessoal ocupa a agenda igual consulta, sem paciente.
      db.from('agenda_bloqueios')
        .select('id, data_hora, duracao_minutos')
        .eq('dentista_id', dentistaId)
        .eq('clinica_id', clinicaId)
        .gte('data_hora', de)
        .lt('data_hora', ate),
    ]);

  if (gradeError) throw new Error(`[getDisponibilidadeSemana] horarios_disponiveis: ${gradeError.message}`);
  if (agendadosError) throw new Error(`[getDisponibilidadeSemana] agendamentos: ${agendadosError.message}`);
  if (bloqueiosError) throw new Error(`[getDisponibilidadeSemana] agenda_bloqueios: ${bloqueiosError.message}`);

  const gradePorDiaSemana = new Map<number, GradeRow>();
  for (const g of (gradeRaw ?? []) as GradeRow[]) gradePorDiaSemana.set(g.dia_semana, g);

  const [anoBase, mesBase, diaBase] = semanaInicioISO.split('-').map(Number);
  const dias: DisponibilidadeDia[] = Array.from({ length: 7 }, (_, diaSemana) => {
    // Meio-dia UTC como base (mesmo truque do date-helpers.ts) — nenhum fuso empurra a
    // data pro dia vizinho a partir do meio-dia.
    const cursor = new Date(Date.UTC(anoBase, mesBase - 1, diaBase + diaSemana, 12));
    const data = [
      cursor.getUTCFullYear(),
      String(cursor.getUTCMonth() + 1).padStart(2, '0'),
      String(cursor.getUTCDate()).padStart(2, '0'),
    ].join('-');
    const grade = gradePorDiaSemana.get(diaSemana);
    return {
      data,
      diaSemana,
      temGrade: grade !== undefined,
      livres: grade ? livresDoDia(grade) : [],
      ocupados: [],
      intervaloMinutos: grade?.intervalo_minutos ?? 30,
    };
  });

  const diaPorData = new Map(dias.map((d) => [d.data, d]));
  for (const a of (agendadosRaw ?? []) as unknown as AgendadoRow[]) {
    const { data, minutoDoDia } = partesBRT(new Date(a.data_hora));
    diaPorData.get(data)?.ocupados.push({
      id: a.id,
      inicioMin: minutoDoDia,
      duracaoMin: a.duracao_minutos,
      pacienteNome: a.paciente?.nome ?? null,
    });
  }
  for (const bl of (bloqueiosRaw ?? []) as BloqueioRow[]) {
    const { data, minutoDoDia } = partesBRT(new Date(bl.data_hora));
    diaPorData.get(data)?.ocupados.push({
      id: bl.id,
      inicioMin: minutoDoDia,
      duracaoMin: bl.duracao_minutos,
      pacienteNome: null,
      bloqueio: true,
    });
  }

  return dias;
}

/**
 * Função pura — mesma regra usada no clique da grade (I5 da spec R-64: nunca reimplementada
 * num 2º lugar). Só UX: quem decide de verdade é `criarAgendamento` (I4) — entre abrir o
 * modal e confirmar, outro agendamento pode ter ocupado o slot.
 */
export function slotEstaLivre(
  minutoDoDia: number,
  duracaoMin: number,
  dia: DisponibilidadeDia,
  agora: Date,
): boolean {
  const fimMin = minutoDoDia + duracaoMin;

  const dentroDeAlgumLivre = dia.livres.some((b) => minutoDoDia >= b.inicioMin && fimMin <= b.fimMin);
  if (!dentroDeAlgumLivre) return false;

  const semColisao = dia.ocupados.every(
    (o) => fimMin <= o.inicioMin || minutoDoDia >= o.inicioMin + o.duracaoMin,
  );
  if (!semColisao) return false;

  const { data: hoje, minutoDoDia: minutoAgora } = partesBRT(agora);
  if (dia.data < hoje) return false;
  if (dia.data === hoje && minutoDoDia <= minutoAgora) return false;

  return true;
}

/**
 * Regra de seleção do retorno: agenda ocupada e passado nunca são selecionáveis, mas expediente
 * configurado continua sendo aviso recuperável do servidor. Não é usada por WhatsApp nem Agenda.
 */
export function slotPodeSerSelecionadoParaRetorno(
  minutoDoDia: number,
  duracaoMin: number,
  dia: DisponibilidadeDia,
  agora: Date,
): boolean {
  const fimMin = minutoDoDia + duracaoMin;
  if (dia.ocupados.some((o) => fimMin > o.inicioMin && minutoDoDia < o.inicioMin + o.duracaoMin)) return false;

  const { data: hoje, minutoDoDia: minutoAgora } = partesBRT(agora);
  return dia.data > hoje || (dia.data === hoje && minutoDoDia > minutoAgora);
}
