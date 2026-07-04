/**
 * Input de valor decimal em formato brasileiro — digita "250" ou "250,50" (ou "250.50");
 * normaliza no blur. Compartilhado por todo input de R$ do app (orçamentos, pagamentos).
 *
 * Substitui o antigo modelo dígitos→centavos, que reparseava a string formatada a cada
 * tecla e embaralhava o valor (250→289) — aqui o estado guarda o texto que o usuário vê.
 */
export const parseValorBR = (str: string): number => {
  const cleaned = str.trim();
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const n = parseFloat(normalized);
  return isNaN(n) || n < 0 ? 0 : n;
};

export const formatValorBR = (n: number): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
