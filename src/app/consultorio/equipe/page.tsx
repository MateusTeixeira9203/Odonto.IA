import { redirect } from 'next/navigation';

import { ClinicTeamPanel } from '@/components/consultorio/clinic-team-panel';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getClinicTeam } from '@/server/consultorio/team';

export default async function NonClinicalTeamPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/equipe');
  const team = await getClinicTeam(context.data.member.clinicaId);
  const canInvite = context.data.governanca?.papeis.includes('proprietario') === true;
  return <ClinicTeamPanel members={team.ok ? team.data : []} canInvite={canInvite} message={team.ok ? undefined : team.mensagem} />;
}
