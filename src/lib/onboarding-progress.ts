import { createClient } from '@/lib/supabase/server';
import type { FocoPrincipal } from '@/lib/persona';

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
 *
 * A ordem dos passos é calibrada pela persona (Workstream B2): o passo-âncora
 * da dor de cada perfil vem primeiro.
 *   - veterano (economizar_tempo / neutro): `consulta_real` primeiro (economia de tempo).
 *   - iniciante (crescer): `planejamento` primeiro (fechar caso).
 */
export async function getOnboardingProgresso(
  clinicaId: string,
  foco?: FocoPrincipal | null,
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

  const done: Record<PassoProgresso['id'], boolean> = {
    demo:           false,
    paciente:       (pacientes.count ?? 0) > 0,
    consulta_real:  (consultaReal.count ?? 0) > 0,
    planejamento:   (planejamentos.count ?? 0) > 0,
    procedimentos:  clinica.data?.procedimentos_pendente === false,
  };

  const ordem: PassoProgresso['id'][] =
    foco === 'crescer'
      ? ['demo', 'planejamento', 'paciente', 'consulta_real', 'procedimentos']
      : ['demo', 'consulta_real', 'paciente', 'planejamento', 'procedimentos'];

  const passos: PassoProgresso[] = ordem.map((id) => ({ id, done: done[id] }));
  const completos = passos.filter((p) => p.done).length;
  return { passos, completos, total: passos.length };
}
