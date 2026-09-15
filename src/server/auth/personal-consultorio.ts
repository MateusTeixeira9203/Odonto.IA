import { notFound } from 'next/navigation';
import { requireClinicContext } from './clinic';
import { getMemberContext } from './member-context';
import { isTeamWorkspaceEnabled } from './team-workspace-pilot';

/** Entrada pessoal do piloto; não concede gestão da unidade ou acesso operacional. */
export async function requirePersonalConsultorio(): Promise<void> {
  if (!isTeamWorkspaceEnabled()) notFound();
  const context = await requireClinicContext();
  if (context.role !== 'admin' && context.role !== 'dentista') notFound();

  const member = await getMemberContext({ clinicaIdEsperada: context.clinicId });
  if (!member.ok) {
    if (member.codigo === 'INDISPONIVEL') {
      throw new Error('Não foi possível verificar o acesso ao consultório. Tente novamente.');
    }
    notFound();
  }
  if (member.data.perfilClinico?.dentistaId !== context.dentistaId) notFound();
}
