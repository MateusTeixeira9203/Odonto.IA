export type CobrancaAtiva = {
  id: string;
  orcamentoId: string;
  dentistaId: string;
  valorFinal: number;
  descricoes: (string | null)[];
};

export type PagamentoDaCobranca = {
  cobrancaId: string | null;
  valor: number;
  status: string;
};

export type CobrancaComSaldo = {
  id: string;
  cobrancaId: string;
  total: number;
  descricaoResumo: string;
  valorPendente: number;
  dentistaId: string;
  dentistaNome: string | null;
};

function paraCentavos(valor: number): number {
  return Math.round(Number(valor) * 100);
}

export function cobrançasAtivasComSaldo(
  cobrancas: CobrancaAtiva[],
  pagamentos: PagamentoDaCobranca[],
  nomesDentistas: ReadonlyMap<string, string>,
): CobrancaComSaldo[] {
  return cobrancas.map((cobranca) => {
    const pagoCentavos = pagamentos
      .filter((pagamento) => pagamento.cobrancaId === cobranca.id && pagamento.status === 'pago')
      .reduce((soma, pagamento) => soma + paraCentavos(pagamento.valor), 0);
    const totalCentavos = paraCentavos(cobranca.valorFinal);
    return {
      id: cobranca.orcamentoId,
      cobrancaId: cobranca.id,
      total: totalCentavos / 100,
      descricaoResumo: cobranca.descricoes.filter((descricao): descricao is string => Boolean(descricao)).slice(0, 2).join(', ') || 'Etapa do orçamento',
      valorPendente: Math.max(0, totalCentavos - pagoCentavos) / 100,
      dentistaId: cobranca.dentistaId,
      dentistaNome: nomesDentistas.get(cobranca.dentistaId) ?? null,
    };
  }).filter((cobranca) => cobranca.valorPendente > 0);
}
