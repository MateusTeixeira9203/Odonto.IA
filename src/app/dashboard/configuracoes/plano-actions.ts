'use server';

import { requireRole } from '@/server/auth/roles';
import { revalidatePath } from 'next/cache';

export interface StatusMigracao {
  dentistasAtivos: number;
  planoAtual: string;
  podeAtivar: boolean;
}

/** Conta dentistas ativos e verifica se a clínica pode migrar para CLINICA. */
export async function verificarStatusMigracao(): Promise<
  { ok: true; status: StatusMigracao } | { ok: false; error: string }
> {
  const { supabase, clinicId } = await requireRole(['admin', 'dentista']);

  const [{ data: clinica }, { count }] = await Promise.all([
    supabase.from('clinicas').select('plano').eq('id', clinicId).single(),
    supabase
      .from('dentistas')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicId)
      .neq('role', 'secretaria')
      .eq('ativo', true),
  ]);

  if (!clinica) return { ok: false, error: 'Clínica não encontrada.' };

  const dentistasAtivos = count ?? 0;

  return {
    ok: true,
    status: {
      dentistasAtivos,
      planoAtual: (clinica as { plano: string }).plano,
      podeAtivar: dentistasAtivos >= 3,
    },
  };
}

/**
 * Ativa o plano Clínica quando há 3+ dentistas ativos.
 * Muda `clinicas.plano` de 'SOLO' para 'CLINICA' e define limite = 99.
 */
export async function ativarPlanoClinica(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { supabase, clinicId } = await requireRole(['admin']);

  // Verificar contagem atual — não confiar em dados do cliente
  const { count } = await supabase
    .from('dentistas')
    .select('id', { count: 'exact', head: true })
    .eq('clinica_id', clinicId)
    .neq('role', 'secretaria')
    .eq('ativo', true);

  if ((count ?? 0) < 3) {
    return {
      ok: false,
      error: `São necessários 3 dentistas ativos. Atualmente: ${count ?? 0}.`,
    };
  }

  const { error } = await supabase
    .from('clinicas')
    .update({ plano: 'CLINICA', limite_dentistas: 99 })
    .eq('id', clinicId)
    .eq('plano', 'SOLO');

  if (error) return { ok: false, error: 'Erro ao atualizar plano.' };

  revalidatePath('/dashboard/configuracoes');
  return { ok: true };
}
