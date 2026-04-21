// Definições canônicas dos planos DentIA.
// Usadas tanto na UI (PlanGuard, Sidebar) quanto no backend (onboarding, validações).

export type PlanoId = 'SOLO' | 'BASICO' | 'CLINICA';

export interface PlanoFeatures {
  /** Bot com mensagens customizáveis (BASICO+) */
  botCustomizavel: boolean;
  /** Bot pode criar agendamentos automáticos via WhatsApp (BASICO+) */
  botAgendamento: boolean;
  /** Transcrição de voz por IA na ficha clínica (BASICO+) */
  transcricaoVoz: boolean;
  /** Geração automática de orçamento por IA (BASICO+) */
  orcamentoIA: boolean;
  /** Aba de Planejamento com IA no perfil do paciente (BASICO+) */
  planejamentoIA: boolean;
  /** Acesso ao módulo Financeiro com lançamento de despesas (BASICO+) */
  financeiro: boolean;
  /** Pode ter secretária na equipe (BASICO+) */
  equipe: boolean;
  /** Multi-dentistas além do fundador (CLINICA) */
  multiDentistas: boolean;
  /** Silos de privacidade financeira entre dentistas (CLINICA) */
  silosPrivacidade: boolean;
  /** Dex Co-Piloto: briefing, simplificação, inteligência comercial, notificações inter-role (CLINICA) */
  copiloto: boolean;
}

export interface PlanoConfig {
  id: PlanoId;
  label: string;
  preco: number;
  /** Custo por dentista extra acima do limite base (null = sem extra) */
  precoPorDentistaExtra: number | null;
  /** Máximo de dentistas-proprietários (secretárias não contam) */
  limiteDentistas: number;
  features: PlanoFeatures;
}

export const PLANOS: Record<PlanoId, PlanoConfig> = {
  SOLO: {
    id: 'SOLO',
    label: 'Solo',
    preco: 167,
    precoPorDentistaExtra: null,
    limiteDentistas: 1,
    features: {
      botCustomizavel: false,
      botAgendamento: false,
      transcricaoVoz: false,
      orcamentoIA: false,
      planejamentoIA: false,
      financeiro: false,
      equipe: false,
      multiDentistas: false,
      silosPrivacidade: false,
      copiloto: false,
    },
  },
  BASICO: {
    id: 'BASICO',
    label: 'Básico',
    preco: 247,
    precoPorDentistaExtra: null,
    limiteDentistas: 1,   // 1 dentista + 1 secretária (secretárias não contam)
    features: {
      botCustomizavel: true,
      botAgendamento: true,
      transcricaoVoz: true,
      orcamentoIA: true,
      planejamentoIA: true,
      financeiro: false,
      equipe: true,
      multiDentistas: false,
      silosPrivacidade: false,
      copiloto: false,
    },
  },
  CLINICA: {
    id: 'CLINICA',
    label: 'Clínica',
    preco: 397,
    precoPorDentistaExtra: 147,
    limiteDentistas: 5,   // até 5 dentistas + 1 secretária; R$147 por dentista adicionado (a partir do 2º)
    features: {
      botCustomizavel: true,
      botAgendamento: true,
      transcricaoVoz: true,
      orcamentoIA: true,
      planejamentoIA: true,
      financeiro: true,
      equipe: true,
      multiDentistas: true,
      silosPrivacidade: true,
      copiloto: true,
    },
  },
};

/** Retorna true se o plano tem acesso à feature. */
export function temFeature(
  plano: PlanoId | null | undefined,
  feature: keyof PlanoFeatures,
): boolean {
  if (!plano) return false;
  return PLANOS[plano]?.features[feature] ?? false;
}

/** Retorna a config do plano, com fallback para SOLO. */
export function getPlano(plano: PlanoId | null | undefined): PlanoConfig {
  return PLANOS[plano ?? 'SOLO'];
}

/**
 * Retorna o limite de dentistas correto baseado no plano.
 * Usado para sincronizar clinicas.limite_dentistas ao criar/upgradar.
 */
export function limiteDentistasParaPlano(plano: PlanoId): number {
  return PLANOS[plano].limiteDentistas;
}
