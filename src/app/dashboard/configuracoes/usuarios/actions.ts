'use server';

import { requireRole } from '@/server/auth/roles';
import { revalidatePath } from 'next/cache';
import {
  criarConvite,
  cancelarConvite,
  renovarConvite,
} from '@/server/services/invites';
import {
  criarSecretaria,
  removerMembro,
  resetarSenhaSecretaria,
} from '@/server/services/team';

function ctx(clinicId: string, userId: string, role: string) {
  return { clinicId, userId, role };
}

// ─── Convites ────────────────────────────────────────────────────────────────

export async function enviarConvite(
  email: string,
): Promise<{ ok: boolean; error?: string; link?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  const result = await criarConvite(ctx(clinicId, user.id, role), { email });
  if (!result.ok) return result;
  revalidatePath('/dashboard/configuracoes/usuarios');
  return { ok: true, link: result.link };
}

export async function cancelarConviteAction(
  conviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  const result = await cancelarConvite(ctx(clinicId, user.id, role), conviteId);
  if (result.ok) revalidatePath('/dashboard/configuracoes/usuarios');
  return result;
}

export async function renovarConviteAction(
  conviteId: string,
): Promise<{ ok: boolean; error?: string; link?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  const result = await renovarConvite(ctx(clinicId, user.id, role), conviteId);
  if (result.ok) revalidatePath('/dashboard/configuracoes/usuarios');
  return result;
}

// ─── Secretárias ─────────────────────────────────────────────────────────────

export async function criarSecretariaAction(
  nome: string,
  email: string,
  senha: string,
  telefone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  const result = await criarSecretaria(ctx(clinicId, user.id, role), { nome, email, senha, telefone });
  if (result.ok) revalidatePath('/dashboard/configuracoes/usuarios');
  return result;
}

export async function resetarSenhaSecretariaAction(
  secretariaUserId: string,
): Promise<{ ok: boolean; error?: string; senhaTemporaria?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  return resetarSenhaSecretaria(ctx(clinicId, user.id, role), secretariaUserId);
}

// ─── Remoção ─────────────────────────────────────────────────────────────────

export async function removerMembroAction(
  membroUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, user, role } = await requireRole(['admin']);
  const result = await removerMembro(ctx(clinicId, user.id, role), membroUserId);
  if (result.ok) revalidatePath('/dashboard/configuracoes/usuarios');
  return result;
}

/**
 * Compat: UI ainda passa dentistaId (PK da tabela dentistas).
 * Resolve para user_id e delega para removerMembro.
 */
export async function deletarUsuario(
  dentistaId: string,
): Promise<{ success: true }> {
  const { clinicId, user, role, supabase } = await requireRole(['admin']);

  if (role !== 'admin') throw new Error('Apenas administradores podem remover usuários.');

  const { data: dentista } = await supabase
    .from('dentistas')
    .select('user_id, id')
    .eq('id', dentistaId)
    .eq('clinica_id', clinicId)
    .single();

  if (!dentista) throw new Error('Usuário não encontrado.');

  if (dentista.user_id === user.id) throw new Error('Você não pode se remover da clínica.');

  const result = await removerMembro(
    ctx(clinicId, user.id, role),
    dentista.user_id as string,
  );

  if (!result.ok) throw new Error(result.error ?? 'Erro ao remover membro.');

  revalidatePath('/dashboard/configuracoes/usuarios');
  return { success: true };
}
