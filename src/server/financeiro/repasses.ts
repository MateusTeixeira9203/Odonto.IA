import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido.');
const MonetarySchema = z.number().finite().nonnegative();
const AgreementSchema = z.strictObject({
  id: UuidSchema,
  modalidade: z.enum(['percentual_recebido', 'diaria', 'mensal_fixo']),
  percentual: z.number().finite().nullable(),
  valorFixo: z.number().finite().nullable(),
  vigenteDesde: z.string().date(),
  vigenteAte: z.string().date().nullable().optional(),
});
const RepasseSchema = z.strictObject({
  id: UuidSchema,
  dentistaId: UuidSchema.optional(),
  nome: z.string().min(1).optional(),
  origem: z.enum(['percentual', 'diaria', 'mensal']),
  competencia: z.string().date(),
  valor: MonetarySchema,
  status: z.enum(['previsto', 'pago', 'cancelado']),
  pagoEm: z.string().date().nullable(),
});
const FailureSchema = z.strictObject({
  ok: z.literal(false),
  codigo: z.enum(['SEM_ACESSO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL']),
  mensagem: z.string().min(1),
});

const ClinicRepassesDataSchema = z.strictObject({
  clinicaId: UuidSchema,
  mes: MonthSchema,
  podeGerir: z.boolean(),
  repasses: z.array(RepasseSchema).max(500),
  profissionais: z.array(z.strictObject({
    dentistaId: UuidSchema,
    nome: z.string().min(1),
    acordo: AgreementSchema.nullable(),
    previsto: MonetarySchema,
    pago: MonetarySchema,
  })).max(200),
});
const ManagedPersonalDataSchema = z.strictObject({
  clinicaId: UuidSchema,
  mes: MonthSchema,
  entradasPessoais: MonetarySchema,
  custosProfissionais: MonetarySchema,
  resultadoPessoal: MonetarySchema,
  horasAtendidas: MonetarySchema,
  horasDisponiveisConfiguradas: MonetarySchema,
  custosFixosProprios: MonetarySchema,
  custosFixosEstruturaAtribuidos: MonetarySchema,
  custoPorHoraClinica: MonetarySchema.nullable(),
  orcamentosAprovados: MonetarySchema,
  atendimentosRealizados: z.number().int().nonnegative(),
  recebidoVinculado: MonetarySchema,
  recebidoPorHora: MonetarySchema.nullable(),
  producaoPorHora: MonetarySchema.nullable(),
  ocupacaoRealizada: MonetarySchema.nullable(),
  ticketAprovado: MonetarySchema.nullable(),
  ticketRecebidoPorPaciente: MonetarySchema.nullable(),
  conversaoOrcamentos: MonetarySchema.nullable(),
  repassePrevisto: MonetarySchema,
  repassePago: MonetarySchema,
  serieMensal: z.array(z.strictObject({
    mesISO: MonthSchema,
    mes: z.string().min(1),
    entradas: MonetarySchema,
    despesas: MonetarySchema,
  })).length(6),
  repasses: z.array(RepasseSchema.omit({ dentistaId: true, nome: true })).max(500),
});

const ClinicRpcSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ClinicRepassesDataSchema }),
  FailureSchema,
]);
const PersonalRpcSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ManagedPersonalDataSchema }),
  FailureSchema,
]);

export type ClinicRepassesData = z.infer<typeof ClinicRepassesDataSchema>;
export type ManagedPersonalData = z.infer<typeof ManagedPersonalDataSchema>;
export type RepasseActionResult =
  | { ok: true; data: { id: string; valor?: number } }
  | { ok: false; codigo: 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL' | 'INVALIDO' | 'CONFLITO' | 'SEM_ORIGEM'; mensagem: string };

const unavailable = { ok: false as const, codigo: 'INDISPONIVEL' as const, mensagem: 'Não foi possível consultar os repasses agora.' };

export async function getClinicRepasses(input: { clinicaIdEsperada: unknown; mes: unknown }): Promise<{ ok: true; data: ClinicRepassesData } | typeof unavailable | z.infer<typeof FailureSchema>> {
  const clinicaId = UuidSchema.safeParse(input.clinicaIdEsperada);
  const mes = MonthSchema.safeParse(input.mes);
  if (!clinicaId.success || !mes.success) return { ok: false, codigo: 'CONTEXTO_ALTERADO', mensagem: 'A clínica ativa ou o período foi alterado.' };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('obter_repasses_clinica', { p_clinica_id_esperada: clinicaId.data, p_mes_referencia: `${mes.data}-01` });
    if (error) return unavailable;
    const parsed = ClinicRpcSchema.safeParse(data);
    return parsed.success ? parsed.data : unavailable;
  } catch {
    return unavailable;
  }
}

export async function getManagedPersonalFinance(input: { clinicaIdEsperada: unknown; mes: unknown }): Promise<{ ok: true; data: ManagedPersonalData } | typeof unavailable | z.infer<typeof FailureSchema>> {
  const clinicaId = UuidSchema.safeParse(input.clinicaIdEsperada);
  const mes = MonthSchema.safeParse(input.mes);
  if (!clinicaId.success || !mes.success) return { ok: false, codigo: 'CONTEXTO_ALTERADO', mensagem: 'A clínica ativa ou o período foi alterado.' };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('obter_meu_financeiro_gerido', { p_clinica_id_esperada: clinicaId.data, p_mes_referencia: `${mes.data}-01` });
    if (error) return unavailable;
    const parsed = PersonalRpcSchema.safeParse(data);
    return parsed.success ? parsed.data : unavailable;
  } catch {
    return unavailable;
  }
}
