export type EstadoComercial =
  | 'isento'
  | 'trial'
  | 'ativo'
  | 'em_formacao'
  | 'past_due'
  | 'suspenso'
  | 'inativo';

export interface EstadoComercialInput {
  isento: boolean;
  statusAssinatura: string | null | undefined;
  formacaoAtiva?: boolean;
}

/**
 * Fonte única do estado comercial mostrado na UI. A isenção sempre vence:
 * ela não depende de uma linha histórica de assinatura e nunca expõe cobrança.
 */
export function resolverEstadoComercial(input: EstadoComercialInput): EstadoComercial {
  if (input.isento) return 'isento';

  switch (input.statusAssinatura) {
    case 'trialing':
    case 'trial':
      return 'trial';
    case 'active':
    case 'ativo':
      return 'ativo';
    case 'past_due':
      return 'past_due';
    case 'suspended':
    case 'unpaid':
    case 'suspenso':
      return 'suspenso';
    case 'aguardando_formacao':
    case 'checkout_pendente':
    case 'cartao_pronto':
      return 'em_formacao';
    default:
      return input.formacaoAtiva ? 'em_formacao' : 'inativo';
  }
}

export function estadoComercialPermiteCobranca(estado: EstadoComercial): boolean {
  return estado !== 'isento';
}

/** O bloqueio comercial preserva a sessão e os dados; somente a operação fica indisponível. */
export function estadoComercialBloqueiaOperacao(estado: EstadoComercial): boolean {
  return !['isento', 'trial', 'ativo'].includes(estado);
}
