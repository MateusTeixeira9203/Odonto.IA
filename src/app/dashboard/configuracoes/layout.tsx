import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';

/**
 * Secretárias não têm acesso às configurações da clínica.
 * Configurações são exclusivas de admin e dentistas.
 */
export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  return <>{children}</>;
}
