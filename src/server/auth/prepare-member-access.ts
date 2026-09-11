import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AccessCollectionSchema, ACCESS_PERMISSIONS } from './access-catalog';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionSchema = z.number().int().positive().max(2_147_483_647);

export const PrepareMemberAccessSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  membroId: UuidSchema,
  versaoEsperada: VersionSchema,
  acessos: AccessCollectionSchema.max(ACCESS_PERMISSIONS.length),
  motivo: z.string().trim().min(1).max(500),
  chaveIdempotencia: UuidSchema,
});

export type PrepareMemberAccessInput = z.infer<typeof PrepareMemberAccessSchema>;

const FAILURE_MESSAGES = {
  INVALIDO: 'Revise os dados das permissões antes de salvar.',
  SEM_ACESSO: 'Você não tem acesso para preparar estas permissões.',
  NAO_ENCONTRADO: 'A configuração solicitada não está disponível.',
  CONFLITO: 'Esta configuração mudou. Atualize os dados e revise a alteração.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize os dados antes de continuar.',
  INDISPONIVEL: 'Não foi possível preparar as permissões. Tente novamente.',
} as const;

const FailureCodeSchema = z.enum([
  'INVALIDO', 'SEM_ACESSO', 'NAO_ENCONTRADO', 'CONFLITO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL',
]);

export type PrepareMemberAccessFailure = z.infer<typeof FailureCodeSchema>;
export type PrepareMemberAccessResult =
  | { ok: true; data: { versao: number } }
  | { ok: false; codigo: PrepareMemberAccessFailure; mensagem: string };

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: z.strictObject({ versao: VersionSchema }) }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string() }),
]);

type PrepareMemberAccessRpcInput = {
  p_clinica_id: string;
  p_membro_id: string;
  p_versao_esperada: number;
  p_acessos: PrepareMemberAccessInput['acessos'];
  p_motivo: string;
  p_chave_idempotencia: string;
};

/** Não aceita ator, responsabilidade, perfil ou teto declarados pelo formulário. */
export type PrepareMemberAccessDependencies = {
  prepare(input: PrepareMemberAccessRpcInput): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

function failure(codigo: PrepareMemberAccessFailure): PrepareMemberAccessResult {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<PrepareMemberAccessDependencies> {
  const client = await createClient();
  return { prepare: async (input) => client.rpc('preparar_acessos_membro', input) };
}

/**
 * Persiste somente configuração em preparação. Não concede acesso a recursos do produto.
 * A RPC autentica e revalida responsável, clínica, alvo e versão dentro da transação.
 * Não usar como guard nem adicionar consumidores antes do lote de enforcement.
 */
export async function prepareMemberAccess(
  input: unknown,
  dependencies?: PrepareMemberAccessDependencies,
): Promise<PrepareMemberAccessResult> {
  const parsed = PrepareMemberAccessSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { clinicaIdEsperada, membroId, versaoEsperada, acessos, motivo, chaveIdempotencia } = parsed.data;
    const { data, error } = await source.prepare({
      p_clinica_id: clinicaIdEsperada,
      p_membro_id: membroId,
      p_versao_esperada: versaoEsperada,
      p_acessos: acessos,
      p_motivo: motivo,
      p_chave_idempotencia: chaveIdempotencia,
    });
    if (error) return failure('INDISPONIVEL');

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}
