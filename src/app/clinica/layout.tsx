import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ClinicaNavigation } from '@/components/clinica/clinica-navigation';
import { requireOwnerWorkspace } from '@/server/clinica/page-context';
export const metadata = { title: 'Clínica · Odonto.IA' };
export default async function ClinicaLayout({ children }: { children: ReactNode }) {
  const { context, member, user } = await requireOwnerWorkspace();
  return <DashboardShell nome={user.email?.split('@')[0] ?? 'Proprietário'} clinicaNome={context.nome} activeClinicId={context.clinicaId} role={member.role} clinicaOwnerEnabled managementOnly={!context.dentistaId} consultorioPessoalEnabled={Boolean(context.dentistaId)} pendenciasEnabled={Boolean(context.dentistaId)}>
    <ClinicaNavigation podeAtender={Boolean(context.dentistaId)} nome={context.nome} />{children}
  </DashboardShell>;
}
