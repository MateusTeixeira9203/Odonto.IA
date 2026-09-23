import { z } from 'zod';
import {
  CadastrarKitSchema,
  ConfirmarUsosSchema,
  CorrecaoUsoResultDataSchema,
  CorrigirUsoSchema,
  DeclararUsosSchema,
  EditarKitSchema,
  KitResultDataSchema,
  KitsResultDataSchema,
  ListarKitsSchema,
  ListarUsosSchema,
  PrevisualizarConfirmacaoUsosSchema,
  PrevisualizacaoConfirmacaoUsosResultDataSchema,
  type KitResultData,
  type KitUsageResult,
  type KitsResultData,
  type CorrecaoUsoResultData,
  type UsosResultData,
  type UsosListResultData,
  type PrevisualizacaoConfirmacaoUsosResultData,
  UsosListResultDataSchema,
  UsosResultDataSchema,
} from './kit-usage-contracts';
import {
  createEstoqueResultSchema,
  type EstoqueFailureCode,
} from './contracts';

type RpcResponse = Promise<{ data: unknown; error: { message: string } | null }>;
type KitAction = 'cadastrar' | 'editar';

export type KitUsageDependencies = {
  operateKit(input: { p_acao: KitAction; p_entrada: unknown }): RpcResponse;
  declareUsage(input: { p_entrada: unknown }): RpcResponse;
  confirmUsage(input: { p_entrada: unknown }): RpcResponse;
  correctUsage(input: { p_entrada: unknown }): RpcResponse;
  listKits(input: { p_entrada: unknown }): RpcResponse;
  listUsages(input: { p_entrada: unknown }): RpcResponse;
  previewConfirmation(input: { p_entrada: unknown }): RpcResponse;
};

const MESSAGES: Record<EstoqueFailureCode, string> = {
  INVALIDO: 'Revise os materiais antes de continuar.',
  SEM_ACESSO: 'Você não tem acesso a esta ficha ou kit.',
  NAO_ENCONTRADO: 'O material solicitado não está disponível.',
  CONFLITO: 'Os materiais mudaram. Atualize antes de confirmar.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize antes de continuar.',
  SALDO_INSUFICIENTE: 'Confirme explicitamente cada consumo divergente.',
  LOTE_VENCIDO: 'O lote selecionado está vencido e não pode ser usado.',
  INDISPONIVEL: 'Não foi possível concluir a operação de materiais.',
};

function failure<TData>(codigo: EstoqueFailureCode): KitUsageResult<TData> {
  return { ok: false, codigo, mensagem: MESSAGES[codigo] };
}

async function defaultDependencies(): Promise<KitUsageDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    operateKit: async (input) => client.rpc('operar_kits_estoque', input),
    declareUsage: async (input) => client.rpc('declarar_usos_estoque', input),
    confirmUsage: async (input) => client.rpc('confirmar_usos_estoque', input),
    correctUsage: async (input) => client.rpc('corrigir_uso_estoque', input),
    listKits: async (input) => client.rpc('listar_kits_estoque', input),
    listUsages: async (input) => client.rpc('listar_usos_atendimento_estoque', input),
    previewConfirmation: async (input) => client.rpc('previsualizar_confirmacao_usos_estoque', input),
  };
}

async function execute<TData>(
  call: (source: KitUsageDependencies) => RpcResponse,
  schema: z.ZodType<TData>,
  dependencies?: KitUsageDependencies,
): Promise<KitUsageResult<TData>> {
  try {
    const { data, error } = await call(dependencies ?? await defaultDependencies());
    if (error) return failure('INDISPONIVEL');
    const parsed = createEstoqueResultSchema(schema).safeParse(data);
    if (!parsed.success) return failure('INDISPONIVEL');
    if ('codigo' in parsed.data) return failure(parsed.data.codigo);
    return { ok: true, data: parsed.data.data };
  } catch {
    return failure('INDISPONIVEL');
  }
}

export async function cadastrarKit(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<KitResultData>> {
  const parsed = CadastrarKitSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.operateKit({ p_acao: 'cadastrar', p_entrada: parsed.data }), KitResultDataSchema, dependencies)
    : failure('INVALIDO');
}

export async function editarKit(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<KitResultData>> {
  const parsed = EditarKitSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.operateKit({ p_acao: 'editar', p_entrada: parsed.data }), KitResultDataSchema, dependencies)
    : failure('INVALIDO');
}

export async function declararUsos(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<UsosResultData>> {
  const parsed = DeclararUsosSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.declareUsage({ p_entrada: parsed.data }), UsosResultDataSchema, dependencies)
    : failure('INVALIDO');
}

export async function confirmarUsos(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<UsosResultData>> {
  const parsed = ConfirmarUsosSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.confirmUsage({ p_entrada: parsed.data }), UsosResultDataSchema, dependencies)
    : failure('INVALIDO');
}

export async function corrigirUso(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<CorrecaoUsoResultData>> {
  const parsed = CorrigirUsoSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.correctUsage({ p_entrada: parsed.data }), CorrecaoUsoResultDataSchema, dependencies)
    : failure('INVALIDO');
}

export async function listarKits(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<KitsResultData>> {
  const parsed = ListarKitsSchema.safeParse(input);
  return parsed.success ? execute((source) => source.listKits({ p_entrada: parsed.data }), KitsResultDataSchema, dependencies) : failure('INVALIDO');
}

export async function listarUsosDaFicha(input: unknown, dependencies?: KitUsageDependencies): Promise<KitUsageResult<UsosListResultData>> {
  const parsed = ListarUsosSchema.safeParse(input);
  return parsed.success ? execute((source) => source.listUsages({ p_entrada: parsed.data }), UsosListResultDataSchema, dependencies) : failure('INVALIDO');
}

export async function previsualizarConfirmacaoUsos(
  input: unknown,
  dependencies?: KitUsageDependencies,
): Promise<KitUsageResult<PrevisualizacaoConfirmacaoUsosResultData>> {
  const parsed = PrevisualizarConfirmacaoUsosSchema.safeParse(input);
  return parsed.success
    ? execute((source) => source.previewConfirmation({ p_entrada: parsed.data }), PrevisualizacaoConfirmacaoUsosResultDataSchema, dependencies)
    : failure('INVALIDO');
}
