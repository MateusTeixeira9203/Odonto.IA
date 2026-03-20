import type { Orcamento, OrcamentoItem, Pagamento } from "@/types/database";

export type OrcamentoEnriquecido = Orcamento & {
  paciente: { id: string; nome: string };
  dentista: { id: string; nome: string };
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
};

export interface MetricasMes {
  aprovadosMes: number;     // valor total dos aprovados no mês
  pendente: number;          // valor total a receber
  taxaConversao: number;     // 0-100 — aprovados / criados no mês
  totalMes: number;          // valor total criado no mês (mantido para retrocompat)
  recebido: number;          // valor confirmado recebido
}
