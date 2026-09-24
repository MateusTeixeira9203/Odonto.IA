import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { ClinicFinancePanel } from '@/components/consultorio/clinic-finance-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';
import { getClinicRepasses } from '@/server/financeiro/repasses';
import { getClinicTeam } from '@/server/consultorio/team';

export const metadata = { title: 'Financeiro da clínica · Odonto.IA' };

export default async function NonClinicalClinicFinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/financeiro-clinica');

  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const operationalOnly = context.data.member.role === 'secretaria';
  const [financeiro, repasses, team] = await Promise.all([
    operationalOnly ? Promise.resolve(null) : getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    operationalOnly ? Promise.resolve(null) : getClinicRepasses({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicTeam(context.data.member.clinicaId),
  ]);

  const canWrite = context.data.governanca?.modalidade === 'gerida' && (
    context.data.member.role === 'secretaria'
    || context.data.member.role === 'admin'
    || context.data.governanca.papeis.some((role) => role === 'proprietario' || role === 'gestor')
  );
  const canManageRepasses = repasses?.ok === true && repasses.data.podeGerir;
  const canManageBalance = context.data.governanca?.papeis.some((role) => role === 'proprietario' || role === 'gestor') === true;
  return <ClinicFinancePanel
    basePath={context.data.basePath}
    canWrite={canWrite}
    canManageBalance={canManageBalance}
    repasses={repasses?.ok ? repasses.data : null}
    canManageRepasses={canManageRepasses}
    operationalOnly={operationalOnly}
    professionals={team.ok ? team.data.flatMap((member) => member.atuaClinicamente && member.dentistaId ? [{ id: member.dentistaId, nome: member.nome }] : []) : []}
    data={financeiro?.ok ? financeiro.data : null}
    mensagem={financeiro?.ok ? undefined : financeiro?.mensagem}
  />;
}
