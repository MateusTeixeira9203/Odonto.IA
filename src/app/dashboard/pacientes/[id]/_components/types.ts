export type OrcamentoItem = {
  id: string;
  descricao: string | null;
  preco_total: number | null;
  quantidade: number;
};

export type Pagamento = {
  id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  marcado_por: { nome: string } | null;
};

export type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'pago';
  total: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
  aprovado_por: { nome: string } | null;
  aprovado_em: string | null;
};

export type FichaParaOrc = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
};

export type ProcedimentoClinica = {
  id: string;
  nome: string;
  preco_padrao: number | null;
};

export type NovoOrcItem = {
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  preco: number;
};

export type OrcEditItem = {
  id?: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};
