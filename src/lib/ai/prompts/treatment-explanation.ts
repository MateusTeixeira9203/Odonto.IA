export interface TreatmentExplanationInput {
  procedimento: string;
  dentes?: string[];
  etapas?: string[];
  pacienteNome: string;
  contextoPaciente?: string;
}

export function buildTreatmentExplanationPrompt(input: TreatmentExplanationInput): string {
  const dentesTexto = input.dentes?.length
    ? `Dentes envolvidos: ${input.dentes.join(', ')}.`
    : '';
  const etapasTexto = input.etapas?.length
    ? `Etapas: ${input.etapas.map((e, i) => `${i + 1}. ${e}`).join('; ')}.`
    : '';
  const contexto = input.contextoPaciente
    ? `Contexto do paciente: ${input.contextoPaciente}.`
    : '';

  return `Você é o DEX, assistente clínico. Explique o procedimento abaixo para ${input.pacienteNome} de forma clara e acolhedora.

PROCEDIMENTO: ${input.procedimento}
${dentesTexto}
${etapasTexto}
${contexto}

Escreva uma explicação que responda, em linguagem simples e sem jargões:
1. O que é este procedimento (1 frase direta)
2. Por que é importante realizá-lo (1-2 frases)
3. Como é feito, de forma tranquilizadora (2-3 frases)
4. O que esperar depois (recuperação, cuidados — 1-2 frases)

Tom: humano, tranquilizador e profissional. Máximo 180 palavras.
Use texto corrido, sem listas ou bullets.
NÃO faça diagnósticos. NÃO dê recomendações médicas autônomas.
Responda em português brasileiro.`;
}
