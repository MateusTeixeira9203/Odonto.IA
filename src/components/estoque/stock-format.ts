/** Exibição exata: não converte quantidades de estoque para ponto flutuante. */
export function formatStockQuantity(value: string): string {
  const [whole, decimal] = value.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimal ? `,${decimal}` : '');
}

export function canonicalStockQuantity(value: string): string {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return normalized;
  const [whole, fraction = ''] = normalized.split('.');
  const decimals = fraction.replace(/0+$/, '');
  return `${whole.replace(/^0+(?=\d)/, '')}${decimals ? `.${decimals}` : ''}`;
}

export function compareStockQuantity(a: string, b: string): number {
  const micros = (value: string) => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))) * (negative ? -1n : 1n);
  };
  const difference = micros(a) - micros(b);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function formatStockDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export const STOCK_UNITS = { unidade: 'unidades', g: 'g', ml: 'ml' } as const;
