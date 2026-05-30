import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateText, generateStructured } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';

interface GerarPlanejamentoBody {
  titulo?: string;
  procedimentos?: string[];
  completo?: boolean;
  /** Nome do paciente — usado para tornar o texto mais pessoal quando fornecido */
  pacienteNome?: string;
}

interface SecaoGerada {
  title: string;
  content: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'gerar-planejamento', 20, 60_000);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (dentista.role === 'secretaria') return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }

  let body: GerarPlanejamentoBody;
  try {
    body = (await req.json()) as GerarPlanejamentoBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { titulo, procedimentos = [], completo, pacienteNome } = body;
  const listaProced = procedimentos.length > 0 ? procedimentos.join(', ') : 'procedimentos a definir';
  const nomePaciente = pacienteNome?.trim() || 'o(a) paciente';

  const callStart = Date.now();

  try {
    if (completo) {
      const prompt = `Você é um assistente odontológico especializado em comunicação com pacientes.
Gere um plano de tratamento para ${nomePaciente} em português, em linguagem simples e acolhedora.
Procedimentos: ${listaProced}

Retorne JSON com este formato:
{
  "secoes": [
    { "title": "Situação Atual", "content": "..." },
    { "title": "Tratamento Proposto", "content": "..." },
    { "title": "O Que Esperar", "content": "..." },
    { "title": "Próximos Passos", "content": "..." }
  ]
}

Regras:
- Cada seção: 2-4 frases em linguagem simples, empática, sem jargão técnico
- Não use markdown nos textos de content
- Mencione o nome do paciente apenas na primeira seção`;

      const result = await generateStructured<{ secoes: SecaoGerada[] }>({ prompt, feature: 'gerar-planejamento' });

      logAICall({
        feature:    'gerar-planejamento',
        provider:   result.provider,
        model:      result.model,
        latencyMs:  result.latencyMs,
        success:    true,
        dentistaId: dentista.id,
        clinicaId:  dentista.clinica_id,
      });

      const secoes = Array.isArray(result.data.secoes) ? result.data.secoes : [];
      return NextResponse.json({ secoes });

    } else {
      if (!titulo?.trim()) {
        return NextResponse.json({ error: '"titulo" é obrigatório.' }, { status: 400 });
      }

      const prompt = `Você é um assistente odontológico especializado em comunicação com pacientes.
Escreva em português, linguagem simples e acolhedora, o conteúdo da seção "${titulo}" de um plano de tratamento.
Procedimentos previstos: ${listaProced}
Paciente: ${nomePaciente}

Responda APENAS com o texto, sem títulos, sem markdown, entre 2 e 4 frases claras e empáticas.`;

      const result = await generateText({ prompt, feature: 'gerar-planejamento' });

      logAICall({
        feature:    'gerar-planejamento',
        provider:   result.provider,
        model:      result.model,
        latencyMs:  result.latencyMs,
        success:    true,
        dentistaId: dentista.id,
        clinicaId:  dentista.clinica_id,
      });

      return NextResponse.json({ texto: result.data });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    logAICall({
      feature:    'gerar-planejamento',
      provider:   'gemini',
      model:      'gemini-2.5-flash',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      error:      errorMsg,
    });
    console.error('[gerar-planejamento] Erro:', err);
    return NextResponse.json({ error: 'Erro ao gerar planejamento com IA.' }, { status: 500 });
  }
}
