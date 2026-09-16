'use server';

import { getMemberContext } from '@/server/auth/member-context';
import { listTeam, ListTeamInputSchema, type TeamResult } from '@/server/auth/list-team';
import {
  getMemberAccessEditor,
  GetMemberAccessEditorSchema,
  saveMemberAccessEditor,
  SaveMemberAccessEditorSchema,
  type MemberAccessEditorResult,
} from '@/server/auth/member-access-editor';
import type { PrepareMemberAccessResult } from '@/server/auth/prepare-member-access';
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

export async function loadMemberAccess(input: unknown): Promise<MemberAccessEditorResult> {
  if (!isTeamWorkspaceEnabled()) {
    return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' };
  }
  const parsed = GetMemberAccessEditorSchema.safeParse(input);
  if (!parsed.success) return getMemberAccessEditor(input);
  const context = await getMemberContext({ clinicaIdEsperada: parsed.data.clinicaIdEsperada });
  if (!context.ok) return context;
  return getMemberAccessEditor(parsed.data);
}

export async function saveMemberAccess(input: unknown): Promise<PrepareMemberAccessResult> {
  if (!isTeamWorkspaceEnabled()) {
    return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' };
  }
  const parsed = SaveMemberAccessEditorSchema.safeParse(input);
  if (!parsed.success) return saveMemberAccessEditor(input);
  const context = await getMemberContext({ clinicaIdEsperada: parsed.data.clinicaIdEsperada });
  if (!context.ok) return context;
  return saveMemberAccessEditor(parsed.data);
}
