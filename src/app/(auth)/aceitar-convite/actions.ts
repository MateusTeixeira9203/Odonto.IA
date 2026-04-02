'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Cria o registro do dentista convidado após ele definir nome e senha.
 * Usa service role para contornar RLS (o usuário ainda não tem linha em dentistas).
 */
export async function criarDentistaConvidado(nome: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) return { error: 'Sessão inválida. Faça login novamente.' };

  const meta = user.user_metadata as { role?: string; clinica_id?: string };

  if (!meta.role || !meta.clinica_id) {
    return { error: 'Metadados do convite não encontrados. Solicite um novo convite.' };
  }

  const service = createServiceClient();

  // Verificar se já existe (evita duplicata em double-submit)
  const { data: existing } = await service
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return {}; // já criado, ok

  const { error: insertError } = await service.from('dentistas').insert({
    user_id:    user.id,
    clinica_id: meta.clinica_id,
    nome,
    email:      user.email ?? null,
    role:       meta.role,
    ativo:      true,
  });

  if (insertError) return { error: 'Erro ao criar cadastro. Tente novamente.' };

  // Limpar convite pendente (best-effort)
  await service
    .from('convites')
    .delete()
    .eq('email', user.email ?? '')
    .eq('clinica_id', meta.clinica_id);

  return {};
}
