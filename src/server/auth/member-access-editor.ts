import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import {
  prepareMemberAccess,
  type PrepareMemberAccessDependencies,
  type PrepareMemberAccessResult,
} from './prepare-member-access';

import { GetMemberAccessEditorSchema, SaveMemberAccessEditorSchema, DetailFailureCodeSchema, DetailResultSchema, type MemberAccessEditorResult } from './member-access-editor-contracts';
export * from './member-access-editor-contracts';

export type GetMemberAccessEditorDependencies = {
  get(input: { p_clinica_id: string; p_membro_id: string }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const FAILURE_MESSAGES = {
  SEM_ACESSO: 'Somente o proprietário ativo pode alterar permissões.',
  NAO_ENCONTRADO: 'A configuração desta pessoa não está disponível.',
  NAO_SUPORTADO: 'Esta pessoa tem permissões fora do piloto atual.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize os dados antes de continuar.',
  INDISPONIVEL: 'Não foi possível consultar as permissões agora.',
} as const;

function failure(codigo: z.infer<typeof DetailFailureCodeSchema>): MemberAccessEditorResult {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<GetMemberAccessEditorDependencies> {
  const client = await createClient();
  return {
    get: async (input) => client.rpc('obter_acessos_editor_membro', input),
  };
}

export async function getMemberAccessEditor(
  input: unknown,
  dependencies?: GetMemberAccessEditorDependencies,
): Promise<MemberAccessEditorResult> {
  const parsed = GetMemberAccessEditorSchema.safeParse(input);
  if (!parsed.success) return failure('NAO_ENCONTRADO');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.get({
      p_clinica_id: parsed.data.clinicaIdEsperada,
      p_membro_id: parsed.data.membroId,
    });
    if (error) return failure('INDISPONIVEL');
    const result = DetailResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (!result.data.ok) return failure(result.data.codigo);
    if (result.data.data.clinicaId !== parsed.data.clinicaIdEsperada
      || result.data.data.membroId !== parsed.data.membroId) return failure('CONTEXTO_ALTERADO');
    return result.data;
  } catch {
    return failure('INDISPONIVEL');
  }
}

export async function saveMemberAccessEditor(
  input: unknown,
  dependencies?: PrepareMemberAccessDependencies,
): Promise<PrepareMemberAccessResult> {
  const parsed = SaveMemberAccessEditorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, codigo: 'INVALIDO', mensagem: 'Revise as permissões antes de salvar.' };
  }
  return prepareMemberAccess(parsed.data, dependencies);
}
