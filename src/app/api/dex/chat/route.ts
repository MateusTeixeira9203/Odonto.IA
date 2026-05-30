import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { logAICall } from '@/lib/ai/logger';
import { buildClinicOperationalContext } from '@/lib/ai/context';

interface HistoryMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface RequestBody {
  message: string;
  history?: HistoryMessage[];
  patientContext?: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:chat', 30, 5 * 60_000);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (dentista.role === 'secretaria') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  if (!body.message?.trim()) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });

  const supabase = await createClient();
  const opCtx = await buildClinicOperationalContext(dentista.clinica_id, supabase);

  const agendaLines = opCtx.agendaHoje.length > 0
    ? opCtx.agendaHoje.map((a) => `  • ${a.hora} - ${a.nome} (${a.status})`).join('\n')
    : '  Nenhuma consulta hoje.';

  const orcamentosLines = opCtx.orcamentosPendentes.length > 0
    ? opCtx.orcamentosPendentes.map((o) => `  • ${o.nome}: R$ ${o.total.toFixed(2)} (${o.status})`).join('\n')
    : '  Nenhum.';

  const followUpLines = opCtx.followUpUrgente.length > 0
    ? opCtx.followUpUrgente.map((p) => `  • ${p.nome} (há ${p.diasSemRetorno} dias, R$ ${p.total.toFixed(2)})`).join('\n')
    : '  Nenhum.';

  const aprovadosLines = opCtx.aprovadosSemAgendamento.length > 0
    ? opCtx.aprovadosSemAgendamento.map((n) => `  • ${n}`).join('\n')
    : '  Nenhum.';

  const systemPrompt = `Você é o DEX, assistente clínico de IA integrado ao Odonto.IA — sistema de gestão odontológica.
Você é direto, prestativo e fala em português brasileiro informal mas profissional.
Responda em no máximo 3 frases curtas, salvo quando listar dados estruturados ou gerar mensagens de texto.
Nunca invente dados — use apenas as informações fornecidas abaixo.

═══════════════════════════════════════
CONTEXTO DO DIA (${opCtx.dataHoje})
═══════════════════════════════════════
Dentista: ${dentista.nome} (${dentista.role})
Pacientes cadastrados: ${opCtx.totalPacientes}

Agenda de hoje (${opCtx.agendaHoje.length} consulta${opCtx.agendaHoje.length !== 1 ? 's' : ''}):
${agendaLines}

Orçamentos aguardando aprovação (${opCtx.orcamentosPendentes.length}):
${orcamentosLines}

Follow-up urgente — enviados sem retorno há +3 dias (${opCtx.followUpUrgente.length}):
${followUpLines}

Oportunidade — orçamento aprovado sem consulta marcada (${opCtx.aprovadosSemAgendamento.length}):
${aprovadosLines}
${body.patientContext ? `\nCONTEXTO DO PACIENTE EM TELA:\n${body.patientContext}` : ''}

═══════════════════════════════════════
REGRAS
═══════════════════════════════════════
- Nunca responda sobre diagnósticos médicos, prescrições ou assuntos não relacionados à clínica.
- Se não tiver dados suficientes, diga claramente.
- Para follow-up, gere mensagem WhatsApp pronta para copiar (máx. 4 linhas, tom cordial).
- Ao sugerir ação, seja específico: diga o que fazer e onde.`;

  const contents = [
    ...(body.history ?? []),
    { role: 'user' as const, parts: [{ text: body.message }] },
  ];

  const ai = new GoogleGenAI({ apiKey });
  const callStart = Date.now();
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: { systemInstruction: { parts: [{ text: systemPrompt }] } },
    });
    const reply = (result.text ?? '').trim() || 'Não consegui gerar uma resposta. Tente novamente.';

    logAICall({
      feature:    'chat',
      provider:   'gemini',
      model:      'gemini-2.5-flash',
      latencyMs:  Date.now() - callStart,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[dex/chat] Erro Gemini:', err);
    logAICall({
      feature:    'chat',
      provider:   'gemini',
      model:      'gemini-2.5-flash',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      error:      err instanceof Error ? err.message : String(err),
    });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
