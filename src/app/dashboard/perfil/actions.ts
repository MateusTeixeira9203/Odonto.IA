'use server';

import { requireUser } from '@/server/auth/user';
import { requireClinicContext } from '@/server/auth/clinic';
import { revalidatePath } from 'next/cache';

export async function salvarAvatarUrl(avatarUrl: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('dentistas')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', user.id);

  if (error) return { error: 'Erro ao salvar avatar.' };

  revalidatePath('/dashboard', 'layout');
  return {};
}

export async function removerAvatar(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('dentistas')
    .update({ avatar_url: null })
    .eq('user_id', user.id);

  if (error) return { error: 'Erro ao remover avatar.' };

  revalidatePath('/dashboard', 'layout');
  return {};
}

export interface PerfilData {
  nome: string;
  telefone: string;
  cro: string;
  especialidade: string;
  cpf: string;
  chavePix: string;
}

export async function salvarPerfil(data: PerfilData): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('dentistas')
    .update({
      nome:          data.nome          || null,
      telefone:      data.telefone      || null,
      cro:           data.cro           || null,
      especialidade: data.especialidade || null,
      cpf:           data.cpf           || null,
      chave_pix:     data.chavePix      || null,
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Erro ao salvar perfil:', error);
    return { error: 'Erro ao salvar. Tente novamente.' };
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/perfil');
  return {};
}

export async function salvarNomeClinica(nome: string): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role !== 'admin') return { error: 'Sem permissão.' };

  const { error } = await supabase
    .from('clinicas')
    .update({ nome })
    .eq('id', clinicId);

  if (error) {
    console.error('Erro ao salvar nome da clínica:', error);
    return { error: 'Erro ao salvar nome da clínica.' };
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/perfil');
  return {};
}
