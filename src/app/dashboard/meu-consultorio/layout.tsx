import type { ReactNode } from 'react';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';
import { ConsultorioNavigation } from './_components/consultorio-navigation';

export default async function ConsultorioLayout({ children }: { children: ReactNode }) {
  await requirePersonalConsultorio();
  return <><ConsultorioNavigation />{children}</>;
}
