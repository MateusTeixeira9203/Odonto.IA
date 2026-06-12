import { OnboardingClient } from './_components/onboarding-client';
import type { PlanoClinica } from './actions';

const PLANOS_VALIDOS: PlanoClinica[] = ['SOLO', 'CLINICA'];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const plano = PLANOS_VALIDOS.includes(params.plano as PlanoClinica)
    ? (params.plano as PlanoClinica)
    : 'SOLO';

  return <OnboardingClient plano={plano} />;
}
