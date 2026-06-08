import { CadastroForm } from './_components/cadastro-form';
import type { PlanoClinica } from '@/app/onboarding/actions';

const PLANOS_VALIDOS: PlanoClinica[] = ['SOLO', 'CLINICA'];

export default function CadastroPage({
  searchParams,
}: {
  searchParams: { plano?: string };
}): React.JSX.Element {
  const plano = PLANOS_VALIDOS.includes(searchParams.plano as PlanoClinica)
    ? (searchParams.plano as PlanoClinica)
    : 'CLINICA';

  return <CadastroForm plano={plano} />;
}
