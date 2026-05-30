import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateText } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { buildCommunicationPrompt, type CommunicationType } from '@/lib/ai/prompts/communication';

interface ComunicacaoBody {
  tipo: CommunicationType;
  pacienteNome: string;
  dentistaNome?: string;
  clinicaNome?: string;
  dataHora?: string;
  procedimento?: string;
  valorTotal?: number;
  diasSemRetorno?: number;
}

/**
 * POST /api/dex/comunicacao
 * Gera sugestão de mensagem WhatsApp. Não envia — apenas retorna o texto.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:comunicacao', 20, 60_000);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
  }

  let body: ComunicacaoBody;
  try {
    body = (await req.json()) as ComunicacaoBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const tiposValidos: CommunicationType[] = ['confirmacao', 'lembrete', 'follow_up', 'cobranca', 'reagendamento'];
  if (!body.tipo || !tiposValidos.includes(body.tipo)) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });
  }
  if (!body.pacienteNome?.trim()) {
    return NextResponse.json({ error: 'pacienteNome obrigatório' }, { status: 400 });
  }

  const prompt = buildCommunicationPrompt({
    tipo:            body.tipo,
    pacienteNome:    body.pacienteNome,
    dentistaNome:    body.dentistaNome?.trim() || dentista.nome,
    clinicaNome:     body.clinicaNome ?? 'a clínica',
    dataHora:        body.dataHora,
    procedimento:    body.procedimento,
    valorTotal:      body.valorTotal,
    diasSemRetorno:  body.diasSemRetorno,
  });

  const callStart = Date.now();
  try {
    const result = await generateText({ prompt, feature: 'comunicacao' });

    logAICall({
      feature:    'comunicacao',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json({ mensagem: result.data, tipo: body.tipo });
  } catch (err) {
    console.error('[dex/comunicacao] Erro:', err);
    logAICall({
      feature:    'comunicacao',
      provider:   'gemini',
      model:      'gemini-2.5-flash',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      error:      err instanceof Error ? err.message : 'Erro interno',
    });
    return NextResponse.json({ error: 'Erro ao gerar mensagem' }, { status: 500 });
  }
}
