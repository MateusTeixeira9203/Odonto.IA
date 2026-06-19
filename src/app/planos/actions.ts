'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';

export async function activateTrial(): Promise<{ error?: string }> {
  // requireClinicContext resolve clinicId via users.active_clinica_id + clinica_usuarios.
  // Nenhuma dependência de dentistas.maybeSingle().
  const { clinicId } = await requireClinicContext();

  const service = createServiceClient();

  const { data: clinica, error: clinicaError } = await service
    .from('clinicas')
    .select('status_assinatura, trial_ends_at')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinicaError) {
    console.error('[activateTrial] Erro ao buscar clínica:', {
      message: clinicaError.message,
      code:    clinicaError.code,
    });
    return { error: 'Erro ao verificar o estado da assinatura. Tente novamente.' };
  }

  if (!clinica) {
    console.error('[activateTrial] Clínica não encontrada:', clinicId);
    return { error: 'Clínica não encontrada. Contate o suporte.' };
  }

  if (clinica.status_assinatura === 'ativo') {
    return { error: 'Você já possui uma assinatura ativa.' };
  }

  if (clinica.trial_ends_at) {
    return { error: 'O período de trial já foi utilizado nesta conta.' };
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const { error: updateError } = await service
    .from('clinicas')
    .update({
      plano:             'CLINICA',
      status_assinatura: 'trial',
      trial_ends_at:     trialEndsAt.toISOString(),
    })
    .eq('id', clinicId);

  if (updateError) {
    console.error('[activateTrial] Erro ao atualizar clínica:', {
      message: updateError.message,
      code:    updateError.code,
    });
    return { error: 'Erro ao ativar o trial. Se o problema persistir, contate o suporte.' };
  }

  console.log(`[activateTrial] Trial ativado — clinica_id=${clinicId}, expira em ${trialEndsAt.toISOString()}`);
  redirect('/dashboard?status=trial_activated');
}

const PLANO_PRODUCT_IDS: Record<string, string> = {
  SOLO:    process.env.ABACATE_PAY_PRODUCT_SOLO ?? '',
  CLINICA: process.env.ABACATE_PAY_PRODUCT_CLINICA ?? '',
};

export async function createCheckout(
  planoId: 'SOLO' | 'CLINICA',
): Promise<{ url?: string; error?: string }> {
  // clinicId é emitido no metadata para que o webhook resolva a clínica
  // de forma determinística (payment-time reference), independente de qual
  // clínica o usuário tenha ativa quando o webhook for processado.
  const { user, clinicId } = await requireClinicContext();

  const apiKey = process.env.ABACATE_PAY_API_KEY;
  if (!apiKey) {
    return { error: 'Configuração de pagamento indisponível. Contate o suporte.' };
  }

  const productId = PLANO_PRODUCT_IDS[planoId];
  if (!productId) {
    return { error: `Produto do plano ${planoId} não configurado.` };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dentia.app.br';

  try {
    const res = await fetch('https://api.abacatepay.com/v1/billing/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frequency: 'MONTHLY',
        methods: ['PIX', 'CREDIT_CARD'],
        products: [{ externalId: productId, quantity: 1 }],
        returnUrl:    `${appUrl}/dashboard?status=success`,
        completionUrl: `${appUrl}/dashboard?status=success`,
        customer: {
          email:    user.email,
          metadata: { userId: user.id, clinicId, plano: planoId },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[createCheckout] Abacate Pay erro HTTP:', res.status, body);
      return { error: 'Erro ao criar link de pagamento. Tente novamente.' };
    }

    const json = (await res.json()) as { data?: { url?: string } };
    const checkoutUrl = json.data?.url;

    if (!checkoutUrl) {
      console.error('[createCheckout] Resposta sem URL:', json);
      return { error: 'Resposta inválida do gateway de pagamento.' };
    }

    return { url: checkoutUrl };
  } catch (err) {
    console.error('[createCheckout] Erro de conexão:', err);
    return { error: 'Falha de conexão com o gateway de pagamento.' };
  }
}
