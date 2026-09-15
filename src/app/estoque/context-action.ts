'use server';

import { getStockAccessContext } from '@/server/estoque/access';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

export async function loadStockContext(input: unknown) {
  if (!isTeamWorkspaceEnabled()) return { ok: false as const, codigo: 'SEM_ACESSO' as const, mensagem: 'Estoque não disponível neste ambiente.' };
  return getStockAccessContext(input);
}
