import { OnboardingClient } from './_components/onboarding-client';
import type { PlanoClinica } from './actions';

const PLANOS_VALIDOS: PlanoClinica[] = ['SOLO', 'CLINICA'];

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: { plano?: string };
}): React.JSX.Element {
  const plano = PLANOS_VALIDOS.includes(searchParams.plano as PlanoClinica)
    ? (searchParams.plano as PlanoClinica)
    : 'CLINICA';

  return <OnboardingClient plano={plano} />;
}
