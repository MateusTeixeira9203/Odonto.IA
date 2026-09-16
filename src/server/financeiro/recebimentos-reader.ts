import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Uuid = z.string().uuid().transform((value) => value.toLowerCase());
const Payment = z.strictObject({
  id: Uuid,
  valorCentavos: z.number().int(),
  status: z.enum(['pendente', 'pago', 'cancelado']),
  formaPagamento: z.string().nullable(),
  data: z.string().nullable(),
  atualizadoEm: z.string().datetime({ offset: true }),
});

const Capabilities = z.strictObject({
  podeRegistrar: z.boolean(),
  podeConfirmar: z.boolean(),
  podeCorrigir: z.boolean(),
  podeEstornar: z.boolean(),
});

export const RecebimentoRowSchema = z.strictObject({
  orcamentoId: Uuid,
  pacienteId: Uuid,
  dentistaId: Uuid,
  pacienteNome: z.string(),
  dentistaNome: z.string(),
  titular: z.enum(['dentista', 'clinica']),
  devidoCentavos: z.number().int(),
  pagoCentavos: z.number().int(),
  saldoCentavos: z.number().int(),
  capacidades: Capabilities,
  pagamentos: z.array(Payment),
});

const ListarRecebimentosInputSchema = z.strictObject({
  clinicaIdEsperada: Uuid,
  offset: z.number().int().min(0).default(0),
  limite: z.number().int().min(1).max(50).default(25),
});

export const RecebimentosPageSchema = z.strictObject({
  itens: z.array(RecebimentoRowSchema),
  proximoOffset: z.number().int().min(0).nullable(),
});

export const RecebimentosPageResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: RecebimentosPageSchema }),
  z.strictObject({ ok: z.literal(false), codigo: z.literal('INDISPONIVEL'), mensagem: z.string().min(1) }),
]);

export type RecebimentoRow = z.infer<typeof RecebimentoRowSchema>;
export type RecebimentosPage = z.infer<typeof RecebimentosPageSchema>;
export type ListarRecebimentosInput = z.infer<typeof ListarRecebimentosInputSchema>;
export type RecebimentosPageResult = z.infer<typeof RecebimentosPageResultSchema>;

const indisponivel = (): RecebimentosPageResult => ({
  ok: false,
  codigo: 'INDISPONIVEL',
  mensagem: 'Não foi possível carregar os recebimentos. Tente novamente.',
});

export type RecebimentosReaderDependencies = {
  list(input: {
    p_clinica_id_esperada: string;
    p_limite: number;
    p_offset: number;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

/** A RPC pagina e aplica a capacidade de cobrança no banco antes de serializar o DTO. */
export async function listarRecebimentosOperacionais(
  input: unknown,
  dependencies?: RecebimentosReaderDependencies,
): Promise<RecebimentosPageResult> {
  const parsed = ListarRecebimentosInputSchema.safeParse(input);
  if (!parsed.success) return indisponivel();

  try {
    const source = dependencies ?? {
      list: async (args: Parameters<RecebimentosReaderDependencies['list']>[0]) => (await createClient()).rpc('listar_recebimentos_operacionais', args),
    };
    const { data, error } = await source.list({
      p_clinica_id_esperada: parsed.data.clinicaIdEsperada,
      p_limite: parsed.data.limite,
      p_offset: parsed.data.offset,
    });
    if (error) return indisponivel();
    const page = RecebimentosPageSchema.safeParse(data);
    return page.success ? { ok: true, data: page.data } : indisponivel();
  } catch {
    return indisponivel();
  }
}
