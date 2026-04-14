'use server';

import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
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
}

async function verificarAcesso() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role !== 'secretaria') redirect('/dashboard');
  return dentista;
}

export async function salvarBotConfig(form: BotConfigForm): Promise<{ ok: boolean; erro?: string }> {
  const dentista = await verificarAcesso();
  const db = createServiceClient();

  const { error } = await db
    .from('bot_config')
    .upsert(
      {
        clinica_id:                dentista.clinica_id,
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
  const dentista = await verificarAcesso();
  const db = createServiceClient();

  const { data } = await db
    .from('bot_config')
    .select('*')
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!data) return null;
  return data as unknown as BotConfigForm;
}
