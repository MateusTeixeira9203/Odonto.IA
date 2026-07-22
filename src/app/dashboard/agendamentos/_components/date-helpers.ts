/**
 * Timezone offset fixo para todas as clínicas da plataforma.
 *
 * Brasil usa BRT (Brasília Time = UTC-3) de forma permanente desde a
 * revogação do horário de verão pelo Decreto nº 9.772/2019. Não há DST.
 *
 * Usar esta constante elimina a dependência do timezone do browser ao
 * construir datetimes para persistência — o horário digitado pelo usuário
 * é sempre interpretado como BRT, independente de onde o browser esteja.
 *
 * Para evoluir para multi-timezone no futuro:
 *   1. Adicionar campo `timezone` (ex: "America/Sao_Paulo") à tabela `clinicas`.
 *   2. Substituir esta constante por uma leitura do contexto da clínica ativa.
 *   3. Calcular o offset IANA dinamicamente com `Intl.DateTimeFormat` ou `date-fns-tz`.
 */
export const CLINIC_TZ_OFFSET = '-03:00' as const;

/**
 * Constrói um datetime ISO 8601 com offset de timezone explícito (BRT).
 *
 * @param date - string no formato "yyyy-MM-dd" (valor de <input type="date">)
 * @param time - string no formato "HH:mm" (valor de <input type="time">)
 * @returns string ISO 8601 — ex: "2025-05-26T09:30:00.000-03:00"
 */
export function buildClinicDatetime(date: string, time: string): string {
  return `${date}T${time}:00.000${CLINIC_TZ_OFFSET}`;
}

/** As três visões da agenda. Vira o `?v=` da URL. */
export type VisaoAgenda = 'dia' | 'semana' | 'mes';

export const VISAO_PADRAO: VisaoAgenda = 'semana';

export function ehVisao(v: string | undefined): v is VisaoAgenda {
  return v === 'dia' || v === 'semana' || v === 'mes';
}

/** Aceita só 'yyyy-MM-dd' que existe de verdade — '2026-02-31' não passa. */
export function ehAncora(d: string | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, dia] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dia, 12));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === dia;
}

function somaDias(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Data UTC → meia-noite daquele dia **no fuso da clínica**, em ISO com offset explícito. */
function meiaNoiteNaClinica(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T00:00:00.000${CLINIC_TZ_OFFSET}`;
}

/**
 * Janela `[de, ate)` que a visão precisa, em ISO com offset BRT explícito.
 *
 * POR QUE NÃO USA date-fns AQUI: `startOfMonth(...).toISOString()` roda no fuso de **quem
 * executa**. Na Vercel isso é UTC, então as bordas do mês andavam 3h e a agenda perdia o
 * começo e o fim da janela. Toda a aritmética abaixo é `getUTC*`/`setUTC*` sobre uma base ao
 * meio-dia UTC — o resultado é o mesmo em qualquer servidor —, e o offset da clínica é
 * grudado só na hora de virar string.
 *
 * Meio-dia (e não meia-noite) como base: nenhum deslocamento de fuso consegue empurrar a data
 * pro dia vizinho a partir do meio-dia.
 */
export function janelaDaVisao(
  visao: VisaoAgenda,
  ancora: string,
): { de: string; ate: string } {
  const [y, m, d] = ancora.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12));

  let ini: Date;
  let fim: Date;

  switch (visao) {
    case 'dia':
      ini = base;
      fim = somaDias(base, 1);
      break;
    case 'semana':
      // Domingo — mesmo `weekStartsOn: 0` que a WeekView usa pra desenhar.
      ini = somaDias(base, -base.getUTCDay());
      fim = somaDias(ini, 7);
      break;
    case 'mes':
      ini = new Date(Date.UTC(y, m - 1, 1, 12));
      fim = new Date(Date.UTC(y, m, 1, 12));
      break;
  }

  return { de: meiaNoiteNaClinica(ini), ate: meiaNoiteNaClinica(fim) };
}

/** Fim do mês da âncora — horizonte do banner "fora da janela", que não segue a visão. */
export function fimDoMesDaAncora(ancora: string): string {
  const [y, m] = ancora.split('-').map(Number);
  return meiaNoiteNaClinica(new Date(Date.UTC(y, m, 1, 12)));
}
