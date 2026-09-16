import { redirect } from 'next/navigation';
import { getMemberContext } from '@/server/auth/member-context';
import { getReceptionContext } from '@/server/auth/reception-context';
import { hasRecebimentosOperationalAccess } from '@/server/auth/operational-access';
import { listarRecebimentosOperacionais } from '@/server/financeiro/recebimentos-reader';
import { RecebimentosOperacionaisClient } from './recebimentos-client';
export default async function RecebimentosPage() {
  const member = await getMemberContext();
  if (!member.ok) {
    if (member.codigo === 'INDISPONIVEL') throw new Error(member.mensagem);
    redirect('/login');
  }

  const reception = await getReceptionContext();
  if (reception.ok && !await hasRecebimentosOperationalAccess(member.data.clinicaId)) {
    redirect('/dashboard/agendamentos');
  }

  const resultado = await listarRecebimentosOperacionais({ clinicaIdEsperada: member.data.clinicaId });
  if (!resultado.ok) throw new Error(resultado.mensagem);
  return <RecebimentosOperacionaisClient clinicaId={member.data.clinicaId} initialPage={resultado.data} />;
}
