import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ContextoClinicaSchema, ContextoInputSchema, FailureSchema, ResultadosClinicaSchema, ResultadosInputSchema, type ClinicaResult, type ContextoClinica, type ResultadosClinica } from './contracts';
export type ClinicaDependencies = { rpc(name: string, args: { p_clinica_id_esperada: string; p_mes?: string; p_dentista_id?: string | null }): Promise<{ data: unknown; error: unknown }> };
const indisponivel = (): { ok: false; codigo: 'INDISPONIVEL'; mensagem: string } => ({ ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar os resultados. Tente novamente.' });
async function call<T>(name: string, args: { p_clinica_id_esperada: string; p_mes?: string; p_dentista_id?: string | null }, schema: z.ZodType<T>, dependencies?: ClinicaDependencies): Promise<ClinicaResult<T>> {
  try {
    const source = dependencies ?? { rpc: async (rpcName: string, rpcArgs: typeof args) => (await createClient()).rpc(rpcName, rpcArgs) };
    const { data, error } = await source.rpc(name, args);
    if (error) return indisponivel();
    const parsed = z.discriminatedUnion('ok', [z.strictObject({ ok: z.literal(true), data: schema }), FailureSchema]).safeParse(data);
    return parsed.success ? parsed.data : indisponivel();
  } catch { return indisponivel(); }
}
export async function obterContextoClinica(input: unknown, dependencies?: ClinicaDependencies): Promise<ClinicaResult<ContextoClinica>> {
  const parsed = ContextoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, codigo: 'INVALIDO', mensagem: 'Clínica inválida.' };
  const result = await call('obter_contexto_clinica', { p_clinica_id_esperada: parsed.data.clinicaIdEsperada }, ContextoClinicaSchema, dependencies);
  if (result.ok && result.data.clinicaId !== parsed.data.clinicaIdEsperada) return indisponivel();
  return result;
}
export async function listarResultadosClinica(input: unknown, dependencies?: ClinicaDependencies): Promise<ClinicaResult<ResultadosClinica>> {
  const parsed = ResultadosInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, codigo: 'INVALIDO', mensagem: 'Revise o mês e o profissional.' };
  const result = await call('listar_resultados_clinica', { p_clinica_id_esperada: parsed.data.clinicaIdEsperada, p_mes: parsed.data.mes, p_dentista_id: parsed.data.dentistaId ?? null }, ResultadosClinicaSchema, dependencies);
  if (result.ok && (result.data.contexto.clinicaId !== parsed.data.clinicaIdEsperada || result.data.mes !== parsed.data.mes || result.data.dentistaFiltro !== (parsed.data.dentistaId ?? null))) return indisponivel();
  return result;
}
