import { redirect } from 'next/navigation';

// O cliente legado ainda referencia estes contratos durante a fase de isolamento. A rota não o
// renderiza mais; os tipos permanecem até a remoção definitiva do cliente, sem tocar em dados.
export type OrcamentoItemRow = {
  id: string;
  orcamento_id: string;
  descricao: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
};

export type PagamentoRow = {
  id: string;
  orcamento_id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  parcela_numero: number | null;
  total_parcelas: number | null;
  marcado_por: { nome: string } | null;
};

export type OrcamentoRow = {
  id: string;
  ficha_id: string | null;
  created_at: string;
  updated_at: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  valor_acordado: number | null;
  desconto: number;
  validade_dias: number;
  condicoes_pagamento: string | null;
  paciente: { id: string; nome: string; telefone: string | null } | null;
  dentista: { id: string; nome: string } | null;
  itens: OrcamentoItemRow[];
  pagamentos: PagamentoRow[];
};

/**
 * R-153 — o orçamento clínico nasce na Ficha do paciente. A tela geral antiga fica isolada
 * nesta fase para não criar propostas sem Ficha; dados e cliente legado permanecem preservados
 * até a remoção posterior, depois dos gates de produção.
 */
export default function OrcamentosPage() {
  redirect('/dashboard/pacientes');
}
