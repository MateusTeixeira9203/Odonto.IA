export type CommunicationType = 'confirmacao' | 'lembrete' | 'follow_up' | 'cobranca' | 'reagendamento';

export interface CommunicationInput {
  tipo: CommunicationType;
  pacienteNome: string;
  dentistaNome: string;
  clinicaNome: string;
  dataHora?: string;
  procedimento?: string;
  valorTotal?: number;
  diasSemRetorno?: number;
}

const instrucoes: Record<CommunicationType, string> = {
  confirmacao:    'Confirme a consulta agendada. Tom cordial e direto. Peça confirmação de presença.',
  lembrete:       'Lembre o paciente da consulta que está chegando. Tom amigável e objetivo.',
  follow_up:      'Faça follow-up sobre orçamento enviado. Tom gentil, sem pressão. Pergunte se tem dúvidas.',
  cobranca:       'Lembre sobre pagamento pendente. Tom educado e compreensivo. Ofereça contato para dúvidas.',
  reagendamento:  'Proponha reagendar. Tom compreensivo. Oriente sobre como entrar em contato.',
};

export function buildCommunicationPrompt(input: CommunicationInput): string {
  const contexto = [
    input.dataHora    ? `Data/hora: ${input.dataHora}` : '',
    input.procedimento ? `Procedimento: ${input.procedimento}` : '',
    input.valorTotal   ? `Valor: R$ ${input.valorTotal.toFixed(2).replace('.', ',')}` : '',
    input.diasSemRetorno ? `Dias sem retorno: ${input.diasSemRetorno}` : '',
  ].filter(Boolean).join('\n');

  return `Você é o DEX, assistente de comunicação de uma clínica odontológica.
Gere uma mensagem de WhatsApp para o paciente.

Tipo: ${input.tipo.toUpperCase()} — ${instrucoes[input.tipo]}

Dados:
Paciente: ${input.pacienteNome}
Dentista: Dr(a). ${input.dentistaNome}
Clínica: ${input.clinicaNome}
${contexto}

Regras:
- Máximo 5 linhas no total
- Texto puro: sem markdown, sem asteriscos de formatação, sem emojis excessivos (máx 1)
- Comece com saudação ao paciente pelo nome
- Inclua o nome da clínica ou dentista no fechamento
- Inclua um CTA claro (confirmar, ligar, responder)
- Português brasileiro, tom profissional e cordial`;
}
