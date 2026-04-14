'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';

// ── Trial: 7 dias grátis no Plano Clínica ───────────────────────────────────

export async function activateTrial(): Promise<{ error?: string }> {
  // 1. Sessão do usuário
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[activateTrial] Usuário não autenticado:', authError?.message);
    redirect('/login?next=/planos');
  }

  const service = createServiceClient();

  // 2. Busca o dentista para obter clinica_id
  const { data: dentista, error: dentistaError } = await service
    .from('dentistas')
    .select('clinica_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (dentistaError) {
    console.error('[activateTrial] Erro ao buscar dentista:', {
      message: dentistaError.message,
      code: dentistaError.code,
      details: dentistaError.details,
      hint: dentistaError.hint,
    });
    return { error: 'Não foi possível identificar sua conta. Tente recarregar a página.' };
  }

  if (!dentista) {
    console.error('[activateTrial] Dentista não encontrado para user_id:', user.id);
    redirect('/onboarding');
  }

  // 3. Lê o estado atual da clínica
  const { data: clinica, error: clinicaError } = await service
    .from('clinicas')
    .select('status_assinatura, trial_ends_at')
    .eq('id', dentista.clinica_id)
    .maybeSingle();

  if (clinicaError) {
    console.error('[activateTrial] Erro ao buscar clínica:', {
      message: clinicaError.message,
      code: clinicaError.code,
      details: clinicaError.details,
      hint: clinicaError.hint,
    });
    return { error: 'Erro ao verificar o estado da assinatura. Tente novamente.' };
  }

  if (!clinica) {
    console.error('[activateTrial] Clínica não encontrada para id:', dentista.clinica_id);
    return { error: 'Clínica não encontrada. Contate o suporte.' };
  }

  // 4. Guardas de negócio
  if (clinica.status_assinatura === 'ativo') {
    return { error: 'Você já possui uma assinatura ativa.' };
  }

  if (clinica.trial_ends_at) {
    return { error: 'O período de trial já foi utilizado nesta conta.' };
  }

  // 5. Ativa o trial de 7 dias
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  const { error: updateError } = await service
    .from('clinicas')
    .update({
      plano: 'CLINICA',
      status_assinatura: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .eq('id', dentista.clinica_id);

  if (updateError) {
    console.error('[activateTrial] Erro ao atualizar clínica:', {
      message: updateError.message,
      code: updateError.code,
      details: updateError.details,
      hint: updateError.hint,
    });
    return {
      error: `Erro ao ativar o trial: ${updateError.message}. Se o problema persistir, contate o suporte.`,
    };
  }

  console.log(
    `[activateTrial] Trial ativado com sucesso — clinica_id=${dentista.clinica_id}, expira em ${trialEndsAt.toISOString()}`,
  );

  redirect('/dashboard?status=trial_activated');
}

// ── Checkout via Abacate Pay ────────────────────────────────────────────────

const PLANO_PRODUCT_IDS: Record<string, string> = {
  SOLO: process.env.ABACATE_PAY_PRODUCT_SOLO ?? '',
  BASICO: process.env.ABACATE_PAY_PRODUCT_BASICO ?? '',
  CLINICA: process.env.ABACATE_PAY_PRODUCT_CLINICA ?? '',
};

export async function createCheckout(
  planoId: 'SOLO' | 'BASICO' | 'CLINICA',
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { url: `/login?next=/planos` };
  }

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
        returnUrl: `${appUrl}/dashboard?status=success`,
        completionUrl: `${appUrl}/dashboard?status=success`,
        customer: {
          email: user.email,
          metadata: { userId: user.id, plano: planoId },
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
