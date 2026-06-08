'use server';

import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';

export interface BotConfigForm {
  whatsapp_number: string;
  welcome_message: string;
  working_hours_start: string;
  working_hours_end: string;
  transfer_to_human_enabled: boolean;
  reminder_enabled: boolean;
  reminder_hours: number;
  reminder_message: string;
  // WhatsApp Business Cloud API (Meta Official)
  waba_id?: string | null;
  phone_number_id?: string | null;
  access_token?: string | null;
  webhook_verify_token?: string | null;
  bot_ativo?: boolean | null;
  dentistas_ativos_bot?: string[] | null;
}

export async function salvarBotConfig(form: BotConfigForm): Promise<{ ok: boolean; erro?: string }> {
  const { clinicId } = await requireRole(['secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('bot_config')
    .upsert(
      {
        clinica_id:                clinicId,
        whatsapp_number:           form.whatsapp_number,
        welcome_message:           form.welcome_message,
        working_hours_start:       form.working_hours_start,
        working_hours_end:         form.working_hours_end,
        transfer_to_human_enabled: form.transfer_to_human_enabled,
        reminder_enabled:          form.reminder_enabled,
        reminder_hours:            form.reminder_hours,
        reminder_message:          form.reminder_message,
        updated_at:                new Date().toISOString(),
      },
      { onConflict: 'clinica_id' },
    );

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

export async function carregarBotConfig(): Promise<BotConfigForm | null> {
  const { clinicId } = await requireRole(['secretaria']);
  const db = createServiceClient();

  const { data } = await db
    .from('bot_config')
    .select('*')
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as BotConfigForm;
}

export interface ConexaoOficialForm {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  webhook_verify_token: string;
  bot_ativo: boolean;
}

export async function salvarConexaoOficial(form: ConexaoOficialForm): Promise<{ ok: boolean; erro?: string }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('bot_config')
    .upsert(
      {
        clinica_id:           clinicId,
        waba_id:              form.waba_id || null,
        phone_number_id:      form.phone_number_id,
        access_token:         form.access_token,
        webhook_verify_token: form.webhook_verify_token,
        bot_ativo:            form.bot_ativo,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'clinica_id' },
    );

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
