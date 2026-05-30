import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';
import WhatsAppConfigClient from './_components/whatsapp-config-client';
import type { BotConfigForm } from './actions';

function normalizeStatus(raw: string): 'disconnected' | 'connecting' | 'connected' {
  if (raw === 'connected' || raw === 'open') return 'connected';
  if (raw === 'connecting') return 'connecting';
  return 'disconnected';
}

export default async function WhatsAppConfigPage() {
  const { clinicId } = await requireRole(['admin', 'dentista']);

  const db = createServiceClient();

  const [{ data: configRaw }, { data: instanciaRaw }] = await Promise.all([
    db
      .from('bot_config')
      .select('*')
      .eq('clinica_id', clinicId)
      .maybeSingle(),
    db
      .from('instancias_whatsapp')
      .select('instance_name, status, qrcode')
      .eq('clinica_id', clinicId)
      .maybeSingle(),
  ]);

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
      initialInstance={
        instanciaRaw
          ? {
              instance_name: instanciaRaw.instance_name as string,
              status:        normalizeStatus((instanciaRaw.status as string) ?? 'inactive'),
              qrcode:        (instanciaRaw.qrcode as string | null) ?? undefined,
            }
          : null
      }
    />
  );
}
