import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { ClinicFinancePanel } from '@/components/consultorio/clinic-finance-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';
import { getClinicRepasses } from '@/server/financeiro/repasses';

export const metadata = { title: 'Financeiro da clínica · Odonto.IA' };

export default async function NonClinicalClinicFinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/financeiro-clinica');

  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const [financeiro, repasses] = await Promise.all([
    getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicRepasses({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
  ]);

  const canWrite = context.data.governanca?.modalidade === 'gerida' && (
    context.data.member.role === 'secretaria'
    || context.data.member.role === 'admin'
    || context.data.governanca.papeis.some((role) => role === 'proprietario' || role === 'gestor')
  );
  const canManageRepasses = repasses.ok && repasses.data.podeGerir;
  return <ClinicFinancePanel
    basePath={context.data.basePath}
    canWrite={canWrite}
    repasses={repasses.ok ? repasses.data : null}
    canManageRepasses={canManageRepasses}
    data={financeiro.ok ? financeiro.data : null}
    mensagem={financeiro.ok ? undefined : financeiro.mensagem}
  />;
}
