import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateText } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { buildTreatmentExplanationPrompt } from '@/lib/ai/prompts/treatment-explanation';

interface ExplicarBody {
  procedimento: string;
  dentes?: string[];
  etapas?: string[];
  pacienteNome?: string;
  contextoPaciente?: string;
}

/**
 * POST /api/dex/explicar
 * Converte linguagem técnica de um procedimento em explicação acessível para o paciente.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:explicar', 20, 60_000);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (dentista.role === 'secretaria') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
  }

  let body: ExplicarBody;
  try {
    body = (await req.json()) as ExplicarBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  if (!body.procedimento?.trim()) {
    return NextResponse.json({ error: 'procedimento obrigatório' }, { status: 400 });
  }

  const prompt = buildTreatmentExplanationPrompt({
    procedimento:     body.procedimento,
    dentes:           body.dentes,
    etapas:           body.etapas,
    pacienteNome:     body.pacienteNome ?? 'o paciente',
    contextoPaciente: body.contextoPaciente,
  });

  const callStart = Date.now();
  try {
    const result = await generateText({ prompt, feature: 'explicar' });

    logAICall({
      feature:    'explicar',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json({ explicacao: result.data });
  } catch (err) {
    console.error('[dex/explicar] Erro:', err);
    logAICall({
      feature:    'explicar',
      provider:   'groq',
      model:      'llama-3.3-70b-versatile',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      error:      err instanceof Error ? err.message : 'Erro interno',
    });
    return NextResponse.json({ error: 'Erro ao gerar explicação' }, { status: 500 });
  }
}
