import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  return (
    <DashboardShell nome={dentista.nome} clinicaNome={dentista.clinica}>
      {children}
    </DashboardShell>
  );
}
