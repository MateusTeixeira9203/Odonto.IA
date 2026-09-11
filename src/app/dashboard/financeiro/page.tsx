import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { FinanceiroContent } from './_components/financeiro-content';
import { mesValido } from '@/lib/financeiro/calculos';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

interface PageProps {
  searchParams: Promise<{ mes?: string; dentista?: string }>;
}

export default async function LegacyFinanceiroPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  if (isTeamWorkspaceEnabled() && (dentista.role === 'admin' || dentista.role === 'dentista')) {
    const { mes } = await searchParams;
    const destino = mes && mesValido(mes)
      ? `/dashboard/meu-consultorio/financeiro?mes=${mes}`
      : '/dashboard/meu-consultorio/financeiro';
    redirect(destino);
  }

  return <FinanceiroContent searchParamsPromise={searchParams} />;
}
