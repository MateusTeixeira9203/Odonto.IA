/**
 * Sentinelas de arcada / boca inteira.
 *
 * Procedimentos de arcada ou boca toda não têm um dente FDI individual — são
 * representados por números sentinela gravados em `fichas.dentes_afetados` (int[]),
 * junto dos dentes reais. Ficam acima de 90 para nunca colidirem com FDI válido
 * (permanentes 11–48, decíduos 51–85).
 */
export const ARCH_SUPERIOR = 97;
export const ARCH_INFERIOR = 98;
export const ARCH_COMPLETA = 99;

export const ARCH_LABELS: Record<number, string> = {
  [ARCH_SUPERIOR]: 'Arcada Superior',
  [ARCH_INFERIOR]: 'Arcada Inferior',
  [ARCH_COMPLETA]: 'Boca Toda',
};

/** true se o número é um sentinela de arcada (97/98/99), não um dente FDI. */
export const isArch = (n: number): boolean => n === ARCH_SUPERIOR || n === ARCH_INFERIOR || n === ARCH_COMPLETA;

/** Rótulo legível: nome da arcada para sentinelas, o próprio número para dentes. */
export const denteLabel = (n: number): string => ARCH_LABELS[n] ?? String(n);
