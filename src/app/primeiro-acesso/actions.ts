'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/user';
import { createServiceClient } from '@/lib/supabase/service';

export async function alterarSenhaPrimeiroAcesso(
  novaSenha: string,
): Promise<{ ok?: true; error?: string }> {
  if (novaSenha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' };
  }

  const { supabase, user } = await requireUser();
  const db = createServiceClient();

  // 1. Trocar senha — falha aqui aborta tudo
  const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
  if (authError) {
    return { error: 'Erro ao atualizar senha. Tente novamente.' };
  }

  // 2. Refresh explícito — garante que os cookies de sessão refletem as
  //    novas credenciais imediatamente, antes do cliente navegar.
  await supabase.auth.refreshSession();

  // 3. Limpar flag de troca obrigatória — falha aqui bloqueia o redirect.
  //    Sem esse passo o guard do dashboard detectaria must_change_password = true
  //    e criaria um loop infinito silencioso.
  const { error: dbError } = await db
    .from('secretarias')
    .update({ must_change_password: false })
    .eq('usuario_id', user.id);

  if (dbError) {
    // Não liberar o dashboard com estado inconsistente.
    // A senha auth foi trocada, mas o flag ainda está true.
    // A próxima tentativa re-executa updateUser (seguro no Supabase) e tenta
    // o DB update de novo — sem loop e sem dead-end.
    return {
      error:
        'Sua senha foi alterada, mas não foi possível finalizar a configuração. ' +
        'Tente novamente.',
    };
  }

  // 4. Invalidar cache de server components para dashboard e primeira tela
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/primeiro-acesso');

  return { ok: true };
}
