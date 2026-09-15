import { z } from 'zod';
const uuid = z.string().uuid();
const inteiro = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const ContextoClinicaSchema = z.strictObject({
  clinicaId: uuid, nome: z.string(), proprietario: z.boolean(), dentistaId: uuid.nullable(),
  gestaoDisponivel: z.boolean(), recebimentoMisto: z.boolean(),
});
export type ContextoClinica = z.infer<typeof ContextoClinicaSchema>;
const ProfissionalSchema = z.strictObject({ id: uuid, nome: z.string() });
export const ResultadosClinicaSchema = z.strictObject({
  contexto: ContextoClinicaSchema, mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), dentistaFiltro: uuid.nullable(),
  profissionais: z.array(ProfissionalSchema).max(500),
  recebidoClinicaCentavos: inteiro, recebidoDiretoCentavos: inteiro, receitasManuaisCentavos: inteiro,
  despesasClinicaCentavos: inteiro, aReceberClinicaCentavos: inteiro,
  realizados: inteiro, faltas: inteiro, cancelados: inteiro, confirmacoesAmanha: inteiro,
  porProfissional: z.array(ProfissionalSchema.extend({ recebidoClinicaCentavos: inteiro, recebidoDiretoCentavos: inteiro,
    aReceberClinicaCentavos: inteiro, realizados: inteiro, faltas: inteiro, cancelados: inteiro })).max(500),
});
export type ResultadosClinica = z.infer<typeof ResultadosClinicaSchema>;
export const ContextoInputSchema = z.strictObject({ clinicaIdEsperada: uuid });
export const ResultadosInputSchema = ContextoInputSchema.extend({
  mes: z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/), dentistaId: uuid.nullable().optional(),
});
export type ClinicaFailure = { ok: false; codigo: 'INVALIDO' | 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL'; mensagem: string };
export type ClinicaResult<T> = { ok: true; data: T } | ClinicaFailure;
export const FailureSchema = z.strictObject({ ok: z.literal(false), codigo: z.enum(['INVALIDO','SEM_ACESSO','CONTEXTO_ALTERADO','INDISPONIVEL']), mensagem: z.string() });
