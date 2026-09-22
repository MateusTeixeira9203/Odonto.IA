import { redirect } from 'next/navigation';
import { OnboardingClient, type OnboardingStep } from './_components/onboarding-client';
import { getDentistaCached } from '@/lib/get-dentista';
import { getMemberContext } from '@/server/auth/member-context';
import { conferirRetornoCheckout } from '@/app/checkout/retorno/actions';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; checkout?: string }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const member = await getMemberContext();
  if (member.ok && !member.data.perfilClinico) redirect('/consultorio');

  const dentista = await getDentistaCached();

  const billingAtivo = process.env.STRIPE_BILLING_ENABLED === 'true';
  const retorno = billingAtivo && params.step === 'dex' && params.checkout === 'confirmed'
    ? await conferirRetornoCheckout()
    : null;
  const checkoutConfirmado = retorno?.estado === 'confirmado';
  const clinicaIsenta = Boolean(dentista && clinicaIsentaDeCobranca(dentista.clinica_id));

  // Com cobrança ligada, existir dentista só prova que a identidade foi criada. A entrada
  // no Dex depende da assinatura já sincronizada no banco, nunca de query string do browser.
  if (dentista && billingAtivo && !checkoutConfirmado && !clinicaIsenta) {
    redirect('/planos?onboarding=1');
  }

  // Resume no passo 'plano' (volta da demo) só se já existe dentista — senão começa do início.
  const initialStep: OnboardingStep = dentista && (!billingAtivo || checkoutConfirmado || clinicaIsenta)
    ? 'dex'
    : 'modalidade';

  return (
    <OnboardingClient initialStep={initialStep} />
  );
}
