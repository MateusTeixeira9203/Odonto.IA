import { z } from 'zod';

const OptionalTextSchema = z.string().trim().max(120).nullable().optional();

export const CommercialOnboardingInputSchema = z.strictObject({
  modalidade: z.enum(['individual', 'centralizada']),
  modeloClinica: z.enum(['colaborativa', 'gerida']),
  atuaClinicamente: z.boolean(),
  nomeClinica: z.string().trim().min(2).max(120),
  nomeUsuario: z.string().trim().min(2).max(120),
  cro: OptionalTextSchema,
  especialidades: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  telefone: OptionalTextSchema,
  cidade: OptionalTextSchema,
  estado: z.string().trim().length(2).nullable().optional(),
  focoPrincipal: z.enum(['economizar_tempo', 'crescer']).nullable().optional(),
}).superRefine((input, context) => {
  if (input.modalidade === 'centralizada' && input.modeloClinica !== 'gerida') {
    context.addIssue({ code: 'custom', path: ['modeloClinica'], message: 'Pagamento pelo proprietário exige clínica gerida.' });
  }
  if (!input.atuaClinicamente && input.modeloClinica !== 'gerida') {
    context.addIssue({ code: 'custom', path: ['modeloClinica'], message: 'Quem não atende cria uma clínica gerida.' });
  }
  if (input.atuaClinicamente && (!input.cro || input.especialidades.length === 0)) {
    context.addIssue({ code: 'custom', message: 'Dados clínicos são obrigatórios para quem atende.' });
  }
});

export type CommercialOnboardingInput = z.infer<typeof CommercialOnboardingInputSchema>;

const IdSchema = z.string().uuid().transform((value) => value.toLowerCase());
const CommercialOnboardingResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({
    ok: z.literal(true),
    data: z.strictObject({
      clinicaId: IdSchema,
      membroId: IdSchema,
      dentistaId: IdSchema.nullable(),
      assinaturaId: IdSchema.nullable(),
      modalidade: z.enum(['individual', 'centralizada']),
      checkoutPendente: z.literal(true),
    }),
  }),
]);

export type CommercialOnboardingResult = z.infer<typeof CommercialOnboardingResultSchema>;
export type CommercialOnboardingDependencies = {
  start(input: {
    p_modalidade: CommercialOnboardingInput['modalidade'];
    p_modelo_clinica: CommercialOnboardingInput['modeloClinica'];
    p_atua_clinicamente: boolean;
    p_nome_clinica: string;
    p_nome_usuario: string;
    p_cro: string | null;
    p_especialidades: string[];
    p_telefone: string | null;
    p_cidade: string | null;
    p_estado: string | null;
    p_foco_principal: string | null;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

export type CommercialOnboardingStartResult =
  | CommercialOnboardingResult
  | { ok: false; codigo: 'INVALIDO' | 'JA_CADASTRADO' | 'INDISPONIVEL' };

/** A RPC é a autoridade; esta camada só valida e remove erros internos da resposta. */
export async function iniciarOnboardingComercial(
  input: unknown,
  dependencies: CommercialOnboardingDependencies,
): Promise<CommercialOnboardingStartResult> {
  const parsed = CommercialOnboardingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, codigo: 'INVALIDO' };
  const data = parsed.data;
  try {
    const result = await dependencies.start({
      p_modalidade: data.modalidade,
      p_modelo_clinica: data.modeloClinica,
      p_atua_clinicamente: data.atuaClinicamente,
      p_nome_clinica: data.nomeClinica,
      p_nome_usuario: data.nomeUsuario,
      p_cro: data.cro ?? null,
      p_especialidades: data.especialidades,
      p_telefone: data.telefone ?? null,
      p_cidade: data.cidade ?? null,
      p_estado: data.estado ?? null,
      p_foco_principal: data.focoPrincipal ?? null,
    });
    if (result.error) {
      return result.error.message.startsWith('ALREADY_ONBOARDED:')
        ? { ok: false, codigo: 'JA_CADASTRADO' }
        : { ok: false, codigo: 'INDISPONIVEL' };
    }
    const response = CommercialOnboardingResultSchema.safeParse(result.data);
    return response.success ? response.data : { ok: false, codigo: 'INDISPONIVEL' };
  } catch {
    return { ok: false, codigo: 'INDISPONIVEL' };
  }
}
