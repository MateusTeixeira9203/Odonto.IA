import { getMemberContext } from '@/server/auth/member-context';
import { obterContextoClinica } from '@/server/clinica/operations';
import { ClinicaNavigation } from '@/components/clinica/clinica-navigation';
import type { ReactNode } from 'react';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';
import { ConsultorioNavigation } from './_components/consultorio-navigation';

export default async function ConsultorioLayout({ children }: { children: ReactNode }) {
  await requirePersonalConsultorio();
  const member = await getMemberContext();
  const owner = member.ok ? await obterContextoClinica({ clinicaIdEsperada: member.data.clinicaId }) : null;
  return <>{owner?.ok && owner.data.proprietario ? <ClinicaNavigation podeAtender nome={owner.data.nome} /> : <ConsultorioNavigation />}{children}</>;
}
