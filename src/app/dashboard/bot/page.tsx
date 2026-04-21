import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { getInstanceForClinica } from '@/services/whatsapp.service';
import { carregarMensagensBot } from './actions';
import { DEFAULTS_MENSAGENS } from '@/lib/whatsapp/template';
import { BotPageClient } from './_components/bot-page-client';
import { PageTransition } from '@/components/layout/page-transition';

export default async function BotPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role === 'dentista') redirect('/dashboard');
  if (dentista.role !== 'admin' && dentista.role !== 'secretaria') redirect('/dashboard');

  const [instancia, mensagens] = await Promise.all([
    getInstanceForClinica(dentista.clinica_id),
    carregarMensagensBot().catch(() => DEFAULTS_MENSAGENS),
  ]);

  return (
    <PageTransition>
      <BotPageClient
        initialStatus={instancia?.status ?? 'disconnected'}
        initialQrcode={instancia?.qrcode ?? null}
        initialInstanceName={instancia?.instanceName ?? null}
        initialMensagens={mensagens}
        role={dentista.role}
        clinicaNome={dentista.clinica}
      />
    </PageTransition>
  );
}
