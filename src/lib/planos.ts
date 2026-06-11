// Definições canônicas dos planos Odonto.IA.
// Usadas tanto na UI (PlanGuard, Sidebar) quanto no backend (onboarding, validações).
//
// Dois planos:
//   SOLO    — dentista autônomo, 1 dentista + 1 secretária. Features clínicas completas.
//             Sem WhatsApp. Cobrança única de R$249/mês.
//   CLINICA — múltiplos dentistas, secretária com visão unificada, WhatsApp integrado.
//             R$179/dentista/mês. Mínimo 3 dentistas. Cada dentista paga individualmente.

export type PlanoId = 'SOLO' | 'CLINICA';

export interface PlanoFeatures {
  /** Bot com mensagens customizáveis */
  botCustomizavel: boolean;
  /** Bot pode criar agendamentos automáticos via WhatsApp */
  botAgendamento: boolean;
  /** Transcrição de voz por IA na ficha clínica */
  transcricaoVoz: boolean;
  /** Geração automática de orçamento por IA */
  orcamentoIA: boolean;
  /** Aba de Planejamento com IA no perfil do paciente */
  planejamentoIA: boolean;
  /** Acesso ao módulo Financeiro com lançamento de despesas */
  financeiro: boolean;
  /** Pode ter secretária na equipe (ambos os planos, com limites diferentes) */
  equipe: boolean;
  /** Multi-dentistas além do fundador (CLINICA only) */
  multiDentistas: boolean;
  /** Silos de privacidade financeira entre dentistas (CLINICA only) */
  silosPrivacidade: boolean;
  /** Dex Co-Piloto: briefing, simplificação, inteligência comercial (CLINICA only) */
  copiloto: boolean;
}

export interface PlanoConfig {
  id: PlanoId;
  label: string;
  labelContexto: string; // "Consultório" (Solo) ou "Clínica" (Clínica)
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
    label: 'Consultório',
    labelContexto: 'Consultório',
    preco: 249,
    precoPorDentistaExtra: null,
    limiteDentistas: 1,
    features: {
      botCustomizavel:  false,
      botAgendamento:   false,
      transcricaoVoz:   true,
      orcamentoIA:      true,
      planejamentoIA:   true,
      financeiro:       true,
      equipe:           true,   // 1 secretária permitida
      multiDentistas:   false,
      silosPrivacidade: false,
      copiloto:         false,
    },
  },
  CLINICA: {
    id: 'CLINICA',
    label: 'Clínica',
    labelContexto: 'Clínica',
    preco: 179,
    precoPorDentistaExtra: null, // cada dentista paga R$179 individualmente
    limiteDentistas: 99,
    features: {
      botCustomizavel:  true,
      botAgendamento:   true,
      transcricaoVoz:   true,
      orcamentoIA:      true,
      planejamentoIA:   true,
      financeiro:       true,
      equipe:           true,
      multiDentistas:   true,
      silosPrivacidade: true,
      copiloto:         true,
    },
  },
};

/** Retorna true se o plano tem acesso à feature. */
export function temFeature(
  plano: PlanoId | null | undefined,
  feature: keyof PlanoFeatures,
): boolean {
  if (!plano) return false;
  // Backward compat: usuários no plano BASICO legado tratados como SOLO
  const planoNormalizado = (plano as string) === 'BASICO' ? 'SOLO' : plano;
  return PLANOS[planoNormalizado as PlanoId]?.features[feature] ?? false;
}

/** Retorna a config do plano, com fallback para SOLO. */
export function getPlano(plano: PlanoId | null | undefined): PlanoConfig {
  // Backward compat: BASICO legado → SOLO
  if (!plano || (plano as string) === 'BASICO') return PLANOS['SOLO'];
  return PLANOS[plano] ?? PLANOS['SOLO'];
}

/**
 * Retorna o limite de dentistas correto baseado no plano.
 */
export function limiteDentistasParaPlano(plano: PlanoId): number {
  return PLANOS[plano]?.limiteDentistas ?? 1;
}

/**
 * Retorna o label de contexto correto para o plano do usuário.
 * Solo → "Consultório" | Clínica → "Clínica"
 */
export function getLabelContexto(plano: PlanoId | null | undefined): string {
  return getPlano(plano).labelContexto;
}
