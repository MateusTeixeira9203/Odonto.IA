'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { getClinicHubContext } from '@/server/consultorio/context';

const TransactionSchema = z.object({
  tipo: z.enum(['entrada', 'saida']),
  valor: z.coerce.number().positive().max(99_999_999),
  data: z.string().date(),
  descricao: z.string().trim().min(2).max(160),
  categoria: z.string().trim().min(2).max(80).optional(),
  forma: z.enum(['pix', 'dinheiro', 'transferencia', 'cartao_credito', 'cartao_debito', 'boleto', 'outro']).optional(),
  dentistaId: z.string().uuid().optional(),
});

export type ClinicTransactionState = { ok: boolean; message: string };

export async function createClinicTransaction(_: ClinicTransactionState, formData: FormData): Promise<ClinicTransactionState> {
  const context = await getClinicHubContext();
  if (!context.ok) return { ok: false, message: context.mensagem };
  if (context.data.governanca?.modalidade !== 'gerida') {
    return { ok: false, message: 'Você não tem permissão para lançar no caixa da clínica.' };
  }
  const parsed = TransactionSchema.safeParse({
    tipo: formData.get('tipo'),
    valor: formData.get('valor'),
    data: formData.get('data'),
    descricao: formData.get('descricao'),
    categoria: formData.get('categoria') || undefined,
    forma: formData.get('forma') || undefined,
    dentistaId: formData.get('dentistaId') || undefined,
  });
  if (!parsed.success) return { ok: false, message: 'Revise os dados do lançamento.' };

  const client = await createClient();
  const { data, error } = await client.rpc('registrar_lancamento_clinica', {
    p_clinica_id_esperada: context.data.member.clinicaId,
    p_tipo: parsed.data.tipo,
    p_valor: parsed.data.valor,
    p_data: parsed.data.data,
    p_descricao: parsed.data.descricao,
    p_categoria: parsed.data.categoria ?? null,
    p_forma: parsed.data.forma ?? null,
    p_dentista_id: parsed.data.tipo === 'entrada' ? parsed.data.dentistaId ?? null : null,
  });
  if (error || !data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    console.error('[financeiro-clinica] lançamento falhou:', error?.message);
    return { ok: false, message: 'Não foi possível registrar o lançamento agora.' };
  }
  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/dashboard/meu-consultorio/financeiro-clinica');
  revalidatePath('/consultorio');
  revalidatePath('/consultorio/financeiro-clinica');
  return { ok: true, message: parsed.data.tipo === 'saida' ? 'Saída registrada no caixa da clínica.' : 'Entrada registrada no caixa da clínica.' };
}
