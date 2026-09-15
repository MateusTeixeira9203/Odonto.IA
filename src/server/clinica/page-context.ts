import { notFound, redirect } from 'next/navigation';
import { getMemberContext } from '@/server/auth/member-context';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { requireUser } from '@/server/auth/user';
import { obterContextoClinica } from './operations';
export async function requireOwnerWorkspace() {
  if (!isTeamWorkspaceEnabled()) notFound();
  const { supabase, user } = await requireUser();
  const member = await getMemberContext();
  if (!member.ok) {
    if (member.codigo === 'INDISPONIVEL') throw new Error(member.mensagem);
    notFound();
  }
  const context = await obterContextoClinica({ clinicaIdEsperada: member.data.clinicaId });
  if (!context.ok) {
    if (context.codigo === 'INDISPONIVEL') throw new Error(context.mensagem);
    notFound();
  }
  if (!context.data.proprietario) notFound();
  if (process.env.LEGAL_ACCEPTS_ENABLED === 'true') {
    const { data, error } = await supabase.from('aceites_termos').select('id').eq('usuario_id', user.id).eq('versao', '1.0-draft').maybeSingle();
    if (error) throw new Error('Não foi possível verificar o aceite dos termos.');
    if (!data) redirect('/termos-de-uso?next=%2Fclinica');
  }
  return { context: context.data, member: member.data, user };
}
