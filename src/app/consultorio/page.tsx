import { format } from 'date-fns';
import { redirect } from 'next/navigation';

import { ClinicOverviewPanel } from '@/components/consultorio/clinic-overview-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicOverview } from '@/server/consultorio/overview';
import { getClinicFinancial } from '@/server/financeiro/clinica';

export default async function ConsultorioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio');
  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const [financeiro, overview] = await Promise.all([
    getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicOverview(context.data.member.clinicaId, mes),
  ]);
  return <ClinicOverviewPanel basePath={context.data.basePath} financeiro={financeiro.ok ? financeiro.data : null} overview={overview.ok ? overview.data : null} mensagem={!financeiro.ok ? financeiro.mensagem : !overview.ok ? overview.mensagem : undefined} />;
}
