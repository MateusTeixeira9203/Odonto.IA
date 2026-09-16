export type SituacaoCoberturaComercial = 'coberto' | 'sem_cobertura' | 'legado';
export type StatusAssinaturaComercial =
  | 'aguardando_checkout'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'canceled';
export type PapelMembroComercial = 'admin' | 'dentista' | 'secretaria' | 'gestor' | 'protetico';

export type CoberturaComercialInput = {
  possuiContratoR165: boolean;
  papel: PapelMembroComercial;
  possuiPerfilClinico: boolean;
  coberturaDoDentista?: StatusAssinaturaComercial | null;
  existeDentistaCoberto: boolean;
};

const STATUS_COBERTO = new Set<StatusAssinaturaComercial>(['trialing', 'active', 'past_due']);

/**
 * Espelho sem I/O do contrato SQL R165. A resolução real permanece no banco;
 * este recorte deixa as regras verificáveis sem fingir que checkout pendente é acesso.
 */
export function resolverCoberturaComercial(input: CoberturaComercialInput): SituacaoCoberturaComercial {
  if (!input.possuiContratoR165) return 'legado';
  if (input.possuiPerfilClinico) {
    return input.coberturaDoDentista && STATUS_COBERTO.has(input.coberturaDoDentista)
      ? 'coberto'
      : 'sem_cobertura';
  }
  if ((input.papel === 'gestor' || input.papel === 'secretaria') && input.existeDentistaCoberto) {
    return 'coberto';
  }
  return 'sem_cobertura';
}
