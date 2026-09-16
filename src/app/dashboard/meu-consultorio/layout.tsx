import { getMemberContext } from '@/server/auth/member-context';
import { obterContextoClinica } from '@/server/clinica/operations';
import { ClinicaNavigation } from '@/components/clinica/clinica-navigation';
import type { ReactNode } from 'react';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';
import { ConsultorioNavigation } from './_components/consultorio-navigation';
import { hasRecebimentosOperationalAccess } from '@/server/auth/operational-access';

export default async function ConsultorioLayout({ children }: { children: ReactNode }) {
  await requirePersonalConsultorio();
  const member = await getMemberContext();
  const owner = member.ok ? await obterContextoClinica({ clinicaIdEsperada: member.data.clinicaId }) : null;
  const podeReceber = member.ok && (member.data.perfilClinico !== null || await hasRecebimentosOperationalAccess(member.data.clinicaId));
  return <>{owner?.ok && owner.data.proprietario ? <ClinicaNavigation podeAtender podeReceber={podeReceber} nome={owner.data.nome} /> : <ConsultorioNavigation />}{children}</>;
}
