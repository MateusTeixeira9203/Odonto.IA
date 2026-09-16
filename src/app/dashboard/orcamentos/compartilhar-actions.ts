'use server';
import { revalidatePath } from 'next/cache';
import { confirmarEnvioManual } from '@/server/orcamentos/compartilhamento';

export async function confirmarEnvioPdf(input: unknown) {
  const result = await confirmarEnvioManual(input);
  if (result.ok) revalidatePath('/dashboard/orcamentos');
  return result;
}
