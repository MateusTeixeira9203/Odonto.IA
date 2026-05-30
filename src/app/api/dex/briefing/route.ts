import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructured } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { getCached, setCached } from '@/lib/ai/cache';
import { buildBriefingPrompt, sanitizeBriefingOutput, type BriefingOutput } from '@/lib/ai/prompts/briefing';
import { buildConsultationContext } from '@/lib/ai/context';

const CACHE_TTL_SECONDS = 60 * 60;
const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60_000;

export interface BriefingResponse extends BriefingOutput {
  pacienteNome: string;
  hora: string;
  cached: boolean;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:briefing', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const agendamentoId = req.nextUrl.searchParams.get('agendamentoId');
  if (!agendamentoId) return NextResponse.json({ error: 'agendamentoId obrigatório' }, { status: 400 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
  }

  const today    = new Date().toISOString().split('T')[0];
  const cacheKey = `briefing:${agendamentoId}:${today}`;
  const cached   = await getCached<BriefingResponse>(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  const supabase = await createClient();
  const ctx = await buildConsultationContext(agendamentoId, dentista.clinica_id, supabase);
  if (!ctx) return NextResponse.json({ error: 'Agendamento ou paciente não encontrado' }, { status: 404 });

  const { paciente, hora, observacoesAgendamento } = ctx;

  const prompt = buildBriefingPrompt({
    pacienteNome:           paciente.nome,
    idadeStr:               paciente.idadeStr,
    hora,
    observacoesAgendamento,
    observacoesPaciente:    paciente.observacoes,
    fichas: paciente.fichasRecentes.map((f) => ({
      data:          f.data,
      queixa:        f.queixa,
      anotacoes:     f.anotacoes,
      alergias:      f.alergias,
      medicamentos:  f.medicamentos,
      historicoDental: f.historicoDental,
    })),
    orcamentos: paciente.orcamentosAbertos.map((o) => ({
      status: o.status,
      total:  o.total,
      itens:  o.descricao ? o.descricao.split(', ') : [],
      diasAtualizacao: o.diasAtualizacao,
    })),
    planejamento: paciente.planejamentoAtivo
      ? {
          titulo: paciente.planejamentoAtivo.titulo,
          etapas: paciente.planejamentoAtivo.etapas,
        }
      : null,
  });

  const callStart = Date.now();
  try {
    const result = await generateStructured<BriefingOutput>({ prompt, feature: 'briefing' });
    const briefingData = sanitizeBriefingOutput(result.data);

    const response: BriefingResponse = {
      ...briefingData,
      pacienteNome: paciente.nome,
      hora,
      cached: false,
    };

    await setCached(cacheKey, response, CACHE_TTL_SECONDS);

    logAICall({
      feature:    'briefing',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      pacienteId: paciente.id,
    });

    return NextResponse.json(response);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    logAICall({
      feature:    'briefing',
      provider:   'gemini',
      model:      'gemini-2.5-flash',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      pacienteId: paciente.id,
      error:      errorMsg,
    });
    console.error('[dex/briefing] Erro:', err);
    return NextResponse.json({ error: 'Erro ao gerar briefing' }, { status: 500 });
  }
}
