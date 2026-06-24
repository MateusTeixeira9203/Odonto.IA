// Camada de persona (Fase 1 — retenção).
// Fonte única do tipo e dos textos/recompensas diferenciados por perfil.
// Módulo puro (sem imports de servidor) — seguro em client e server components.

export type FocoPrincipal = "economizar_tempo" | "crescer";

export interface PersonaConfig {
  id: FocoPrincipal;
  /** Card do onboarding */
  label: string;
  sublabel: string;
  /** Promessa do DEX no aha */
  promessaAha: string;
  /** Linha de sucesso no fim do onboarding */
  sucesso: string;
}

export const PERSONAS: Record<FocoPrincipal, PersonaConfig> = {
  economizar_tempo: {
    id: "economizar_tempo",
    label: "Economizar tempo documentando",
    sublabel: "A ficha se monta enquanto você atende — sem digitar.",
    promessaAha: "Em 1 minuto eu te mostro como nunca mais digitar uma ficha.",
    sucesso: "Pronto para atender com menos tempo na papelada.",
  },
  crescer: {
    id: "crescer",
    label: "Crescer e fechar mais tratamentos",
    sublabel: "Planejamento visual que ajuda o paciente a dizer sim.",
    promessaAha: "Em 1 minuto eu te mostro como montar um planejamento que fecha caso.",
    sucesso: "Pronto para apresentar planejamentos que convertem.",
  },
};

export const PERSONA_IDS: FocoPrincipal[] = ["economizar_tempo", "crescer"];

/** Resolve a config, tolerando null (sem diferenciação → usa veterano como neutro padrão). */
export function getPersona(foco: FocoPrincipal | null | undefined): PersonaConfig {
  return foco ? PERSONAS[foco] : PERSONAS.economizar_tempo;
}
