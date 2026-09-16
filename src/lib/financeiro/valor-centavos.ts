/**
 * Converte texto monetário brasileiro em centavos sem passar por ponto flutuante.
 * Aceita `1.234,56` e, para teclados que usam ponto decimal, `1234.56`.
 */
export function parseValorCentavos(valor: string): number | null {
  const texto = valor.trim();
  if (!texto) return null;

  let inteiro: string;
  let fracao = '';

  if (texto.includes(',')) {
    const partes = texto.split(',');
    if (partes.length !== 2 || !/^\d{1,3}(?:\.\d{3})*$|^\d+$/.test(partes[0]) || !/^\d{1,2}$/.test(partes[1])) return null;
    [inteiro, fracao] = partes;
    inteiro = inteiro.replaceAll('.', '');
  } else if (texto.includes('.')) {
    const partes = texto.split('.');
    if (partes.length !== 2 || !/^\d+$/.test(partes[0]) || !/^\d{1,2}$/.test(partes[1])) return null;
    [inteiro, fracao] = partes;
  } else {
    if (!/^\d+$/.test(texto)) return null;
    inteiro = texto;
  }

  const centavos = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, '0') || '0');
  if (centavos <= BigInt(0) || centavos > BigInt(999_999_999_999) || centavos > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(centavos);
}

export function formatarCentavos(valorCentavos: number): string {
  if (!Number.isSafeInteger(valorCentavos)) return '—';
  const sinal = valorCentavos < 0 ? '-' : '';
  const absoluto = Math.abs(valorCentavos);
  const reais = Math.floor(absoluto / 100);
  const centavos = String(absoluto % 100).padStart(2, '0');
  return `${sinal}R$ ${new Intl.NumberFormat('pt-BR').format(reais)},${centavos}`;
}
