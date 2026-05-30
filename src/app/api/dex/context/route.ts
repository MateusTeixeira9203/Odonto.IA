import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';

export interface DexContextData {
  agendamentosHoje: number;
  agendamentosHojeList: { hora: string; paciente: string; status: string }[];
  orcamentosPendentes: number;
  orcamentosAtrasados30d: number;
  proximoPaciente: string | null;
  proximoAgendamentoId: string | null;
  proximoHorario: string | null;
  receitaProjetadaHoje: number;
  followUpPendentes: number;
  aniversariantesHoje: { nome: string; id: string }[];
  consultasSemana: number;
  orcamentosAprovadosSemana: number;
}

/**
 * GET /api/dex/context
 * Retorna dados contextuais do dia para o DEX gerar a saudação personalizada.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:context', 60, 60_000);
  if (limited) return limited;

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

    // Início da semana (segunda-feira)
    const diaSemana = agora.getDay(); // 0=dom, 1=seg...
    const diasAteLegSeg = diaSemana === 0 ? 6 : diaSemana - 1;
    const semanaInicio = new Date(agora);
    semanaInicio.setDate(agora.getDate() - diasAteLegSeg);
    semanaInicio.setHours(0, 0, 0, 0);
    const semanaFim = new Date(semanaInicio);
    semanaFim.setDate(semanaInicio.getDate() + 6);
    semanaFim.setHours(23, 59, 59, 999);

    const tresDiasAtras = new Date(agora);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
    const trintaDiasAtras = new Date(agora);
    trintaDiasAtras.setDate(agora.getDate() - 30);

    // Padrão MM-DD para filtrar aniversariantes do dia
    const mesStr = String(agora.getMonth() + 1).padStart(2, '0');
    const diaStr = String(agora.getDate()).padStart(2, '0');
    const mesdia = `-${mesStr}-${diaStr}`;

    const [
      agendamentosRes,
      agendamentosListRes,
      orcamentosRes,
      orcamentosAtrasados30dRes,
      proximoRes,
      pagamentosHojeRes,
      followUpRes,
      aniversariantesRes,
      consultasSemanaRes,
      orcamentosAprovadosSemanaRes,
    ] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', hojeInicio.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelled'),

      // Lista completa dos agendamentos de hoje (para o painel)
      supabase
        .from('agendamentos')
        .select('data_hora, status, paciente:pacientes(nome)')
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', hojeInicio.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelled')
        .order('data_hora', { ascending: true })
        .limit(10),

      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .in('status', ['rascunho', 'enviado']),

      // Orçamentos enviados há +30 dias sem resposta
      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'enviado')
        .lte('updated_at', trintaDiasAtras.toISOString()),

      supabase
        .from('agendamentos')
        .select('id, data_hora, paciente:pacientes(nome)')
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', agora.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelled')
        .order('data_hora', { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('pagamentos')
        .select('valor')
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'pago')
        .gte('data_pagamento', hojeInicio.toISOString().split('T')[0])
        .lte('data_pagamento', hojeFim.toISOString().split('T')[0]),

      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'enviado')
        .lte('updated_at', tresDiasAtras.toISOString()),

      // Aniversariantes do dia
      supabase
        .from('pacientes')
        .select('id, nome')
        .eq('clinica_id', dentista.clinica_id)
        .like('data_nascimento', `%${mesdia}`)
        .limit(10),

      // Consultas da semana
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .gte('data_hora', semanaInicio.toISOString())
        .lte('data_hora', semanaFim.toISOString())
        .not('status', 'eq', 'cancelled'),

      // Orçamentos aprovados esta semana
      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'aprovado')
        .gte('updated_at', semanaInicio.toISOString())
        .lte('updated_at', semanaFim.toISOString()),
    ]);

    const pacienteData = proximoRes.data?.paciente as { nome: string } | null | undefined;
    const receitaHoje = (pagamentosHojeRes.data ?? []).reduce((s, p) => s + ((p.valor as number) ?? 0), 0);
    const proximoHorario = proximoRes.data?.data_hora
      ? new Date(proximoRes.data.data_hora as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;

    const agendamentosHojeList = (agendamentosListRes.data ?? []).map((ag) => ({
      hora: new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      paciente: (ag.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
      status: ag.status as string,
    }));

    const aniversariantes = (aniversariantesRes.data ?? []).map((p) => ({
      nome: p.nome as string,
      id: p.id as string,
    }));

    return NextResponse.json({
      agendamentosHoje:          agendamentosRes.count ?? 0,
      agendamentosHojeList,
      orcamentosPendentes:       orcamentosRes.count ?? 0,
      orcamentosAtrasados30d:    orcamentosAtrasados30dRes.count ?? 0,
      proximoPaciente:           pacienteData?.nome ?? null,
      proximoAgendamentoId:      (proximoRes.data?.id as string | null) ?? null,
      proximoHorario,
      receitaProjetadaHoje:      receitaHoje,
      followUpPendentes:         followUpRes.count ?? 0,
      aniversariantesHoje:       aniversariantes,
      consultasSemana:           consultasSemanaRes.count ?? 0,
      orcamentosAprovadosSemana: orcamentosAprovadosSemanaRes.count ?? 0,
    } satisfies DexContextData);
  } catch (err) {
    console.error('[dex/context] Erro:', err);
    return NextResponse.json({
      agendamentosHoje: 0,
      agendamentosHojeList: [],
      orcamentosPendentes: 0,
      orcamentosAtrasados30d: 0,
      proximoPaciente: null,
      proximoAgendamentoId: null,
      proximoHorario: null,
      receitaProjetadaHoje: 0,
      followUpPendentes: 0,
      aniversariantesHoje: [],
      consultasSemana: 0,
      orcamentosAprovadosSemana: 0,
    } satisfies DexContextData);
  }
}
