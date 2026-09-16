import { z } from 'zod';

const uuid = z.string().uuid().transform((value) => value.toLowerCase());
const money = z.number().int().positive().max(999_999_999_999);
const payment = {
  formaPagamento: z.enum(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'outro']),
  data: z.iso.date(),
};
const previous = { pagamentoId: uuid, atualizadoEm: z.iso.datetime({ offset: true }) };
const common = { clinicaIdEsperada: uuid, chaveIdempotencia: uuid };

export const RecebimentoInputSchema = z.discriminatedUnion('acao', [
  z.strictObject({
    ...common, acao: z.literal('registrar'),
    payload: z.union([
      z.strictObject({ orcamentoId: uuid, valorCentavos: money, ...payment }),
      z.strictObject({ cobrancaId: uuid, valorCentavos: money, ...payment }),
    ]),
  }),
  z.strictObject({ ...common, acao: z.literal('confirmar'), payload: z.strictObject({ ...previous, ...payment }) }),
  z.strictObject({ ...common, acao: z.literal('corrigir'), payload: z.strictObject({ ...previous, ...payment, valorCentavos: money }) }),
  z.strictObject({ ...common, acao: z.literal('estornar'), payload: z.strictObject({ ...previous, motivo: z.string().trim().min(1).max(500) }) }),
]);

const messages = {
  INVALIDO: 'Revise os dados da operação.',
  SEM_ACESSO: 'Sem permissão para esta operação.',
  CONTEXTO_ALTERADO: 'A clínica ativa mudou. Atualize a página.',
  CONFLITO: 'O recebimento mudou. Atualize antes de continuar.',
  SALDO_EXCEDIDO: 'O valor ultrapassa o saldo disponível.',
  INDISPONIVEL: 'Não foi possível concluir. Tente novamente com os mesmos dados.',
} as const;

const FailureCodeSchema = z.enum(['INVALIDO', 'SEM_ACESSO', 'CONTEXTO_ALTERADO', 'CONFLITO', 'SALDO_EXCEDIDO', 'INDISPONIVEL']);
const ResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: z.strictObject({
    pagamentoId: uuid, orcamentoId: uuid, pacienteId: uuid,
    titular: z.enum(['dentista', 'clinica']), valorCentavos: money,
    status: z.enum(['pendente', 'pago', 'cancelado']), atualizadoEm: z.iso.datetime({ offset: true }),
  }) }),
  z.strictObject({ ok: z.literal(false), codigo: FailureCodeSchema, mensagem: z.string() }),
]);

export type RecebimentoInput = z.infer<typeof RecebimentoInputSchema>;
export type RecebimentoResult = z.infer<typeof ResultSchema>;
type Code = z.infer<typeof FailureCodeSchema>;
export type RecebimentoDependencies = {
  operate(input: {
    p_clinica_id_esperada: string;
    p_acao: RecebimentoInput['acao'];
    p_payload: RecebimentoInput['payload'];
    p_chave_idempotencia: string;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

function failure(codigo: Code): RecebimentoResult {
  return { ok: false, codigo, mensagem: messages[codigo] };
}

/** A RPC resolve ator, clínica ativa e titular; o cliente nunca fornece autoridade. */
export async function operarRecebimento(
  input: unknown,
  dependencies?: RecebimentoDependencies,
): Promise<RecebimentoResult> {
  const parsed = RecebimentoInputSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO');
  try {
    const source = dependencies ?? {
      operate: async (args: Parameters<RecebimentoDependencies['operate']>[0]) => {
        const { createClient } = await import('../../lib/supabase/server');
        return (await createClient()).rpc('operar_recebimento_clinica', args);
      },
    };
    const { clinicaIdEsperada, chaveIdempotencia, acao, payload } = parsed.data;
    const { data, error } = await source.operate({
      p_clinica_id_esperada: clinicaIdEsperada, p_chave_idempotencia: chaveIdempotencia,
      p_acao: acao, p_payload: payload,
    });
    if (error) return failure('INDISPONIVEL');
    const result = ResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL');
    return result.data.ok ? result.data : failure(result.data.codigo);
  } catch {
    return failure('INDISPONIVEL');
  }
}
