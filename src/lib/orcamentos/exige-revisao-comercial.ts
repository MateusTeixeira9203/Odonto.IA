type OrcamentoComHistoricoComercial = {
  status: string;
  valor_acordado: number | null;
  plano_forma?: string | null;
  cobrancas: unknown[];
  pagamentos: unknown[];
  aceite: unknown | null;
  itens: { aprovado: boolean }[];
};

export function exigeRevisaoComercial(orcamento: OrcamentoComHistoricoComercial): boolean {
  return orcamento.itens.some((item) => item.aprovado)
    || orcamento.status === 'aprovado'
    || orcamento.valor_acordado !== null
    || orcamento.plano_forma !== null
    || orcamento.cobrancas.length > 0
    || orcamento.pagamentos.length > 0
    || orcamento.aceite !== null;
}
