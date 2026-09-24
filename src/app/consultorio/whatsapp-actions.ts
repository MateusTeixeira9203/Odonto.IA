'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getClinicHubContext } from '@/server/consultorio/context';

const TemplateSchema = z.string().trim().min(10).max(1000);
export type WhatsAppTemplateState = { ok: boolean; message: string };

export async function saveOperationalWhatsAppTemplates(_: WhatsAppTemplateState, formData: FormData): Promise<WhatsAppTemplateState> {
  const context = await getClinicHubContext();
  if (!context.ok) return { ok: false, message: context.mensagem };
  if (!context.data.governanca?.papeis.some((role) => role === 'proprietario' || role === 'gestor')) return { ok: false, message: 'Apenas proprietário ou gestor edita os modelos.' };
  const parsed = z.object({ reativacao: TemplateSchema, cobranca: TemplateSchema, orcamento: TemplateSchema }).safeParse({
    reativacao: formData.get('reativacao'), cobranca: formData.get('cobranca'), orcamento: formData.get('orcamento'),
  });
  if (!parsed.success) return { ok: false, message: 'Cada modelo precisa ter entre 10 e 1.000 caracteres.' };
  const client = await createClient();
  const { data, error } = await client.rpc('salvar_modelos_whatsapp_operacionais', {
    p_clinica_id_esperada: context.data.member.clinicaId,
    p_modelos: parsed.data,
  });
  if (error || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) return { ok: false, message: 'Não foi possível salvar os modelos agora.' };
  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/consultorio');
  return { ok: true, message: 'Modelos de WhatsApp atualizados.' };
}
