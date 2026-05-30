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
