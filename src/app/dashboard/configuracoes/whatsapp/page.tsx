import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import WhatsAppConfigClient from './_components/whatsapp-config-client';
import type { BotConfigForm } from './actions';

export default async function WhatsAppConfigPage() {
  const { clinicId } = await requireRole(['admin', 'dentista']);

  const db = createServiceClient();
  const { data: clinica } = await db
    .from('clinicas')
    .select('plano')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinica?.plano === 'SOLO') {
    redirect('/planos?feature=whatsapp');
  }

  const { data: configRaw } = await db
    .from('bot_config')
    .select('*')
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const defaultConfig: BotConfigForm = {
    whatsapp_number:           '',
    welcome_message:           'Olá! Sou a assistente virtual da clínica. Como posso ajudar?',
    working_hours_start:       '08:00',
    working_hours_end:         '18:00',
    transfer_to_human_enabled: true,
    reminder_enabled:          true,
    reminder_hours:            24,
    reminder_message:
      '🔔 Lembrete: Sua consulta está agendada para {data} às {hora}. ' +
      'Confirme sua presença respondendo CONFIRMO.',
  };

  return (
    <WhatsAppConfigClient
      initialConfig={(configRaw as BotConfigForm | null) ?? defaultConfig}
    />
  );
}
