import { redirect } from 'next/navigation';

import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import { getClinicHubContext } from '@/server/consultorio/context';

export default async function NonClinicalTeamPage(): Promise<React.JSX.Element> {
  const context = await getClinicHubContext();
  if (!context.ok) redirect('/onboarding');
  if (context.data.member.perfilClinico) redirect('/dashboard/meu-consultorio/equipe');

  return <PageTransition><PageContainer variant="comfortable"><section className="rounded-xl border border-border bg-surface p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Minha clínica</p><h1 className="mt-2 font-heading text-3xl text-text-primary">Minha equipe</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">O fluxo de convites já existe. A portabilidade da tela de equipe para o proprietário não clínico será concluída junto com a revisão dos convites, para não criar duas fontes de verdade.</p></section></PageContainer></PageTransition>;
}
