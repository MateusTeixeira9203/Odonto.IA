'use server';

import { revalidatePath } from 'next/cache';
import { operarRecebimento, type RecebimentoResult } from '@/server/financeiro/recebimentos';
import { listarRecebimentosOperacionais, type RecebimentosPageResult } from '@/server/financeiro/recebimentos-reader';

/** A autorização e a vinculação à clínica são revalidadas na RPC transacional. */
export async function operarRecebimentoClinica(input: unknown): Promise<RecebimentoResult> {
  const result = await operarRecebimento(input);
  if (result.ok) {
    revalidatePath('/clinica');
    revalidatePath('/clinica/meus-resultados');
    revalidatePath('/dashboard/recebimentos');
  }
  return result;
}

/** A RPC mantém paginação e autorização; o cliente só solicita a próxima página. */
export async function listarMaisRecebimentosClinica(input: unknown): Promise<RecebimentosPageResult> {
  return listarRecebimentosOperacionais(input);
}
