import { notFound, redirect } from 'next/navigation';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { getMemberContext } from '@/server/auth/member-context';
import { PendenciasClient } from '@/components/pendencias/pendencias-client';
export const metadata = { title: 'Pendências · Odonto.IA' };
export default async function PendenciasPage() {
  if (!isTeamWorkspaceEnabled()) notFound();
  const member = await getMemberContext();
  if (!member.ok) redirect('/login');
  if (member.data.role === 'protetico') notFound();
  return <PendenciasClient clinicaId={member.data.clinicaId} />;
}
