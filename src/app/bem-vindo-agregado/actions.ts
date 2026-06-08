'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Cria um checkout Abacate Pay para a taxa de Dentista Agregado (R$147/mês).
 * O produto deve ser configurado em ABACATE_PAY_PRODUCT_AGREGADO.
 */
export async function createCheckoutAgregado(input: {
  userEmail: string;
}): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const apiKey = process.env.ABACATE_PAY_API_KEY;
  if (!apiKey) {
    return { error: 'Configuração de pagamento indisponível. Contate o suporte.' };
  }

  const productId = process.env.ABACATE_PAY_PRODUCT_AGREGADO;
  if (!productId) {
    // Produto ainda não configurado — permite entrar mesmo sem pagar
    return { error: 'Taxa de agregado temporariamente indisponível. Entre no sistema e pague depois em Configurações.' };
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
        returnUrl:    `${appUrl}/dashboard?status=agregado_ativo`,
        completionUrl: `${appUrl}/dashboard?status=agregado_ativo`,
        customer: {
          email: input.userEmail ?? user.email,
          metadata: {
            userId:  user.id,
            plano:   'AGREGADO',
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[createCheckoutAgregado] Abacate Pay erro HTTP:', res.status, body);
      return { error: 'Erro ao criar link de pagamento. Tente novamente.' };
    }

    const json = (await res.json()) as { data?: { url?: string } };
    const checkoutUrl = json.data?.url;

    if (!checkoutUrl) {
      return { error: 'Resposta inválida do gateway de pagamento.' };
    }

    return { url: checkoutUrl };
  } catch (err) {
    console.error('[createCheckoutAgregado] Erro de conexão:', err);
    return { error: 'Falha de conexão com o gateway de pagamento.' };
  }
}
