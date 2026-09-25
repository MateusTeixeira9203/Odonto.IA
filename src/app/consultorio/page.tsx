import { format } from 'date-fns';
import { redirect } from 'next/navigation';

import { ClinicOverviewPanel } from '@/components/consultorio/clinic-overview-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicOverview } from '@/server/consultorio/overview';
import { getClinicFinancial } from '@/server/financeiro/clinica';
import { getClinicFinancialActions } from '@/server/financeiro/acoes-clinica';
import { getClinicTeam } from '@/server/consultorio/team';
import { getOperationalWhatsAppTemplates } from '@/server/consultorio/whatsapp-templates';

export default async function ConsultorioPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio');
  const operationalOnly = context.data.member.role === 'secretaria';
  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const [financeiro, overview, whatsappTemplates, actions, team] = await Promise.all([
    operationalOnly ? Promise.resolve(null) : getClinicFinancial({ clinicaIdEsperada: context.data.member.clinicaId, mes }),
    getClinicOverview(context.data.member.clinicaId, mes),
    getOperationalWhatsAppTemplates(context.data.member.clinicaId),
    operationalOnly ? getClinicFinancialActions(context.data.member.clinicaId) : Promise.resolve(null),
    operationalOnly ? getClinicTeam(context.data.member.clinicaId) : Promise.resolve(null),
  ]);
  return <ClinicOverviewPanel basePath={context.data.basePath} operationalOnly={operationalOnly} financeiro={financeiro?.ok ? financeiro.data : null} overview={overview.ok ? overview.data : null} whatsappTemplates={whatsappTemplates} nomeClinica={context.data.nomeClinica} canRegisterIncome={actions?.ok ? actions.data.podeRegistrarEntrada : false} canRegisterCost={actions?.ok ? actions.data.podeRegistrarCusto : false} professionals={team?.ok ? team.data.flatMap((member) => member.atuaClinicamente && member.dentistaId ? [{ id: member.dentistaId, nome: member.nome }] : []) : []} mensagem={financeiro && !financeiro.ok ? financeiro.mensagem : !overview.ok ? overview.mensagem : undefined} />;
}
