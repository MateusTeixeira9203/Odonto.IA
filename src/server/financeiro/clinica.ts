import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido.');
const MonetarySchema = z.number().finite();
const RecurringExpenseSchema = z.strictObject({
  id: UuidSchema,
  descricao: z.string().min(1).max(160),
  categoria: z.string().min(1).max(80),
  valor: MonetarySchema.positive(),
  diaVencimento: z.number().int().min(1).max(28),
  ativo: z.boolean(),
});

const ClinicFinancialDataSchema = z.strictObject({
  clinicaId: UuidSchema,
  mes: MonthSchema,
  recebido: MonetarySchema,
  despesas: MonetarySchema,
  resultadoOperacional: MonetarySchema,
  movimentoLiquido: MonetarySchema,
  margemOperacional: MonetarySchema.nullable(),
  saldoCaixa: MonetarySchema,
  saldoBancarioConciliado: MonetarySchema.nullable(),
  aReceber: MonetarySchema,
  vencido: MonetarySchema,
  despesasFixas: MonetarySchema,
  despesasFixasPrevistas: MonetarySchema,
  folegoCaixaMeses: MonetarySchema.nullable(),
  pontoEquilibrio: MonetarySchema.nullable(),
  temBaseDeCustos: z.boolean(),
  baseDeCustosValidada: z.boolean(),
  podeGerirCustos: z.boolean(),
  recorrencias: z.array(RecurringExpenseSchema).max(200),
  chart: z.array(z.strictObject({
    mesISO: MonthSchema,
    mes: z.string().min(1),
    recebido: MonetarySchema,
    despesas: MonetarySchema,
  })).length(6),
  profissionais: z.array(z.strictObject({
    dentistaId: UuidSchema,
    nome: z.string().min(1),
    producaoAprovada: MonetarySchema,
    recebidoVinculado: MonetarySchema,
    aReceber: MonetarySchema,
    atendimentosRealizados: z.number().int().nonnegative(),
    horasAtendidas: MonetarySchema,
    horasDisponiveis: MonetarySchema,
    custoDireto: MonetarySchema.nullable(),
    custoPorHoraClinica: MonetarySchema.nullable(),
  })).max(200),
  extrato: z.array(z.strictObject({
    id: UuidSchema,
    tipo: z.enum(['recebimento', 'receita_manual', 'despesa']),
    descricao: z.string().min(1),
    data: z.string().date(),
    valor: MonetarySchema,
  })).max(8),
});

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ClinicFinancialDataSchema }),
  z.strictObject({
    ok: z.literal(false),
    codigo: z.enum(['SEM_ACESSO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']),
    mensagem: z.string().min(1),
  }),
]);

export type ClinicFinancialData = z.infer<typeof ClinicFinancialDataSchema>;
export type ClinicFinancialResult =
  | { ok: true; data: ClinicFinancialData }
  | { ok: false; codigo: 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL'; mensagem: string };

type RpcInput = { p_clinica_id_esperada: string; p_mes_referencia: string };
type RpcResponse = Promise<{ data: unknown; error: { message: string } | null }>;

export type ClinicFinancialDependencies = {
  get(input: RpcInput): RpcResponse;
};

const FAILURE_MESSAGE = 'Não foi possível consultar o financeiro da clínica agora.';

async function defaultDependencies(): Promise<ClinicFinancialDependencies> {
  const client = await createClient();
  return {
    get: async (input) => client.rpc('obter_financeiro_clinica_painel', input),
  };
}

/**
 * Leitura agregada da unidade. A RPC é a fronteira de autorização: o cliente nunca recebe
 * lançamentos individuais de outro profissional para somá-los no navegador.
 */
export async function getClinicFinancial(
  input: { clinicaIdEsperada: unknown; mes: unknown },
  dependencies?: ClinicFinancialDependencies,
): Promise<ClinicFinancialResult> {
  const clinicaId = UuidSchema.safeParse(input.clinicaIdEsperada);
  const mes = MonthSchema.safeParse(input.mes);
  if (!clinicaId.success || !mes.success) {
    return { ok: false, codigo: 'CONTEXTO_ALTERADO', mensagem: 'O período ou a clínica ativa não é válido.' };
  }

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.get({
      p_clinica_id_esperada: clinicaId.data,
      p_mes_referencia: `${mes.data}-01`,
    });
    if (error) return { ok: false, codigo: 'INDISPONIVEL', mensagem: FAILURE_MESSAGE };

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return { ok: false, codigo: 'INDISPONIVEL', mensagem: FAILURE_MESSAGE };
    return result.data;
  } catch {
    return { ok: false, codigo: 'INDISPONIVEL', mensagem: FAILURE_MESSAGE };
  }
}
