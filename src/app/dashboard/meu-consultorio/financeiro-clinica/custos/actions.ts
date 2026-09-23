'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getMemberContext } from '@/server/auth/member-context';

const InputSchema = z.object({
  id: z.string().uuid().nullable(),
  descricao: z.string().trim().min(1).max(160),
  categoria: z.string().trim().min(1).max(80),
  valor: z.coerce.number().finite().positive(),
  diaVencimento: z.coerce.number().int().min(1).max(28),
  ativo: z.boolean(),
});

const RpcSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ id: z.string().uuid() }) }),
  z.object({ ok: z.literal(false), codigo: z.string(), mensagem: z.string().min(1) }),
]);

export type FixedCostInput = z.input<typeof InputSchema>;
export type FixedCostSaveResult = { ok: true } | { ok: false; mensagem: string };

export async function saveFixedCost(input: FixedCostInput): Promise<FixedCostSaveResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: 'Revise descrição, categoria, valor e dia de vencimento.' };

  const member = await getMemberContext();
  if (!member.ok) return { ok: false, mensagem: member.mensagem };

  const client = await createClient();
  const { data, error } = await client.rpc('salvar_despesa_recorrente', {
    p_clinica_id_esperada: member.data.clinicaId,
    p_id: parsed.data.id,
    p_descricao: parsed.data.descricao,
    p_categoria: parsed.data.categoria,
    p_valor: parsed.data.valor,
    p_dia_vencimento: parsed.data.diaVencimento,
    p_ativo: parsed.data.ativo,
  });
  if (error) return { ok: false, mensagem: 'Não foi possível salvar o custo fixo agora.' };

  const result = RpcSchema.safeParse(data);
  if (!result.success) return { ok: false, mensagem: 'Não foi possível salvar o custo fixo agora.' };
  if (!result.data.ok) return { ok: false, mensagem: result.data.mensagem };

  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/dashboard/meu-consultorio/financeiro-clinica');
  revalidatePath('/consultorio');
  revalidatePath('/consultorio/financeiro-clinica');
  return { ok: true };
}
