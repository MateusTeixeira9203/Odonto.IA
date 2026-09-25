import { redirect } from 'next/navigation';
import { format } from 'date-fns';

import { ClinicFinancePanelV2 } from '@/components/consultorio/clinic-finance-panel-v2';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicFinancial } from '@/server/financeiro/clinica';
import { getClinicFinancialActions } from '@/server/financeiro/acoes-clinica';
import { getClinicRepasses } from '@/server/financeiro/repasses';
import { getClinicTeam } from '@/server/consultorio/team';

export const metadata = { title: 'Financeiro da clínica · Odonto.IA' };

export default async function NonClinicalClinicFinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/financeiro-clinica');
  if (context.data.member.role === 'secretaria') redirect('/consultorio');

  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const [financeiro, repasses, team, actions] = await Promise.all([
    getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicRepasses({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicTeam(context.data.member.clinicaId),
    getClinicFinancialActions(context.data.member.clinicaId),
  ]);

  const canManageRepasses = repasses?.ok === true && repasses.data.podeGerir;
  return <ClinicFinancePanelV2
    basePath={context.data.basePath}
    canRegisterIncome={actions.ok ? actions.data.podeRegistrarEntrada : false}
    canRegisterCost={actions.ok ? actions.data.podeRegistrarCusto : false}
    repasses={repasses?.ok ? repasses.data : null}
    canManageRepasses={canManageRepasses}
    operationalOnly={false}
    professionals={team.ok ? team.data.flatMap((member) => member.atuaClinicamente && member.dentistaId ? [{ id: member.dentistaId, nome: member.nome }] : []) : []}
    data={financeiro?.ok ? financeiro.data : null}
    mensagem={financeiro?.ok ? undefined : financeiro?.mensagem}
  />;
}
