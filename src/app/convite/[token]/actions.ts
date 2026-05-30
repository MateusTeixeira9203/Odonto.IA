'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aceitarConvite } from '@/server/services/invites';

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

  redirect('/dashboard');
}
