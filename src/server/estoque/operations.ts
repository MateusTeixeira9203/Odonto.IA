import {
  AjustarContagemSchema,
  CadastroItemResultDataSchema,
  CadastrarItemSchema,
  ConsumirMaterialSchema,
  CorrigirMovimentoSchema,
  CorrecaoMovimentoResultDataSchema,
  createEstoqueResultSchema,
  DescartarMaterialSchema,
  DetalharEstoqueResultDataSchema,
  DetalharEstoqueSchema,
  EditarItemSchema,
  type EstoqueFailureCode,
  type EstoqueResult,
  ListarEstoqueResultDataSchema,
  ListarEstoqueSchema,
  MutacaoEstoqueResultDataSchema,
  ReceberMaterialSchema,
  type CadastroItemResultData,
  type CorrecaoMovimentoResultData,
  type DetalharEstoqueResultData,
  type ListarEstoqueResultData,
  type MutacaoEstoqueResultData,
} from './contracts';
import { z } from 'zod';

type RpcResponse = Promise<{ data: unknown; error: { message: string } | null }>;

type OperarEstoqueAction = 'cadastrar' | 'editar' | 'receber' | 'consumir' | 'descartar' | 'ajustar' | 'corrigir';
type ConsultarEstoqueAction = 'listar' | 'detalhar';

export type EstoqueMutationDependencies = {
  operate(input: { p_acao: OperarEstoqueAction; p_entrada: unknown }): RpcResponse;
};

export type EstoqueQueryDependencies = {
  query(input: { p_acao: ConsultarEstoqueAction; p_entrada: unknown }): RpcResponse;
};

const FAILURE_MESSAGES = {
  INVALIDO: 'Revise os dados do estoque antes de continuar.',
  SEM_ACESSO: 'Você não tem acesso a esta operação de estoque.',
  NAO_ENCONTRADO: 'O item de estoque solicitado não está disponível.',
  CONFLITO: 'O estoque mudou. Atualize os dados e confira novamente.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize os dados antes de continuar.',
  SALDO_INSUFICIENTE: 'O saldo disponível não permite esta operação.',
  LOTE_VENCIDO: 'O lote selecionado está vencido e não pode ser consumido.',
  INDISPONIVEL: 'Não foi possível concluir a operação de estoque. Tente novamente.',
} as const;

function failure<TData>(codigo: EstoqueFailureCode): EstoqueResult<TData> {
  return { ok: false, codigo, mensagem: FAILURE_MESSAGES[codigo] };
}

async function defaultMutationDependencies(): Promise<EstoqueMutationDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    operate: async (input) => client.rpc('operar_estoque', input),
  };
}

async function defaultQueryDependencies(): Promise<EstoqueQueryDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    query: async (input) => client.rpc('consultar_estoque', input),
  };
}

async function executeMutation<TData>(
  action: OperarEstoqueAction,
  entry: unknown,
  dataSchema: z.ZodType<TData>,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<TData>> {
  try {
    const source = dependencies ?? await defaultMutationDependencies();
    const { data, error } = await source.operate({ p_acao: action, p_entrada: entry });
    if (error) return failure('INDISPONIVEL');

    const result = createEstoqueResultSchema(dataSchema).safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (result.data.ok === true) {
      const parsedData = dataSchema.safeParse(result.data.data);
      return parsedData.success ? { ok: true, data: parsedData.data } : failure('INDISPONIVEL');
    }
    return failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}

async function executeQuery<TData>(
  action: ConsultarEstoqueAction,
  entry: unknown,
  dataSchema: z.ZodType<TData>,
  dependencies?: EstoqueQueryDependencies,
): Promise<EstoqueResult<TData>> {
  try {
    const source = dependencies ?? await defaultQueryDependencies();
    const { data, error } = await source.query({ p_acao: action, p_entrada: entry });
    if (error) return failure('INDISPONIVEL');

    const result = createEstoqueResultSchema(dataSchema).safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    if (result.data.ok === true) {
      const parsedData = dataSchema.safeParse(result.data.data);
      return parsedData.success ? { ok: true, data: parsedData.data } : failure('INDISPONIVEL');
    }
    return failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}

export async function cadastrarItem(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<CadastroItemResultData>> {
  const parsed = CadastrarItemSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('cadastrar', parsed.data, CadastroItemResultDataSchema, dependencies);
}

export async function editarItem(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<CadastroItemResultData>> {
  const parsed = EditarItemSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('editar', parsed.data, CadastroItemResultDataSchema, dependencies);
}

export async function receberMaterial(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  const parsed = ReceberMaterialSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('receber', parsed.data, MutacaoEstoqueResultDataSchema, dependencies);
}

export async function consumirMaterial(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  const parsed = ConsumirMaterialSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('consumir', parsed.data, MutacaoEstoqueResultDataSchema, dependencies);
}

export async function descartarMaterial(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  const parsed = DescartarMaterialSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('descartar', parsed.data, MutacaoEstoqueResultDataSchema, dependencies);
}

export async function ajustarContagem(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<MutacaoEstoqueResultData>> {
  const parsed = AjustarContagemSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('ajustar', parsed.data, MutacaoEstoqueResultDataSchema, dependencies);
}

export async function corrigirMovimento(
  input: unknown,
  dependencies?: EstoqueMutationDependencies,
): Promise<EstoqueResult<CorrecaoMovimentoResultData>> {
  const parsed = CorrigirMovimentoSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeMutation('corrigir', parsed.data, CorrecaoMovimentoResultDataSchema, dependencies);
}

export async function listarEstoque(
  input: unknown,
  dependencies?: EstoqueQueryDependencies,
): Promise<EstoqueResult<ListarEstoqueResultData>> {
  const parsed = ListarEstoqueSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeQuery('listar', parsed.data, ListarEstoqueResultDataSchema, dependencies);
}

export async function detalharEstoque(
  input: unknown,
  dependencies?: EstoqueQueryDependencies,
): Promise<EstoqueResult<DetalharEstoqueResultData>> {
  const parsed = DetalharEstoqueSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  return executeQuery('detalhar', parsed.data, DetalharEstoqueResultDataSchema, dependencies);
}
