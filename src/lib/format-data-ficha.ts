/**
 * Exibição da data de uma ficha (Job A §7.1): se `data_atendimento` cai no mesmo
 * dia do `created_at` (fuso da clínica), mantém `DD/MM/AAAA às HH:MM`; se é
 * retroativa, só a data — hora falsa (meia-noite) mentiria. Formata
 * `data_atendimento` na mão (não via `new Date()`) pra não sofrer o shift de
 * fuso de um 'YYYY-MM-DD' parseado como UTC.
 */
export function formatarDataFicha(dataAtendimento: string, createdAt: string): string {
  const createdBRT = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  if (dataAtendimento === createdBRT) {
    return new Date(createdAt)
      .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      .replace(',', ' às');
  }
  const [y, m, d] = dataAtendimento.split('-');
  return `${d}/${m}/${y}`;
}
