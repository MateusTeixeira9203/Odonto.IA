/**
 * R-114 — Estado do orçamento, derivado dos fatos.
 *
 * O orçamento deixou de declarar `status`. O que a tela mostra vem dos fatos
 * registrados no banco: itens aprovados, descontos/acordo e pagamentos confirmados.
 * Isso existe porque o status declarado era contradito pelo dinheiro — 14 de 35 `rascunho` da
 * ClinDent tinham pagamento recebido, e o filtro do R-65 escondia R$ 33.203,34 de receita real.
 *
 * ⚠️ Esta função e a view `orcamentos_com_estado` (migration 145) implementam a MESMA fórmula.
 * Toda leitura usa uma das duas — **nunca reimplemente a conta inline**. É a mesma disciplina
 * que `filtro-responsavel.ts` impõe no R-53 (I3 de lá), e pelo mesmo motivo: duas cópias da
 * regra divergem, e aí nenhuma é confiável.
 *
 * Use a **view** quando estiver consultando `orcamentos` direto (o Postgres calcula, e a RLS
 * vale via `security_invoker`). Use **esta função** quando a query já embeda itens e pagamentos
 * e você quer evitar uma segunda ida ao banco.
 */

export type EstadoOrcamento = 'proposto' | 'aceito' | 'quitado';

export interface ItemParaEstado {
  precoTotal: number | null;
  aprovado: boolean;
}

export interface PagamentoParaEstado {
  valor: number;
  status: string;
}

export interface CobrancaParaEstado {
  desconto: number;
  situacao: string;
}

export interface EstadoDerivado {
  /** Soma dos itens aprovados — o que o paciente de fato fechou. */
  valorAprovado: number;
  /**
   * O que ele deve. `valor_acordado` (escrito SÓ pelas RPCs do R-34, plano de pagamento) tem
   * precedência: quando existe, já inclui a negociação. Sem acordo, abate os descontos
   * das cobranças abertas (ou o global, quando não há etapas) da soma aprovada.
   */
  valorDevido: number;
  valorPago: number;
  estado: EstadoOrcamento;
}

export function deriveEstadoOrcamento(input: {
  valorAcordado: number | null;
  desconto: number | null;
  cobrancas: CobrancaParaEstado[];
  itens: ItemParaEstado[];
  pagamentos: PagamentoParaEstado[];
}): EstadoDerivado {
  const aprovadoCentavos = input.itens
    .filter((i) => i.aprovado)
    .reduce((soma, i) => soma + Math.round((i.precoTotal ?? 0) * 100), 0);

  const cobrancasAbertas = input.cobrancas.filter((c) => c.situacao === 'aberta');
  // Etapas são obrigações próprias: não acumular o desconto global da proposta.
  const descontoCentavos = cobrancasAbertas.length > 0
    ? cobrancasAbertas.reduce((soma, c) => soma + Math.round(c.desconto * 100), 0)
    : Math.round((input.desconto ?? 0) * 100);
  // O acordo explícito já inclui a negociação. Sem ele, abate os descontos registrados.
  const devidoCentavos = input.valorAcordado !== null
    ? Math.round(input.valorAcordado * 100)
    : Math.max(0, aprovadoCentavos - descontoCentavos);

  const pagoCentavos = input.pagamentos
    .filter((p) => p.status === 'pago')
    .reduce((soma, p) => soma + Math.round(p.valor * 100), 0);

  // A ordem importa: "nenhum item aprovado" vence tudo. Sem isso um orçamento sem nada aprovado
  // e sem nada pago cairia em `quitado` (0 >= 0), dizendo que está fechado sem nunca ter sido
  // aceito. `proposto` é o que hoje se chama `rascunho`.
  const estado: EstadoOrcamento =
    aprovadoCentavos === 0 ? 'proposto' : pagoCentavos >= devidoCentavos ? 'quitado' : 'aceito';

  return {
    valorAprovado: aprovadoCentavos / 100,
    valorDevido: devidoCentavos / 100,
    valorPago: pagoCentavos / 100,
    estado,
  };
}

/**
 * Rótulo do estado na tela. `aceito` carrega o saldo porque "aceito" sozinho não responde a
 * pergunta que o dentista faz olhando a lista: quanto ainda entra.
 */
export function rotuloEstado(d: EstadoDerivado): string {
  if (d.estado === 'proposto') return 'Proposto';
  if (d.estado === 'quitado') return 'Quitado';
  const falta = Math.max(0, Math.round((d.valorDevido - d.valorPago) * 100) / 100);
  return `Aceito — falta ${falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
}

/**
 * Substitui `STATUS_ORCAMENTO_SEM_PAGAMENTO` (R-65). Bloqueia por FATO — zero item aprovado —
 * em vez de por status declarado, que era o que escondia receita verdadeira.
 */
export function orcamentoAceitaPagamento(estado: EstadoOrcamento): boolean {
  return estado !== 'proposto';
}

export const ERRO_ORCAMENTO_SEM_APROVACAO =
  'Nenhum procedimento foi aprovado neste orçamento — marque o que o paciente aceitou antes de registrar o pagamento.';
