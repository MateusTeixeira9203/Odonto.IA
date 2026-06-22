import { getResend } from '@/lib/email/resend';
import {
  onboardingD0Html,
  onboardingD1AtivoHtml,
  onboardingD1InativoHtml,
  onboardingD3Html,
  onboardingD7Html,
} from '@/lib/email/templates/onboarding';

const FROM = 'Odonto.IA <equipe@dentia.app.br>';

export async function enviarEmailD0({
  email,
  nomeDentista,
}: {
  email: string;
  nomeDentista: string;
}): Promise<void> {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: 'Você vai economizar tempo em cada consulta. Veja como.',
      html: onboardingD0Html({ nomeDentista }),
    });
  } catch (err) {
    console.error('[onboarding-email] D0 falhou:', err);
  }
}

export async function enviarEmailD1({
  email,
  nomeDentista,
  fezPrimeiraConsulta,
}: {
  email: string;
  nomeDentista: string;
  fezPrimeiraConsulta: boolean;
}): Promise<void> {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: fezPrimeiraConsulta
        ? 'Boa. Agora cadastre um paciente real.'
        : 'Isso leva 90 segundos. Veja o que acontece.',
      html: fezPrimeiraConsulta
        ? onboardingD1AtivoHtml({ nomeDentista })
        : onboardingD1InativoHtml({ nomeDentista }),
    });
  } catch (err) {
    console.error('[onboarding-email] D1 falhou:', err);
  }
}

export async function enviarEmailD3({
  email,
  nomeDentista,
}: {
  email: string;
  nomeDentista: string;
}): Promise<void> {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: 'Quanto tempo você está perdendo documentando consultas?',
      html: onboardingD3Html({ nomeDentista }),
    });
  } catch (err) {
    console.error('[onboarding-email] D3 falhou:', err);
  }
}

export async function enviarEmailD7({
  email,
  nomeDentista,
  fichasCriadas,
  dataExpiracao,
}: {
  email: string;
  nomeDentista: string;
  fichasCriadas: number;
  dataExpiracao: string;
}): Promise<void> {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Você criou ${fichasCriadas} ficha${fichasCriadas !== 1 ? 's' : ''}. Seu trial termina em 7 dias.`,
      html: onboardingD7Html({ nomeDentista, fichasCriadas, dataExpiracao }),
    });
  } catch (err) {
    console.error('[onboarding-email] D7 falhou:', err);
  }
}
