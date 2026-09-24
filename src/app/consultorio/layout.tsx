import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ClinicHubLayout } from '@/components/consultorio/clinic-hub-layout';
import { getClinicHubContext } from '@/server/consultorio/context';

export default async function ConsultorioLayout({ children }: { children: ReactNode }): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio');
  return <ClinicHubLayout context={context.data}>{children}</ClinicHubLayout>;
}
