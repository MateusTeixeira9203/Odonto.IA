import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { listarConversas } from './actions';
import { WhatsAppClient } from './_components/whatsapp-client';

export default async function WhatsAppPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Apenas secretária acessa conversas; admin e dentista vão para suas rotas
  if (dentista.role === 'admin') redirect('/dashboard/bot');
  if (dentista.role === 'dentista') redirect('/dashboard');
  if (dentista.role !== 'secretaria') redirect('/dashboard');

  const conversas = await listarConversas();

  return (
    <WhatsAppClient
      initialConversas={conversas}
      clinicaId={dentista.clinica_id}
    />
  );
}
