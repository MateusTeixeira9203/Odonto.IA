import { createClient } from '@/lib/supabase/server';

export interface PassoProgresso {
  id: 'demo' | 'paciente' | 'consulta_real' | 'planejamento' | 'procedimentos';
  done: boolean;
}

export interface OnboardingProgresso {
  passos: PassoProgresso[];
  completos: number;
  total: number;
}

/**
 * Deriva o estado dos 5 passos de ativação a partir do banco.
 * O passo "demo" não persiste no banco (a demo não salva) → vem de flag
 * local no client (o card faz o OR com localStorage).
 */
export async function getOnboardingProgresso(
  clinicaId: string,
): Promise<OnboardingProgresso> {
  const supabase = await createClient();

  const [pacientes, consultaReal, planejamentos, clinica] = await Promise.all([
    supabase.from('pacientes').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId),
    supabase.from('fichas').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId).eq('origem', 'modo_consulta'),
    supabase.from('planejamentos').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId),
    supabase.from('clinicas').select('procedimentos_pendente')
      .eq('id', clinicaId).maybeSingle<{ procedimentos_pendente: boolean }>(),
  ]);

  const passos: PassoProgresso[] = [
    { id: 'demo',           done: false },
    { id: 'paciente',       done: (pacientes.count ?? 0) > 0 },
    { id: 'consulta_real',  done: (consultaReal.count ?? 0) > 0 },
    { id: 'planejamento',   done: (planejamentos.count ?? 0) > 0 },
    { id: 'procedimentos',  done: clinica.data?.procedimentos_pendente === false },
  ];

  const completos = passos.filter((p) => p.done).length;
  return { passos, completos, total: passos.length };
}
