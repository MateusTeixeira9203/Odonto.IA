'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getClinicHubContext } from '@/server/consultorio/context';

export type RepasseActionState = { ok: boolean; message: string };
const initialError = { ok: false, message: 'Não foi possível concluir a ação agora.' };
const UuidSchema = z.string().uuid();
const DateSchema = z.string().date();
const MoneySchema = z.coerce.number().finite().positive().max(9_999_999);

function refresh(): void {
  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/dashboard/meu-consultorio/meu-financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro-clinica');
  revalidatePath('/dashboard/meu-consultorio/equipe');
  revalidatePath('/consultorio');
  revalidatePath('/consultorio/financeiro-clinica');
  revalidatePath('/consultorio/equipe');
}

async function call(name: string, args: Record<string, unknown>): Promise<RepasseActionState> {
  const client = await createClient();
  const { data, error } = await client.rpc(name, args);
  if (error || !data || typeof data !== 'object') return initialError;
  const result = data as { ok?: unknown; mensagem?: unknown };
  if (result.ok !== true) return { ok: false, message: typeof result.mensagem === 'string' ? result.mensagem : initialError.message };
  refresh();
  return { ok: true, message: 'Alteração registrada.' };
}

async function writableContext(): Promise<{ clinicaId: string } | RepasseActionState> {
  const context = await getClinicHubContext();
  if (!context.ok || context.data.governanca?.modalidade !== 'gerida') return { ok: false, message: 'Esta ação exige uma clínica gerida.' };
  if (context.data.member.role === 'secretaria') return { ok: false, message: 'Você não tem permissão para gerir repasses.' };
  return { clinicaId: context.data.member.clinicaId };
}

export async function saveRepasseAgreement(_: RepasseActionState, formData: FormData): Promise<RepasseActionState> {
  const context = await writableContext();
  if ('ok' in context) return context;
  const parsed = z.object({
    dentistaId: UuidSchema,
    modalidade: z.enum(['percentual_recebido', 'diaria', 'mensal_fixo']),
    percentual: z.union([MoneySchema.max(100), z.literal('')]).optional(),
    valorFixo: z.union([MoneySchema, z.literal('')]).optional(),
    vigenteDesde: DateSchema,
    vigenteAte: z.union([DateSchema, z.literal('')]).optional(),
    observacao: z.string().trim().max(500).optional(),
  }).safeParse({
    dentistaId: formData.get('dentistaId'), modalidade: formData.get('modalidade'), percentual: formData.get('percentual') ?? '', valorFixo: formData.get('valorFixo') ?? '', vigenteDesde: formData.get('vigenteDesde'), vigenteAte: formData.get('vigenteAte') ?? '', observacao: formData.get('observacao') ?? '',
  });
  if (!parsed.success) return { ok: false, message: 'Revise os dados do acordo.' };
  const isPercentual = parsed.data.modalidade === 'percentual_recebido';
  return call('salvar_acordo_repasse', {
    p_clinica_id_esperada: context.clinicaId, p_dentista_id: parsed.data.dentistaId, p_modalidade: parsed.data.modalidade,
    p_percentual: isPercentual && parsed.data.percentual !== '' ? parsed.data.percentual : null,
    p_valor_fixo: !isPercentual && parsed.data.valorFixo !== '' ? parsed.data.valorFixo : null,
    p_vigente_desde: parsed.data.vigenteDesde, p_vigente_ate: parsed.data.vigenteAte || null, p_observacao: parsed.data.observacao || null,
  });
}

export async function generateRepasse(_: RepasseActionState, formData: FormData): Promise<RepasseActionState> {
  const context = await writableContext();
  if ('ok' in context) return context;
  const parsed = z.object({ acordoId: UuidSchema, origem: z.enum(['percentual', 'diaria', 'mensal']), inicio: DateSchema.optional(), fim: DateSchema.optional(), competencia: DateSchema.optional(), dataTrabalhada: DateSchema.optional() }).safeParse({ acordoId: formData.get('acordoId'), origem: formData.get('origem'), inicio: formData.get('inicio') || undefined, fim: formData.get('fim') || undefined, competencia: formData.get('competencia') || undefined, dataTrabalhada: formData.get('dataTrabalhada') || undefined });
  if (!parsed.success) return { ok: false, message: 'Revise os dados do repasse.' };
  if (parsed.data.origem === 'percentual') {
    if (!parsed.data.inicio || !parsed.data.fim) return { ok: false, message: 'Informe o período dos recebimentos.' };
    return call('gerar_repasse_percentual', { p_clinica_id_esperada: context.clinicaId, p_acordo_id: parsed.data.acordoId, p_inicio: parsed.data.inicio, p_fim: parsed.data.fim });
  }
  if (!parsed.data.competencia) return { ok: false, message: 'Informe a competência do repasse.' };
  return call('gerar_repasse_fixo', { p_clinica_id_esperada: context.clinicaId, p_acordo_id: parsed.data.acordoId, p_competencia: parsed.data.competencia, p_data_trabalhada: parsed.data.dataTrabalhada ?? null });
}

export async function payRepasse(_: RepasseActionState, formData: FormData): Promise<RepasseActionState> {
  const context = await writableContext();
  if ('ok' in context) return context;
  const parsed = z.object({ repasseId: UuidSchema, dataPagamento: DateSchema }).safeParse({ repasseId: formData.get('repasseId'), dataPagamento: formData.get('dataPagamento') });
  if (!parsed.success) return { ok: false, message: 'Informe a data do pagamento.' };
  return call('pagar_repasse', { p_clinica_id_esperada: context.clinicaId, p_repasse_id: parsed.data.repasseId, p_data_pagamento: parsed.data.dataPagamento });
}

export async function cancelRepasse(_: RepasseActionState, formData: FormData): Promise<RepasseActionState> {
  const context = await writableContext();
  if ('ok' in context) return context;
  const parsed = UuidSchema.safeParse(formData.get('repasseId'));
  if (!parsed.success) return { ok: false, message: 'Repasse inválido.' };
  return call('cancelar_repasse', { p_clinica_id_esperada: context.clinicaId, p_repasse_id: parsed.data });
}
