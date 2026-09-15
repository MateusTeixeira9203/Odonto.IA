export type TurnoClinico = {
  dentistaId: string;
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  almocoInicio: string | null;
  almocoFim: string | null;
};

type Intervalo = { inicio: number; fim: number };

export function mesValido(mesISO: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mesISO);
}

export function janelaDoMes(mesISO: string): { inicio: string; fim: string } {
  if (!mesValido(mesISO)) throw new Error('Mês inválido.');
  const [ano, mes] = mesISO.split('-').map(Number);
  const inicio = `${mesISO}-01`;
  const fim = `${ano + (mes === 12 ? 1 : 0)}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`;
  return { inicio, fim };
}

export function mesesAte(mesISO: string, quantidade: number): string[] {
  if (!mesValido(mesISO) || !Number.isInteger(quantidade) || quantidade < 1) return [];
  const [ano, mes] = mesISO.split('-').map(Number);
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(Date.UTC(ano, mes - quantidade + indice, 1));
    return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Datas e rótulos de negócio da clínica, sem depender do fuso do servidor. */
export function ultimosDiasBRT(quantidade: number, agora: Date = new Date()): { diaISO: string; dia: string }[] {
  if (!Number.isInteger(quantidade) || quantidade < 1) return [];
  const hoje = hojeBRT(agora);
  const [ano, mes, dia] = hoje.split('-').map(Number);
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(Date.UTC(ano, mes - 1, dia - quantidade + 1 + indice, 12));
    const diaISO = data.toISOString().slice(0, 10);
    return {
      diaISO,
      dia: diaISO === hoje ? 'Hoje' : DIAS_PT[data.getUTCDay()],
    };
  });
}

export function mesBRT(agora: Date = new Date()): string {
  return hojeBRT(agora).slice(0, 7);
}

function minutos(hora: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(hora);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function unificar(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos.filter((i) => i.fim > i.inicio).sort((a, b) => a.inicio - b.inicio);
  return ordenados.reduce<Intervalo[]>((resultado, atual) => {
    const anterior = resultado.at(-1);
    if (anterior && atual.inicio <= anterior.fim) anterior.fim = Math.max(anterior.fim, atual.fim);
    else resultado.push({ ...atual });
    return resultado;
  }, []);
}

function intersecao(a: Intervalo, b: Intervalo): Intervalo | null {
  const inicio = Math.max(a.inicio, b.inicio);
  const fim = Math.min(a.fim, b.fim);
  return fim > inicio ? { inicio, fim } : null;
}

export function horasLiquidasNoMes(mesISO: string, turnos: TurnoClinico[]): number {
  if (!mesValido(mesISO)) return 0;
  const porDentistaEDia = new Map<string, TurnoClinico[]>();
  for (const turno of turnos) {
    const chave = `${turno.dentistaId}:${turno.diaSemana}`;
    porDentistaEDia.set(chave, [...(porDentistaEDia.get(chave) ?? []), turno]);
  }
  const [ano, mes] = mesISO.split('-').map(Number);
  const ocorrencias = Array.from({ length: 7 }, () => 0);
  for (let dia = 1; dia <= new Date(ano, mes, 0).getDate(); dia += 1) {
    ocorrencias[new Date(ano, mes - 1, dia).getDay()] += 1;
  }
  let minutosNoMes = 0;
  for (const turnosDoDia of porDentistaEDia.values()) {
    const diaSemana = turnosDoDia[0]?.diaSemana;
    if (diaSemana === undefined || diaSemana < 0 || diaSemana > 6) continue;
    const jornadas = unificar(turnosDoDia.flatMap((turno) => {
      const inicio = minutos(turno.horaInicio);
      const fim = minutos(turno.horaFim);
      return inicio !== null && fim !== null ? [{ inicio, fim }] : [];
    }));
    const almocos = unificar(turnosDoDia.flatMap((turno) => {
      const inicio = turno.almocoInicio ? minutos(turno.almocoInicio) : null;
      const fim = turno.almocoFim ? minutos(turno.almocoFim) : null;
      return inicio !== null && fim !== null ? [{ inicio, fim }] : [];
    }));
    const minutosPorDia = jornadas.reduce((soma, jornada) => {
      const pausa = unificar(almocos.flatMap((almoco) => {
        const parte = intersecao(jornada, almoco);
        return parte ? [parte] : [];
      })).reduce((total, intervalo) => total + intervalo.fim - intervalo.inicio, 0);
      return soma + jornada.fim - jornada.inicio - pausa;
    }, 0);
    minutosNoMes += minutosPorDia * ocorrencias[diaSemana];
  }
  return minutosNoMes / 60;
}
import { hojeBRT } from '@/lib/hora-brt';
