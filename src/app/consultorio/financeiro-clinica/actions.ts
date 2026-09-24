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
  forma: z.enum(['pix', 'dinheiro', 'transferencia', 'outro']).optional(),
});

export type ClinicTransactionState = { ok: boolean; message: string };

export async function createClinicTransaction(_: ClinicTransactionState, formData: FormData): Promise<ClinicTransactionState> {
  const context = await getClinicHubContext();
  if (!context.ok) return { ok: false, message: context.mensagem };
  const canWrite = context.data.member.role === 'secretaria'
    || context.data.member.role === 'admin'
    || context.data.governanca?.papeis.some((role) => role === 'proprietario' || role === 'gestor') === true;
  if (!canWrite || context.data.governanca?.modalidade !== 'gerida') {
    return { ok: false, message: 'Você não tem permissão para lançar no caixa da clínica.' };
  }
  const parsed = TransactionSchema.safeParse({
    tipo: formData.get('tipo'),
    valor: formData.get('valor'),
    data: formData.get('data'),
    descricao: formData.get('descricao'),
    categoria: formData.get('categoria') || undefined,
    forma: formData.get('forma') || undefined,
  });
  if (!parsed.success) return { ok: false, message: 'Revise os dados do lançamento.' };

  const client = await createClient();
  const dentistId = context.data.member.perfilClinico?.dentistaId ?? null;
  const query = parsed.data.tipo === 'saida'
    ? client.from('despesas').insert({
      clinica_id: context.data.member.clinicaId,
      dentista_id: dentistId,
      valor: parsed.data.valor,
      categoria: parsed.data.categoria ?? 'outro',
      tipo: 'variavel',
      data: parsed.data.data,
      descricao: parsed.data.descricao,
      origem_lancamento: 'clinica',
    })
    : client.from('receitas_manuais').insert({
      clinica_id: context.data.member.clinicaId,
      dentista_id: dentistId,
      valor: parsed.data.valor,
      forma: parsed.data.forma ?? 'outro',
      data: parsed.data.data,
      descricao: parsed.data.descricao,
      origem_lancamento: 'clinica',
    });
  const { error } = await query;
  if (error) {
    console.error('[financeiro-clinica] lançamento falhou:', error.message);
    return { ok: false, message: 'Não foi possível registrar o lançamento agora.' };
  }
  revalidatePath('/dashboard/meu-consultorio');
  revalidatePath('/dashboard/meu-consultorio/financeiro-clinica');
  revalidatePath('/consultorio');
  revalidatePath('/consultorio/financeiro-clinica');
  return { ok: true, message: parsed.data.tipo === 'saida' ? 'Saída registrada no caixa da clínica.' : 'Entrada registrada no caixa da clínica.' };
}
