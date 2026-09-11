import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/user';
import { getMemberContext } from '@/server/auth/member-context';
import { listTeam } from '@/server/auth/list-team';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { loadTeamPage } from './actions';
import { TeamWorkspace } from './_components/team-workspace';

export const metadata = { title: 'Equipe · Odonto.IA' };

export default async function TeamPage() {
  if (!isTeamWorkspaceEnabled()) notFound();
  await requireUser();
  const context = await getMemberContext();
  const result = context.ok
    ? await listTeam({ clinicaIdEsperada: context.data.clinicaId })
    : context;

  return (
    <TeamWorkspace
      key={context.ok ? context.data.clinicaId : 'sem-acesso'}
      initialResult={result}
      canAttend={context.ok && context.data.perfilClinico !== null}
      loadPage={loadTeamPage}
    />
  );
}
