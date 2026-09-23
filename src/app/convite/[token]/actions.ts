'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aceitarConvite } from '@/server/services/invites';
import { acceptGovernanceInvite } from '@/server/services/governance-invites';

export async function aceitarConviteAction(
  token: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: 'Você precisa estar autenticado para aceitar o convite.' };
  }

  const result = await aceitarConvite(token, user.id, user.email);

  if (!result.ok) {
    return { error: result.error };
  }

  // Só o dentista que realmente precisa cadastrar cartão entra na tela de cobrança.
  // Clínica isenta cria vínculo ativo e segue pelo onboarding normal.
  if (result.exigeCheckout) {
    redirect(`/bem-vindo-agregado?clinica=${result.clinicId}`);
  }

  redirect(result.role === 'dentista' ? '/onboarding' : '/dashboard');
}

export async function aceitarConviteGovernancaAction(input: {
  token: string;
  cro: string | null;
  especialidade: string[];
}): Promise<{ error?: string }> {
  const result = await acceptGovernanceInvite(input);
  if (!result.ok) return { error: result.error };
  redirect(result.role === 'gestor' ? '/consultorio' : '/dashboard');
}
