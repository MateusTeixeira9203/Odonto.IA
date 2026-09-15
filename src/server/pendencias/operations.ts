import {
  BoardResultSchema,
  ListarPendenciasSchema,
  ModeloResultSchema,
  OperacaoResultSchema,
  OperarPendenciaSchema,
  SalvarModeloSchema,
  type ModeloPendencia,
  type OperacaoPendenciaData,
  type PendenciaFailureCode,
  type PendenciasBoard,
  type PendenciasResult,
} from './contracts';

type RpcResponse = Promise<{ data: unknown; error: { message: string } | null }>;

export type PendenciasDependencies = {
  listar(input: { p_clinica_id_esperada: string }): RpcResponse;
  operar(input: { p_acao: string; p_entrada: unknown }): RpcResponse;
  salvarModelo(input: { p_entrada: unknown }): RpcResponse;
};

const MENSAGENS: Record<PendenciaFailureCode, string> = {
  INVALIDO: 'Revise os dados da pendência antes de continuar.',
  SEM_ACESSO: 'Você não tem acesso a esta pendência.',
  NAO_ENCONTRADO: 'A pendência solicitada não está disponível.',
  CONFLITO: 'Esta pendência mudou. Atualize a lista e tente novamente.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize a página antes de continuar.',
  INDISPONIVEL: 'Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.',
};

function failure<T>(codigo: PendenciaFailureCode): PendenciasResult<T> {
  return { ok: false, codigo, mensagem: MENSAGENS[codigo] };
}

async function defaults(): Promise<PendenciasDependencies> {
  const { createClient } = await import('../../lib/supabase/server');
  const client = await createClient();
  return {
    listar: async (input) => client.rpc('listar_pendencias_contatos', input),
    operar: async (input) => client.rpc('operar_pendencia_contato', input),
    salvarModelo: async (input) => client.rpc('salvar_modelo_pendencia', input),
  };
}

export async function listarPendencias(
  input: unknown,
  dependencies?: PendenciasDependencies,
): Promise<PendenciasResult<PendenciasBoard>> {
  const parsed = ListarPendenciasSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  try {
    const source = dependencies ?? await defaults();
    const { data, error } = await source.listar({ p_clinica_id_esperada: parsed.data.clinicaIdEsperada });
    if (error) return failure('INDISPONIVEL');
    const result = BoardResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}

export async function operarPendencia(
  input: unknown,
  dependencies?: PendenciasDependencies,
): Promise<PendenciasResult<OperacaoPendenciaData>> {
  const parsed = OperarPendenciaSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  try {
    const source = dependencies ?? await defaults();
    const { data, error } = await source.operar({ p_acao: parsed.data.acao, p_entrada: parsed.data });
    if (error) return failure('INDISPONIVEL');
    const result = OperacaoResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}

export async function salvarModelo(
  input: unknown,
  dependencies?: PendenciasDependencies,
): Promise<PendenciasResult<ModeloPendencia>> {
  const parsed = SalvarModeloSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  try {
    const source = dependencies ?? await defaults();
    const { data, error } = await source.salvarModelo({ p_entrada: parsed.data });
    if (error) return failure('INDISPONIVEL');
    const result = ModeloResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}
