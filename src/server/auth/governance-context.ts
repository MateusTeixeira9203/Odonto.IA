import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const GovernanceRoleSchema = z.enum(['proprietario', 'gestor', 'responsavel_tecnico']);

export type ModalidadeClinica = 'colaborativa' | 'gerida';
export type PapelGovernanca = z.infer<typeof GovernanceRoleSchema>;

export type GovernanceContext = {
  clinicaId: string;
  modalidade: ModalidadeClinica;
  versao: number;
  vigenciaModalidadeEm: string | null;
  configurada: boolean;
  papeis: PapelGovernanca[];
};

const GovernanceContextDataSchema = z.strictObject({
  clinicaId: UuidSchema,
  modalidade: z.enum(['colaborativa', 'gerida']),
  versao: z.number().int().nonnegative(),
  vigenciaModalidadeEm: z.string().nullable(),
  configurada: z.boolean(),
  papeis: z.array(GovernanceRoleSchema),
});

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: GovernanceContextDataSchema }),
  z.strictObject({
    ok: z.literal(false),
    codigo: z.enum(['SEM_ACESSO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']),
    mensagem: z.string(),
  }),
]);

export type GovernanceContextFailure = 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL';
export type GovernanceContextResult =
  | { ok: true; data: GovernanceContext }
  | { ok: false; codigo: GovernanceContextFailure; mensagem: string };

export type GovernanceContextDependencies = {
  get(input: { p_clinica_id_esperada: string }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const FAILURE_MESSAGES: Record<GovernanceContextFailure, string> = {
  SEM_ACESSO: 'Você não tem acesso à governança desta clínica.',
  CONTEXTO_ALTERADO: 'A clínica ativa foi alterada. Atualize e tente novamente.',
  INDISPONIVEL: 'Não foi possível consultar a governança agora.',
};

function failure(codigo: GovernanceContextFailure): GovernanceContextResult {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<GovernanceContextDependencies> {
  const client = await createClient();
  return {
    get: async (input) => client.rpc('obter_contexto_governanca', input),
  };
}

/**
 * Consulta a modalidade e os vínculos ativos do usuário na clínica ativa.
 * Uma clínica sem linha de governança permanece colaborativa por compatibilidade.
 */
export async function getGovernanceContext(
  clinicaIdEsperada: unknown,
  dependencies?: GovernanceContextDependencies,
): Promise<GovernanceContextResult> {
  const parsedClinicId = UuidSchema.safeParse(clinicaIdEsperada);
  if (!parsedClinicId.success) return failure('CONTEXTO_ALTERADO');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.get({ p_clinica_id_esperada: parsedClinicId.data });
    if (error) return failure('INDISPONIVEL');

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (!result.data.ok) return failure(result.data.codigo);

    return result.data;
  } catch {
    return failure('INDISPONIVEL');
  }
}
