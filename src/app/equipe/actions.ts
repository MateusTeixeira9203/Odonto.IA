'use server';

import { getMemberContext } from '@/server/auth/member-context';
import { listTeam, ListTeamInputSchema, type TeamResult } from '@/server/auth/list-team';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

export async function loadTeamPage(input: unknown): Promise<TeamResult> {
  if (!isTeamWorkspaceEnabled()) {
    return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' };
  }
  const parsed = ListTeamInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, codigo: 'INVALIDO', mensagem: 'Revise os dados para consultar a equipe.' };
  }
  const context = await getMemberContext({ clinicaIdEsperada: parsed.data.clinicaIdEsperada });
  if (!context.ok) return context;
  return listTeam(parsed.data);
}
