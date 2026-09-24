import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const TemplateSchema = z.string().trim().min(10).max(1000);
const TemplatesSchema = z.strictObject({
  reativacao: TemplateSchema,
  cobranca: TemplateSchema,
  orcamento: TemplateSchema,
});

export type WhatsAppTemplates = z.infer<typeof TemplatesSchema>;

const fallback: WhatsAppTemplates = {
  reativacao: 'Olá, {{nome_paciente}}. Tudo bem? A {{nome_clinica}} está à disposição para organizar seu retorno.',
  cobranca: 'Olá, {{nome_paciente}}. Identificamos uma pendência e estamos à disposição para ajudar pelo atendimento da {{nome_clinica}}.',
  orcamento: 'Olá, {{nome_paciente}}. Podemos ajudar com qualquer dúvida sobre seu planejamento na {{nome_clinica}}?',
};

export async function getOperationalWhatsAppTemplates(clinicaId: string): Promise<WhatsAppTemplates> {
  const client = await createClient();
  const { data, error } = await client.rpc('obter_modelos_whatsapp_operacionais', { p_clinica_id_esperada: clinicaId });
  if (error || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true || !('data' in data)) return fallback;
  const parsed = TemplatesSchema.safeParse(data.data);
  return parsed.success ? parsed.data : fallback;
}

export function interpolateWhatsAppTemplate(template: string, patientName: string, clinicName: string): string {
  return template.replaceAll('{{nome_paciente}}', patientName).replaceAll('{{nome_clinica}}', clinicName);
}
