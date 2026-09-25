import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const ActionsSchema = z.strictObject({
  podeRegistrarEntrada: z.boolean(),
  podeRegistrarCusto: z.boolean(),
});
const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ActionsSchema }),
  z.strictObject({
    ok: z.literal(false),
    codigo: z.enum(['SEM_ACESSO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']),
    mensagem: z.string().min(1),
  }),
]);

export type ClinicFinancialActions = z.infer<typeof ActionsSchema>;
export type ClinicFinancialActionsResult =
  | { ok: true; data: ClinicFinancialActions }
  | { ok: false; codigo: 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL'; mensagem: string };

export type ClinicFinancialActionsDependencies = {
  get(input: { p_clinica_id_esperada: string }): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function defaultDependencies(): Promise<ClinicFinancialActionsDependencies> {
  const client = await createClient();
  return {
    get: async (input) => client.rpc('obter_acoes_financeiras_clinica', input),
  };
}

/** A interface recebe somente os dois booleans já autorizados pela RPC, nunca a matriz bruta de acessos. */
export async function getClinicFinancialActions(
  clinicaIdEsperada: unknown,
  dependencies?: ClinicFinancialActionsDependencies,
): Promise<ClinicFinancialActionsResult> {
  const clinicaId = UuidSchema.safeParse(clinicaIdEsperada);
  if (!clinicaId.success) {
    return { ok: false, codigo: 'CONTEXTO_ALTERADO', mensagem: 'A clínica ativa não é válida.' };
  }

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.get({ p_clinica_id_esperada: clinicaId.data });
    if (error) return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar as permissões financeiras.' };

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar as permissões financeiras.' };
    return result.data;
  } catch {
    return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar as permissões financeiras.' };
  }
}
