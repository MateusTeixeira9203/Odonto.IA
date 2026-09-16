import type { OrcamentoHtmlData } from '../prontuario-html';
import type { OrcamentoData } from '../pdf/orcamento';
import { deriveEstadoOrcamento } from './estado';

/** Projeta exatamente o recorte de impressão vigente para o renderer de arquivo. */
export function montarDocumentoPdf(o: OrcamentoHtmlData & { clinica: { nome: string } }): OrcamentoData {
  const items = o.itens.filter((i) => i.aprovado);
  const state = deriveEstadoOrcamento({
    valorAcordado: o.valor_acordado, desconto: o.desconto, cobrancas: o.cobrancas,
    itens: o.itens.map((i) => ({ precoTotal: i.preco_total, aprovado: i.aprovado })),
    pagamentos: o.pagamentos,
  });
  const active = o.pagamentos.filter((p) => p.status !== 'cancelado');
  return {
    id: o.id, numero: o.id.slice(0, 8).toUpperCase(), data: o.created_at,
    validade: new Date(new Date(o.created_at).getTime() + o.validade_dias * 86_400_000).toISOString(),
    status: state.estado, paciente: { nome: o.paciente?.nome ?? 'Paciente', telefone: o.paciente?.telefone ?? undefined },
    dentista: { nome: o.dentista?.nome ?? 'Dentista', cro: '' }, clinica: o.clinica,
    mostrarValorPorItem: o.mostrar_valor_por_item,
    procedimentos: items.map((item, index) => ({
      id: String(index), nome: item.descricao ?? 'Procedimento', quantidade: item.quantidade,
      valor: item.preco_unitario ?? 0, total: item.preco_total ?? 0,
      composicao: item.composicao?.map((member) => `${member.quantidade} × ${member.descricao}`),
    })),
    subtotal: state.valorAprovado,
    desconto: Math.max(0, Math.round((state.valorAprovado - state.valorDevido) * 100) / 100),
    total: state.valorDevido,
    totalPago: active.length ? state.valorPago : undefined,
    totalPendente: active.length ? active.filter((p) => p.status === 'pendente').reduce((sum, p) => sum + Math.round(p.valor * 100), 0) / 100 : undefined,
    forma_pagamento: o.condicoes_pagamento ?? undefined,
  };
}
