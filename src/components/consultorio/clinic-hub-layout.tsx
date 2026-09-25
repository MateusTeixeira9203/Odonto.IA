import { format } from 'date-fns';
import type { ReactNode } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import type { ClinicHubContext } from '@/server/consultorio/context';
import { ClinicHubHeader } from './clinic-hub-header';

export function ClinicHubLayout({ context, children }: { context: ClinicHubContext; children: ReactNode }): React.JSX.Element {
  const governanceRoles = context.governanca?.papeis ?? [];
  const roleLabel = governanceRoles.includes('proprietario')
    ? 'Visão do proprietário'
    : governanceRoles.includes('gestor')
      ? 'Visão do gestor'
      : context.member.role === 'secretaria'
        ? 'Visão da secretária'
        : 'Visão do dentista';

  return (
    <PageTransition>
      <PageContainer variant="wide" className="space-y-8 pb-32">
        <ClinicHubHeader
          basePath={context.basePath}
          nomeClinica={context.nomeClinica}
          hasPersonalFinance={context.member.perfilClinico !== null}
          isSecretary={context.member.role === 'secretaria'}
          roleLabel={roleLabel}
          currentMonth={format(new Date(), 'yyyy-MM')}
        />
        <main>{children}</main>
      </PageContainer>
    </PageTransition>
  );
}
