import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth/user';
import { getMemberContext } from '@/server/auth/member-context';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { getStockAccessContext } from './access';

export async function getStockPageContext() {
  if (!isTeamWorkspaceEnabled()) notFound();
  await requireUser();
  const member = await getMemberContext();
  if (!member.ok) return member;
  return getStockAccessContext({ clinicaIdEsperada: member.data.clinicaId });
}
