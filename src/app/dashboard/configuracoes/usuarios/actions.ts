'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';

export async function deletarUsuario(dentistaId: string): Promise<{ success: true }> {
  const supabase = await createClient();
  const service = createServiceClient();

  // Usuário autenticado
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) throw new Error('Não autenticado');

  // Verificar se o usuário atual é admin (busca por user_id, não por id)
  const { data: euDentista } = await supabase
    .from('dentistas')
    .select('id, role')
    .eq('user_id', currentUser.id)
    .single();

  if (!euDentista || euDentista.role !== 'admin') {
    throw new Error('Apenas administradores podem excluir usuários');
  }

  // Não permitir excluir a si mesmo
  if (dentistaId === euDentista.id) {
    throw new Error('Você não pode excluir sua própria conta');
  }

  // Buscar o dentista alvo (user_id é necessário para deletar do Auth)
  const { data: alvo, error: fetchError } = await supabase
    .from('dentistas')
    .select('id, user_id, email, clinica_id, role')
    .eq('id', dentistaId)
    .single();

  if (fetchError || !alvo) {
    throw new Error('Usuário não encontrado');
  }

  // Impedir excluir o único admin da clínica
  if (alvo.role === 'admin') {
    const { count } = await supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', alvo.clinica_id)
      .eq('role', 'admin');

    if ((count ?? 0) <= 1) {
      throw new Error('Não é possível excluir o único administrador da clínica');
    }
  }

  // Remover convites pendentes associados ao email (best-effort)
  if (alvo.email) {
    await service
      .from('convites')
      .delete()
      .eq('email', alvo.email)
      .eq('clinica_id', alvo.clinica_id);
  }

  // Deletar da tabela dentistas (FKs de fichas/orcamentos/agendamentos/pagamentos
  // já foram migradas para ON DELETE SET NULL em 027_dentista_fk_set_null)
  const { error: deleteDentistaError } = await supabase
    .from('dentistas')
    .delete()
    .eq('id', dentistaId);

  if (deleteDentistaError) throw new Error(deleteDentistaError.message);

  // Deletar do Auth via service role (usa user_id, não dentistas.id)
  const { error: deleteAuthError } = await service.auth.admin.deleteUser(alvo.user_id);
  if (deleteAuthError) throw new Error(deleteAuthError.message);

  revalidatePath('/dashboard/configuracoes/usuarios');
  return { success: true };
}
