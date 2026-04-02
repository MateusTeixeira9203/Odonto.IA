'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Salva a URL do avatar do dentista autenticado.
 */
export async function salvarAvatarUrl(avatarUrl: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { error: 'Sessão inválida.' };

  const { error } = await supabase
    .from('dentistas')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', user.id);

  if (error) return { error: 'Erro ao salvar avatar.' };

  revalidatePath('/dashboard', 'layout');
  return {};
}

/**
 * Remove o avatar do dentista autenticado.
 */
export async function removerAvatar(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { error: 'Sessão inválida.' };

  const { error } = await supabase
    .from('dentistas')
    .update({ avatar_url: null })
    .eq('user_id', user.id);

  if (error) return { error: 'Erro ao remover avatar.' };

  revalidatePath('/dashboard', 'layout');
  return {};
}
