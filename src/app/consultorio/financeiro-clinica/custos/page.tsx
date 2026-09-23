import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import { FixedCostsPage } from '@/components/consultorio/fixed-costs-page';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';

export const metadata = { title: 'Custos fixos · Odonto.IA' };

export default async function NonClinicalFixedCostsPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/financeiro-clinica/custos');
  const financeiro = await getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes: format(new Date(), 'yyyy-MM') });
  return <PageTransition><PageContainer variant="comfortable"><FixedCostsPage basePath={context.data.basePath} data={financeiro.ok ? financeiro.data : null} mensagem={financeiro.ok ? undefined : financeiro.mensagem} /></PageContainer></PageTransition>;
}
