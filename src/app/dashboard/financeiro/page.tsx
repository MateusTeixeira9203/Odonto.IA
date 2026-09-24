import { redirect } from 'next/navigation';

import { getDentistaCached } from '@/lib/get-dentista';

/** Compatibilidade para links antigos: o financeiro agora vive no hub de gestão. */
export default async function FinanceiroPage(): Promise<never> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role === 'secretaria') redirect('/consultorio/financeiro-clinica');
  redirect('/dashboard/meu-consultorio/meu-financeiro');
}
