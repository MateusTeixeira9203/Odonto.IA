import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import { ClinicFinancePanel } from '@/components/consultorio/clinic-finance-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';

export const metadata = { title: 'Financeiro da clínica · Odonto.IA' };

export default async function NonClinicalClinicFinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/financeiro-clinica');

  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const financeiro = await getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes });

  return <PageTransition><PageContainer variant="wide"><ClinicFinancePanel
    basePath={context.data.basePath}
    nomeClinica={context.data.nomeClinica}
    title={context.data.titulo}
    hasPersonalFinance={false}
    mes={mes}
    data={financeiro.ok ? financeiro.data : null}
    mensagem={financeiro.ok ? undefined : financeiro.mensagem}
  /></PageContainer></PageTransition>;
}
