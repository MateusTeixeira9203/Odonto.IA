import { NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

export interface DexContextData {
  agendamentosHoje: number;
  orcamentosPendentes: number;
  proximoPaciente: string | null;
}

/**
 * GET /api/dex/context
 * Retorna dados contextuais do dia para o DEX gerar a saudação personalizada.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const dentista = await getDentistaCached();
    if (!dentista) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supabase = await createClient();
    const agora = new Date();
    const hojeInicio = new Date(agora);
    hojeInicio.setHours(0, 0, 0, 0);
    const hojeFim = new Date(agora);
    hojeFim.setHours(23, 59, 59, 999);

    const [agendamentosRes, orcamentosRes, proximoRes] = await Promise.all([
      // Consultas de hoje
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', hojeInicio.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelado'),

      // Orçamentos pendentes
      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'pendente'),

      // Próxima consulta a partir de agora
      supabase
        .from('agendamentos')
        .select('paciente:pacientes(nome), data_hora')
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', agora.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelado')
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const pacienteData = proximoRes.data?.paciente as { nome: string } | null | undefined;

    return NextResponse.json({
      agendamentosHoje: agendamentosRes.count ?? 0,
      orcamentosPendentes: orcamentosRes.count ?? 0,
      proximoPaciente: pacienteData?.nome ?? null,
    } satisfies DexContextData);
  } catch (err) {
    console.error('[dex/context] Erro:', err);
    // Retorna zeros em vez de 500 — o DEX usa fallback gracioso
    return NextResponse.json({
      agendamentosHoje: 0,
      orcamentosPendentes: 0,
      proximoPaciente: null,
    } satisfies DexContextData);
  }
}
