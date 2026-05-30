export interface ContextualQuestionsInput {
  motivoConsulta: string | null;
  ultimaQueixa: string | null;
  planejamentoAtivo: string | null;
  alertasClinicos: string[];
}

export interface ContextualQuestionsOutput {
  perguntas: string[];
}

export function buildContextualQuestionsPrompt(input: ContextualQuestionsInput): string {
  return `Você é o DEX, assistente clínico odontológico.
Sugira 3 perguntas relevantes para o dentista fazer ao paciente nesta consulta.

Contexto:
Motivo: ${input.motivoConsulta ?? 'não informado'}
Última queixa: ${input.ultimaQueixa ?? 'não registrada'}
Tratamento ativo: ${input.planejamentoAtivo ?? 'nenhum'}
Alertas clínicos: ${input.alertasClinicos.join(', ') || 'nenhum'}

Retorne SOMENTE JSON válido:
{ "perguntas": ["pergunta 1?", "pergunta 2?", "pergunta 3?"] }

Regras:
- Perguntas abertas, objetivas, relevantes para este contexto específico
- NÃO façam diagnóstico ou conduta clínica
- Português brasileiro`;
}
