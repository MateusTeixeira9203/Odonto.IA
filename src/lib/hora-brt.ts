/**
 * Hora e data no fuso da clínica (BRT), independente de onde o código roda.
 *
 * POR QUE EXISTE: `new Date().getHours()` devolve a hora do ambiente. No browser
 * isso é o fuso do dentista e dá certo; num **Server Component** rodando na Vercel
 * é UTC, três horas à frente do Brasil. Foi o bug relatado em 21/07: às 9h da manhã
 * o dashboard dizia "Boa tarde" (12h UTC) e às 15h dizia "Boa noite" (18h UTC).
 *
 * Use estas funções em qualquer lugar que **exiba** hora ou data ao usuário.
 * Para COMPARAR instantes (`a.getTime() < b.getTime()`) não precisa: timestamp é
 * absoluto e não depende de fuso.
 *
 * Brasil não tem horário de verão desde o Decreto nº 9.772/2019, mas usamos a zona
 * IANA em vez de offset fixo — se o decreto mudar, o `Intl` acompanha sozinho.
 */

const TZ = 'America/Sao_Paulo';

/** Hora do dia (0–23) no fuso da clínica. */
export function horaBRT(d: Date = new Date()): number {
  // hourCycle 'h23' evita o "24" que alguns locales devolvem à meia-noite.
  const hh = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return Number(hh);
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pela hora da clínica. */
export function saudacaoBRT(d: Date = new Date()): string {
  const h = horaBRT(d);
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "quarta-feira, 22 de julho" — dia da clínica, não do servidor. */
export function dataExtensaBRT(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d);
}
