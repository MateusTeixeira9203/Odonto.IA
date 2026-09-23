import { redirect } from 'next/navigation';
import { OnboardingClient, type OnboardingStep } from './_components/onboarding-client';
import { getDentistaCached } from '@/lib/get-dentista';
import { getMemberContext } from '@/server/auth/member-context';

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const member = await getMemberContext();
  if (member.ok && !member.data.perfilClinico) redirect('/consultorio');

  const dentista = await getDentistaCached();

  // R-170b: Dex deixa de fazer parte da passagem inicial. Quem já possui perfil clínico
  // entrou por um fluxo anterior e não deve recriar clínica ao visitar esta rota.
  if (dentista) redirect('/dashboard');
  const initialStep: OnboardingStep = 'modalidade';

  return (
    <OnboardingClient initialStep={initialStep} />
  );
}
