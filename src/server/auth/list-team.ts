import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
export const ListTeamInputSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  apos: UuidSchema.nullable().optional(),
});

const TeamMemberSchema = z.strictObject({
  membroId: UuidSchema,
  // PostgreSQL left() conta caracteres Unicode, não unidades UTF-16.
  nome: z.string().min(1).refine((value) => Array.from(value).length <= 200),
  email: z.string().refine((value) => Array.from(value).length <= 320),
  papel: z.enum(['admin', 'dentista', 'secretaria', 'protetico', 'gestor']),
  status: z.enum(['ativo', 'pendente', 'suspenso', 'removido']),
  proprietario: z.boolean(),
  atuaClinicamente: z.boolean(),
});

const TeamPageSchema = z.strictObject({
  clinicaId: UuidSchema,
  clinicaNome: z.string().min(1),
  membros: z.array(TeamMemberSchema).max(50),
  proximo: UuidSchema.nullable(),
});

const FailureCodeSchema = z.enum(['INVALIDO', 'SEM_ACESSO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']);
const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: TeamPageSchema }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string() }),
]);

export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamPage = z.infer<typeof TeamPageSchema>;
export type TeamResult = z.infer<typeof RpcResultSchema>;

export type ListTeamDependencies = {
  list(input: { p_clinica_id: string; p_apos: string | null }): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const FAILURE_MESSAGES = {
  INVALIDO: 'Revise os dados para consultar a equipe.',
  SEM_ACESSO: 'Você não tem acesso para consultar esta equipe.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize os dados antes de continuar.',
  INDISPONIVEL: 'Não foi possível consultar a equipe. Tente novamente.',
} as const;

function failure(codigo: z.infer<typeof FailureCodeSchema>): TeamResult {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<ListTeamDependencies> {
  const client = await createClient();
  return { list: async (input) => client.rpc('listar_equipe_gestao', input) };
}

/** A RPC revalida unidade, vínculo e concessão a cada página, usando o cliente autenticado. */
export async function listTeam(input: unknown, dependencies?: ListTeamDependencies): Promise<TeamResult> {
  const parsed = ListTeamInputSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.list({
      p_clinica_id: parsed.data.clinicaIdEsperada,
      p_apos: parsed.data.apos ?? null,
    });
    if (error) return failure('INDISPONIVEL');
    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (!result.data.ok) return failure(result.data.codigo);
    if (result.data.data.clinicaId !== parsed.data.clinicaIdEsperada) return failure('CONTEXTO_ALTERADO');
    return result.data;
  } catch {
    return failure('INDISPONIVEL');
  }
}
