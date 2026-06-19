import { getDentistaCached } from '@/lib/get-dentista';
import { getInstanceForClinica } from '@/services/whatsapp.service';
import { requirePermission } from '@/server/authorization/guards';
import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { carregarMensagensBot } from './actions';
import { DEFAULTS_MENSAGENS } from '@/lib/whatsapp/template';
import { BotPageClient } from './_components/bot-page-client';
import { PageTransition } from '@/components/layout/page-transition';

export default async function BotPage() {
  await requirePermission('whatsapp_config');

  const { clinicId } = await requireClinicContext();
  const db = createServiceClient();
  const { data: clinica } = await db
    .from('clinicas')
    .select('plano')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinica?.plano === 'SOLO') {
    redirect('/planos?feature=whatsapp');
  }

  const dentista = await getDentistaCached();

  const [instancia, mensagens] = await Promise.all([
    getInstanceForClinica(dentista!.clinica_id),
    carregarMensagensBot().catch(() => DEFAULTS_MENSAGENS),
  ]);

  return (
    <PageTransition>
      <BotPageClient
        initialStatus={instancia?.status ?? 'disconnected'}
        initialQrcode={null}
        initialInstanceName={null}
        initialMensagens={mensagens}
        role={dentista!.role}
        clinicaNome={dentista!.clinica}
      />
    </PageTransition>
  );
}
