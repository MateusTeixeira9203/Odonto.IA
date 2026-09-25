import { redirect } from 'next/navigation';

import { OperationalWhatsAppSettings } from '@/app/dashboard/configuracoes/_components/operational-whatsapp-settings';
import { getGovernanceContext } from '@/server/auth/governance-context';
import { getClinicHubContext } from '@/server/consultorio/context';
import { getOperationalWhatsAppTemplates } from '@/server/consultorio/whatsapp-templates';

export const metadata = { title: 'Configurações · Minha Clínica · Odonto.IA' };

export default async function NonClinicalSettingsPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/configuracoes');

  const governance = await getGovernanceContext(context.data.member.clinicaId);
  const canManage = governance.ok && governance.data.papeis.some((papel) => papel === 'proprietario' || papel === 'gestor');
  if (!canManage) redirect('/consultorio');

  const templates = await getOperationalWhatsAppTemplates(context.data.member.clinicaId);
  return <div className="space-y-6"><header><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Configurações</p><h2 className="mt-1 font-heading text-3xl font-normal text-foreground">Mensagens da clínica</h2><p className="mt-2 text-sm text-muted-foreground">Defina os textos que a operação prepara no WhatsApp.</p></header><OperationalWhatsAppSettings templates={templates} /></div>;
}
