import { redirect } from 'next/navigation';

import { ClinicTeamPanel } from '@/components/consultorio/clinic-team-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicTeam } from '@/server/consultorio/team';
import { format } from 'date-fns';
import { getClinicRepasses } from '@/server/financeiro/repasses';

export default async function NonClinicalTeamPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/equipe');
  const [team, repasses] = await Promise.all([
    getClinicTeam(context.data.member.clinicaId),
    getClinicRepasses({ clinicaIdEsperada: context.data.member.clinicaId, mes: format(new Date(), 'yyyy-MM') }),
  ]);
  const canInvite = context.data.governanca?.papeis.includes('proprietario') === true;
  return <ClinicTeamPanel members={team.ok ? team.data : []} canInvite={canInvite} repasses={repasses.ok ? repasses.data : null} message={team.ok ? undefined : team.mensagem} />;
}
