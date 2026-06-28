import { OnboardingClient, type OnboardingStep } from './_components/onboarding-client';
import { getDentistaCached } from '@/lib/get-dentista';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const dentista = await getDentistaCached();

  // Resume no passo 'plano' (volta da demo) só se já existe dentista — senão começa do início.
  const initialStep: OnboardingStep =
    params.step === 'plano' && dentista ? 'plano' : 'identidade';

  return (
    <OnboardingClient
      initialStep={initialStep}
      focoInicial={dentista?.foco_principal ?? null}
      nomeInicial={dentista?.nome ? dentista.nome.split(' ')[0] : ''}
    />
  );
}
