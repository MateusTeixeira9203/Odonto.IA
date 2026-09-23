import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import { ClinicOverviewPanel } from '@/components/consultorio/clinic-overview-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';

export default async function MeuConsultorioPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (!context.data.member.perfilClinico) redirect('/consultorio');
  const financeiro = await getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes: format(new Date(), 'yyyy-MM') });
  return <PageTransition><PageContainer variant="wide"><ClinicOverviewPanel basePath={context.data.basePath} nomeClinica={context.data.nomeClinica} title={context.data.titulo} hasPersonalFinance financeiro={financeiro.ok ? financeiro.data : null} mensagem={financeiro.ok ? undefined : financeiro.mensagem} /></PageContainer></PageTransition>;
}
