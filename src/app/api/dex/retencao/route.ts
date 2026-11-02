import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { classificarRetencao, type AgendamentoRetencao, type FichaRetencao } from '@/lib/dex/retencao';
import type { DexRetencaoData } from '@/lib/dex/tipos';

const ZERADO: DexRetencaoData = {
  faltouNaoVoltou: { total: 0, pacientes: [] },
  cancelouNaoRemarcou: { total: 0, pacientes: [] },
  parouDeVir: { total60: 0, total30: 0, pacientes: [] },
};

/**
 * GET /api/dex/retencao
 * As 3 pendências de retenção (R-103b): faltou e não voltou · cancelou e não remarcou ·
 * parou de vir. Classificação em `classificarRetencao` (função pura) a partir de 2 SELECTs
 * crus — esta rota só busca e mapeia, não decide nada de regra de negócio.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:retencao', 60, 60_000);
  if (limited) return limited;

  try {
    const dentista = await getDentistaCached();
    if (!dentista) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // R-94 — protético não usa Dex, mesmo gate de alerts:37. Nenhuma query roda (I6).
    if (dentista.role === 'protetico') {
      return NextResponse.json(ZERADO satisfies DexRetencaoData);
    }

    const supabase = await createClient();
    const agora = new Date();
    const ha180Dias = new Date(agora);
    ha180Dias.setDate(ha180Dias.getDate() - 180);

    // A6/D11 — escopo "meu": dentista/admin veem só a própria agenda; secretaria vê a
    // clínica inteira. fichas_select (099) é da clínica sozinha — sem este filtro
    // explícito, "meu" vazaria prontuário de colega (I3).
    const scopado = dentista.role !== 'secretaria';

    let agendamentosQuery = supabase
      .from('agendamentos')
      .select('paciente_id, status, data_hora, paciente:pacientes!agendamentos_paciente_id_fkey(nome)')
      .eq('clinica_id', dentista.clinica_id)
      .gte('data_hora', ha180Dias.toISOString());

    let fichasQuery = supabase
      .from('fichas')
      .select('paciente_id, data_atendimento, paciente:pacientes!fichas_paciente_id_fkey(nome)')
      .eq('clinica_id', dentista.clinica_id);

    if (scopado) {
      agendamentosQuery = agendamentosQuery.eq('dentista_id', dentista.id);
      fichasQuery = fichasQuery.eq('dentista_id', dentista.id);
    }

    const [agendamentosRes, fichasRes] = await Promise.all([agendamentosQuery, fichasQuery]);

    const agendamentos: AgendamentoRetencao[] = (agendamentosRes.data ?? [])
      .map((a) => ({
        pacienteId: a.paciente_id as string,
        pacienteNome: (a.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
        status: a.status as string,
        dataHora: a.data_hora as string,
      }))
      .filter((a) => !!a.pacienteId);

    const fichas: FichaRetencao[] = (fichasRes.data ?? [])
      .map((f) => ({
        pacienteId: f.paciente_id as string,
        pacienteNome: (f.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
        dataAtendimento: f.data_atendimento as string,
      }))
      .filter((f) => !!f.pacienteId);

    return NextResponse.json(classificarRetencao(agendamentos, fichas, agora) satisfies DexRetencaoData);
  } catch (err) {
    console.error('[dex/retencao] Erro:', err);
    return NextResponse.json(ZERADO satisfies DexRetencaoData);
  }
}
