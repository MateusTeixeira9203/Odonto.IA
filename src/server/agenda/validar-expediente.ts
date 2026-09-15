import type { ClinicContext } from '@/server/auth/clinic';
import {
  checarExpediente,
  type ForaDoExpediente,
  type GradeDoDia,
} from '@/lib/agenda/expediente';

const DIA_SEMANA_BRT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type HorarioDisponivelRow = {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  almoco_inicio: string | null;
  almoco_fim: string | null;
};

function partesBRT(dataHora: string): { diaSemana: number; inicioMin: number } | null {
  const data = new Date(dataHora);
  if (Number.isNaN(data.getTime())) return null;

  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';
  const diaSemana = DIA_SEMANA_BRT[valor('weekday')];

  if (diaSemana === undefined) return null;
  return { diaSemana, inicioMin: Number(valor('hour')) * 60 + Number(valor('minute')) };
}

/**
 * R-110 — consulta a grade pelo client autenticado da requisição. Secretária consulta a
 * agenda do dentista escolhido; dentista só recebe o aviso para a própria agenda.
 */
export async function validarExpediente(input: {
  supabase: ClinicContext['supabase'];
  clinicId: string;
  actorDentistaId: string | null;
  actorRole: ClinicContext['role'];
  dentistaId: string;
  dataHora: string;
  duracaoMinutos: number;
  /** Fluxos operacionais não podem agendar quando a grade não pôde ser consultada. */
  failClosed?: boolean;
}): Promise<ForaDoExpediente> {
  if (input.actorRole !== 'secretaria' && input.actorDentistaId !== input.dentistaId) {
    return { fora: false };
  }

  const partes = partesBRT(input.dataHora);
  if (!partes) return { fora: false };

  // A consulta inteira (em vez de só o dia) diferencia "sem grade nenhuma" de
  // "dentista trabalha, mas não neste domingo" sem escalar permissões.
  const { data, error } = await input.supabase
    .from('horarios_disponiveis')
    .select('dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim')
    .eq('clinica_id', input.clinicId)
    .eq('dentista_id', input.dentistaId)
    .eq('ativo', true);

  if (error) {
    console.error('[validarExpediente] horarios_disponiveis falhou:', error.message);
    if (input.failClosed) throw new Error('Não foi possível consultar o expediente do dentista.');
    return { fora: false };
  }

  const horarios = (data ?? []) as HorarioDisponivelRow[];
  if (horarios.length === 0) return { fora: false };

  const horarioDoDia = horarios.find((horario) => horario.dia_semana === partes.diaSemana);
  if (!horarioDoDia) return { fora: true, motivo: 'dia_sem_grade' };

  const grade: GradeDoDia = {
    horaInicio: horarioDoDia.hora_inicio,
    horaFim: horarioDoDia.hora_fim,
    almocoInicio: horarioDoDia.almoco_inicio,
    almocoFim: horarioDoDia.almoco_fim,
  };
  return checarExpediente(grade, partes.inicioMin, input.duracaoMinutos);
}
