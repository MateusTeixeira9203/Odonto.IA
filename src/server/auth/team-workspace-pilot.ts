import type { createClient } from '@/lib/supabase/server';

type PilotEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  STRIPE_BILLING_ENABLED?: string;
};

/** Piloto isolado; não define cobertura comercial para gestores em produção. */
export function isTeamWorkspaceEnabled(environment: PilotEnvironment = process.env): boolean {
  if (environment.STRIPE_BILLING_ENABLED === 'true') return false;
  try {
    const url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'https:'
      && url.hostname === 'etlqznuoxiilvxzygpat.supabase.co'
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

/** Histórico de vínculos não pode esconder o vínculo ativo nem gerar um maybeSingle ambíguo. */
type EntryMembership = { role: string; status: string };

export async function getPilotEntryMembership(
  client: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clinicId: string,
): Promise<EntryMembership | null> {
  const { data: active, error } = await client.from('clinica_usuarios')
    .select('role, status').eq('usuario_id', userId).eq('clinica_id', clinicId)
    .eq('status', 'ativo').maybeSingle<EntryMembership>();
  if (error) throw new Error('Não foi possível verificar o acesso à clínica.');
  if (active) return active;

  const { data: previous, error: previousError } = await client.from('clinica_usuarios')
    .select('role, status').eq('usuario_id', userId).eq('clinica_id', clinicId)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(1).maybeSingle<EntryMembership>();
  if (previousError) throw new Error('Não foi possível verificar o acesso à clínica.');
  return previous;
}
