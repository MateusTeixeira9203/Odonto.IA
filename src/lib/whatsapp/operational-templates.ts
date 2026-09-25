export type WhatsAppTemplates = {
  confirmacao: string;
  lembrete_24h: string;
  reativacao: string;
  cobranca: string;
  orcamento: string;
};

export const defaultOperationalWhatsAppTemplates: WhatsAppTemplates = {
  confirmacao: 'Olá, {{nome_paciente}}. Confirmamos seu atendimento na {{nome_clinica}}. Qualquer imprevisto, conte com a gente.',
  lembrete_24h: 'Olá, {{nome_paciente}}. Passando para lembrar do seu atendimento amanhã na {{nome_clinica}}.',
  reativacao: 'Olá, {{nome_paciente}}. Tudo bem? A {{nome_clinica}} está à disposição para organizar seu retorno.',
  cobranca: 'Olá, {{nome_paciente}}. Identificamos uma pendência e estamos à disposição para ajudar pelo atendimento da {{nome_clinica}}.',
  orcamento: 'Olá, {{nome_paciente}}. Podemos ajudar com qualquer dúvida sobre seu planejamento na {{nome_clinica}}?',
};

export function interpolateWhatsAppTemplate(template: string, patientName: string, clinicName: string): string {
  return template.replaceAll('{{nome_paciente}}', patientName).replaceAll('{{nome_clinica}}', clinicName);
}
