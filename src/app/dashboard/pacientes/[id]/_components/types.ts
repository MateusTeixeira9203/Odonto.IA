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
  data_vencimento: string | null;
  parcela_numero: number | null;
  total_parcelas: number | null;
  marcado_por: { nome: string } | null;
};

export type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  dentista_id: string | null;
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
  /** Texto decimal BR ("250" ou "250,50") — parsear com `parseValorBR` antes de usar como número. */
  preco: string;
};

export type OrcEditItem = {
  id?: string;
  descricao: string;
  quantidade: number;
  /** Texto decimal BR ("250" ou "250,50") — parsear com `parseValorBR` antes de usar como número. */
  preco_unitario: string;
};
