import { z } from 'zod';
import { AccessCollectionSchema } from '../auth/access-catalog';

export const ESTOQUE_ACTIONS = [
  'estoque.ler',
  'estoque.gerir',
  'estoque.receber',
  'estoque.consumir',
  'estoque.descartar',
  'estoque.ajustar',
] as const;

export type EstoqueAction = (typeof ESTOQUE_ACTIONS)[number];

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionSchema = z.number().int().positive().max(2_147_483_647);
const EstoqueActionSchema = z.enum(ESTOQUE_ACTIONS);
const EstoqueModeloSchema = z.enum(['colaborativa', 'gerida']);

const EstoqueActionsSchema = z.array(EstoqueActionSchema).max(ESTOQUE_ACTIONS.length).superRefine(
  (actions, context) => {
    if (new Set(actions).size !== actions.length) {
      context.addIssue({ code: 'custom', message: 'Ações de estoque não podem se repetir.' });
    }
  },
);

const StockAccessSchema = z.strictObject({
  permissao: EstoqueActionSchema,
  escopo: z.strictObject({ tipo: z.literal('clinica') }),
});

/** Concessões de estoque compartilhado: somente as seis ações, sempre para toda a clínica. */
export const StockAccessCollectionSchema = AccessCollectionSchema
  .max(ESTOQUE_ACTIONS.length)
  .superRefine((acessos, context) => {
    const hasRead = acessos.some((acesso) => acesso.permissao === 'estoque.ler');

    acessos.forEach((acesso, index) => {
      if (acesso.permissao !== 'estoque.ler' && !hasRead) {
        context.addIssue({
          code: 'custom',
          path: [index, 'permissao'],
          message: 'Toda ação de estoque exige estoque.ler.',
        });
      }
    });
  })
  .pipe(z.array(StockAccessSchema).max(ESTOQUE_ACTIONS.length));

export type StockAccess = z.infer<typeof StockAccessCollectionSchema>;

export const GetStockAccessContextSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
});

export type GetStockAccessContextInput = z.infer<typeof GetStockAccessContextSchema>;

export const ConfigureStockAccessSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  membroId: UuidSchema,
  versaoEsperada: VersionSchema,
  acessos: StockAccessCollectionSchema,
  motivo: z.string().trim().min(1).max(500),
  chaveIdempotencia: UuidSchema,
});

export type ConfigureStockAccessInput = z.infer<typeof ConfigureStockAccessSchema>;

const FailureCodeSchema = z.enum([
  'INVALIDO',
  'SEM_ACESSO',
  'NAO_ENCONTRADO',
  'CONFLITO',
  'CONTEXTO_ALTERADO',
  'INDISPONIVEL',
]);

export type StockAccessFailure = z.infer<typeof FailureCodeSchema>;

const ContextDataSchema = z.strictObject({
  clinicaId: UuidSchema,
  membroId: UuidSchema,
  modelo: EstoqueModeloSchema,
  dentistaId: UuidSchema.nullable(),
  permissoesPessoais: EstoqueActionsSchema,
  permissoesCompartilhadas: EstoqueActionsSchema,
  podeGerenciarCompartilhado: z.boolean(),
});

export type StockAccessContext = z.infer<typeof ContextDataSchema>;

const ContextResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ContextDataSchema }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string().min(1) }),
]);

const ConfigureResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: z.strictObject({ versao: VersionSchema }) }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string().min(1) }),
]);

export type StockAccessContextResult =
  | { ok: true; data: StockAccessContext }
  | { ok: false; codigo: StockAccessFailure; mensagem: string };

export type ConfigureStockAccessResult =
  | { ok: true; data: { versao: number } }
  | { ok: false; codigo: StockAccessFailure; mensagem: string };

type GetStockAccessContextRpcInput = { p_clinica_id_esperada: string };

type ConfigureStockAccessRpcInput = {
  p_clinica_id: string;
  p_membro_id: string;
  p_versao_esperada: number;
  p_acessos: StockAccess;
  p_motivo: string;
  p_chave_idempotencia: string;
};

type RpcResponse = Promise<{ data: unknown; error: { message: string } | null }>;

export type GetStockAccessContextDependencies = {
  getContext(input: GetStockAccessContextRpcInput): RpcResponse;
};

export type ConfigureStockAccessDependencies = {
  configure(input: ConfigureStockAccessRpcInput): RpcResponse;
};

const FAILURE_MESSAGES = {
  INVALIDO: 'Revise os dados do estoque antes de salvar.',
  SEM_ACESSO: 'Você não tem acesso ao estoque desta clínica.',
  NAO_ENCONTRADO: 'A configuração de estoque solicitada não está disponível.',
  CONFLITO: 'Esta configuração mudou. Atualize os dados e revise a alteração.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize os dados antes de continuar.',
  INDISPONIVEL: 'Não foi possível concluir a operação de estoque. Tente novamente.',
} as const;

function failure(codigo: StockAccessFailure): {
  ok: false;
  codigo: StockAccessFailure;
  mensagem: string;
} {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultGetDependencies(): Promise<GetStockAccessContextDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    getContext: async (input) => client.rpc('obter_contexto_estoque', input),
  };
}

async function defaultConfigureDependencies(): Promise<ConfigureStockAccessDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    configure: async (input) => client.rpc('configurar_acessos_estoque', input),
  };
}

/** Consulta o contexto já autenticado; o formulário nunca declara ator, clínica ativa ou perfil. */
export async function getStockAccessContext(
  input: unknown,
  dependencies?: GetStockAccessContextDependencies,
): Promise<StockAccessContextResult> {
  const parsed = GetStockAccessContextSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');

  try {
    const source = dependencies ?? await defaultGetDependencies();
    const { data, error } = await source.getContext({
      p_clinica_id_esperada: parsed.data.clinicaIdEsperada,
    });
    if (error) return failure('INDISPONIVEL');

    const result = ContextResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (result.data.ok === true) return result.data;
    return failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}

/** Persiste apenas concessões compartilhadas de estoque; toda autoridade é revalidada pela RPC. */
export async function configureStockAccess(
  input: unknown,
  dependencies?: ConfigureStockAccessDependencies,
): Promise<ConfigureStockAccessResult> {
  const parsed = ConfigureStockAccessSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');

  try {
    const source = dependencies ?? await defaultConfigureDependencies();
    const { clinicaIdEsperada, membroId, versaoEsperada, acessos, motivo, chaveIdempotencia } = parsed.data;
    const { data, error } = await source.configure({
      p_clinica_id: clinicaIdEsperada,
      p_membro_id: membroId,
      p_versao_esperada: versaoEsperada,
      p_acessos: acessos,
      p_motivo: motivo,
      p_chave_idempotencia: chaveIdempotencia,
    });
    if (error) return failure('INDISPONIVEL');

    const result = ConfigureResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (result.data.ok === true) return result.data;
    return failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}
