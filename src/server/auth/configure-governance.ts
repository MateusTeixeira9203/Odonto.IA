import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionSchema = z.literal(0);

export const ConfigureGovernanceSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  modalidade: z.enum(['colaborativa', 'gerida']),
  proprietarioMembroId: UuidSchema.nullable(),
  versaoEsperada: VersionSchema,
  chaveIdempotencia: UuidSchema,
}).superRefine((input, context) => {
  if (input.modalidade === 'gerida' && input.proprietarioMembroId === null) {
    context.addIssue({ code: 'custom', path: ['proprietarioMembroId'], message: 'Clínica gerida exige proprietário.' });
  }
  if (input.modalidade === 'colaborativa' && input.proprietarioMembroId !== null) {
    context.addIssue({ code: 'custom', path: ['proprietarioMembroId'], message: 'Clínica colaborativa não possui proprietário.' });
  }
});

export type ConfigureGovernanceInput = z.infer<typeof ConfigureGovernanceSchema>;

const FailureCodeSchema = z.enum([
  'INVALIDO', 'SEM_ACESSO', 'NAO_ENCONTRADO', 'CONFLITO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL',
]);
export type ConfigureGovernanceFailure = z.infer<typeof FailureCodeSchema>;

export type ConfigureGovernanceResult =
  | {
    ok: true;
    data: {
      clinicaId: string;
      modalidade: 'colaborativa' | 'gerida';
      versao: number;
      proprietarioMembroId: string | null;
    };
  }
  | { ok: false; codigo: ConfigureGovernanceFailure; mensagem: string };

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    data: z.strictObject({
      clinicaId: UuidSchema,
      modalidade: z.enum(['colaborativa', 'gerida']),
      versao: z.number().int().positive(),
      proprietarioMembroId: UuidSchema.nullable(),
    }),
  }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string() }),
]);

export type ConfigureGovernanceDependencies = {
  configure(input: {
    p_clinica_id: string;
    p_modalidade: 'colaborativa' | 'gerida';
    p_proprietario_membro_id: string | null;
    p_versao_esperada: 0;
    p_chave_idempotencia: string;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

const FAILURE_MESSAGES: Record<ConfigureGovernanceFailure, string> = {
  INVALIDO: 'Revise os dados da modalidade antes de continuar.',
  SEM_ACESSO: 'Você não tem acesso para configurar esta clínica.',
  NAO_ENCONTRADO: 'A clínica não está disponível.',
  CONFLITO: 'Esta configuração mudou. Atualize antes de continuar.',
  CONTEXTO_ALTERADO: 'A clínica ativa foi alterada. Atualize e tente novamente.',
  INDISPONIVEL: 'Não foi possível configurar a clínica agora.',
};

function failure(codigo: ConfigureGovernanceFailure): ConfigureGovernanceResult {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<ConfigureGovernanceDependencies> {
  const client = await createClient();
  return {
    configure: async (input) => client.rpc('configurar_governanca_inicial', input),
  };
}

/**
 * Configura somente o primeiro proprietário aceito no onboarding.
 * Nomeações posteriores usam operações próprias e nunca reutilizam esta RPC.
 */
export async function configureInitialGovernance(
  input: unknown,
  dependencies?: ConfigureGovernanceDependencies,
): Promise<ConfigureGovernanceResult> {
  const parsed = ConfigureGovernanceSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.configure({
      p_clinica_id: parsed.data.clinicaIdEsperada,
      p_modalidade: parsed.data.modalidade,
      p_proprietario_membro_id: parsed.data.proprietarioMembroId,
      p_versao_esperada: parsed.data.versaoEsperada,
      p_chave_idempotencia: parsed.data.chaveIdempotencia,
    });
    if (error) return failure('INDISPONIVEL');

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}
