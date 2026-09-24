import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { defaultOperationalWhatsAppTemplates, type WhatsAppTemplates } from '@/lib/whatsapp/operational-templates';

const TemplateSchema = z.string().trim().min(10).max(1000);
const TemplatesSchema = z.strictObject({
  reativacao: TemplateSchema,
  cobranca: TemplateSchema,
  orcamento: TemplateSchema,
});

export type { WhatsAppTemplates } from '@/lib/whatsapp/operational-templates';

export async function getOperationalWhatsAppTemplates(clinicaId: string): Promise<WhatsAppTemplates> {
  const client = await createClient();
  const { data, error } = await client.rpc('obter_modelos_whatsapp_operacionais', { p_clinica_id_esperada: clinicaId });
  if (error || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true || !('data' in data)) return defaultOperationalWhatsAppTemplates;
  const parsed = TemplatesSchema.safeParse(data.data);
  return parsed.success ? parsed.data : defaultOperationalWhatsAppTemplates;
}
