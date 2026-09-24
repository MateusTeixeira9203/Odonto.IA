'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getClinicHubContext } from '@/server/consultorio/context';

const PersonalTransactionSchema = z.object({
  tipo: z.enum(['entrada', 'saida']),
  valor: z.coerce.number().positive().max(99_999_999),
  data: z.string().date(),
  descricao: z.string().trim().min(2).max(160),
  categoria: z.string().trim().min(2).max(80).optional(),
  forma: z.enum(['pix', 'dinheiro', 'transferencia', 'outro']).optional(),
});

export type PersonalTransactionState = { ok: boolean; message: string };

export async function createPersonalTransaction(_: PersonalTransactionState, formData: FormData): Promise<PersonalTransactionState> {
  const context = await getClinicHubContext();
  if (!context.ok || !context.data.member.perfilClinico) {
    return { ok: false, message: context.ok ? 'Perfil clínico obrigatório para usar o financeiro pessoal.' : context.mensagem };
  }
  const parsed = PersonalTransactionSchema.safeParse({
    tipo: formData.get('tipo'),
    valor: formData.get('valor'),
    data: formData.get('data'),
    descricao: formData.get('descricao'),
    categoria: formData.get('categoria') || undefined,
    forma: formData.get('forma') || undefined,
  });
  if (!parsed.success) return { ok: false, message: 'Revise os dados do lançamento.' };

  const client = await createClient();
  const { data, error } = await client.rpc('registrar_lancamento_pessoal', {
    p_clinica_id_esperada: context.data.member.clinicaId,
    p_tipo: parsed.data.tipo,
    p_valor: parsed.data.valor,
    p_data: parsed.data.data,
    p_descricao: parsed.data.descricao,
    p_categoria: parsed.data.categoria ?? null,
    p_forma: parsed.data.forma ?? null,
  });
  if (error || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    return { ok: false, message: 'Não foi possível registrar o lançamento pessoal agora.' };
  }

  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/dashboard/meu-consultorio/meu-financeiro');
  return { ok: true, message: parsed.data.tipo === 'saida' ? 'Custo profissional registrado.' : 'Entrada pessoal registrada.' };
}
