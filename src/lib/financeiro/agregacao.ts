export type MovimentoFinanceiro = { valor: number; status?: string };

export function agregarFluxoFinanceiro(input: {
  pagamentos: MovimentoFinanceiro[];
  receitasManuais: MovimentoFinanceiro[];
  despesas: MovimentoFinanceiro[];
}): { receita: number; despesas: number; saldo: number } {
  const emCentavos = (movimentos: MovimentoFinanceiro[], apenasPagos = false) => movimentos
    .filter((movimento) => !apenasPagos || movimento.status === 'pago')
    .reduce((soma, movimento) => soma + Math.round(Number(movimento.valor) * 100), 0);
  const receita = emCentavos(input.pagamentos, true) + emCentavos(input.receitasManuais);
  const despesas = emCentavos(input.despesas);
  return { receita: receita / 100, despesas: despesas / 100, saldo: (receita - despesas) / 100 };
}
