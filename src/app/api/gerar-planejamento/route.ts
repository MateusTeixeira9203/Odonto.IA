import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

interface GerarPlanejamentoBody {
  titulo?: string;
  procedimentos?: string[];
  completo?: boolean;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verifica autenticação
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }

  let body: GerarPlanejamentoBody;
  try {
    body = (await req.json()) as GerarPlanejamentoBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { titulo, procedimentos = [], completo } = body;
  const listaProced = procedimentos.length > 0 ? procedimentos.join(', ') : 'sem procedimentos definidos';

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (completo) {
      // Gera plano completo com múltiplas seções
      const prompt = `Você é um assistente odontológico especializado em comunicação com pacientes.
Gere um plano de tratamento completo em português, em linguagem simples e acolhedora, para um dentista apresentar ao paciente.

Procedimentos previstos: ${listaProced}

Retorne APENAS um JSON válido (sem markdown, sem blocos de código) com este formato exato:
{
  "secoes": [
    { "title": "Situação Atual", "content": "..." },
    { "title": "Tratamento Proposto", "content": "..." },
    { "title": "Próximos Passos", "content": "..." }
  ]
}

Cada seção deve ter 2-4 frases em linguagem simples, sem jargão técnico excessivo.`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });

      const text = response.text ?? '';
      // Remove eventual markdown de bloco de código
      const clean = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();

      let parsed: { secoes?: Array<{ title: string; content: string }> };
      try {
        parsed = JSON.parse(clean) as typeof parsed;
      } catch {
        return NextResponse.json({ error: 'Resposta inválida da IA.' }, { status: 500 });
      }

      return NextResponse.json({ secoes: parsed.secoes ?? [] });
    } else {
      // Gera conteúdo de uma seção específica
      if (!titulo) {
        return NextResponse.json({ error: '"titulo" é obrigatório.' }, { status: 400 });
      }

      const prompt = `Você é um assistente odontológico especializado em comunicação com pacientes.
Escreva em português, em linguagem simples e acolhedora, o conteúdo da seção "${titulo}" de um plano de tratamento dentário.

Procedimentos previstos: ${listaProced}

Responda APENAS com o texto da seção, sem títulos, sem markdown, entre 2 e 4 frases claras e empáticas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });

      const texto = (response.text ?? '').trim();
      return NextResponse.json({ texto });
    }
  } catch (err) {
    console.error('Erro ao gerar planejamento com Gemini:', err);
    return NextResponse.json({ error: 'Erro ao gerar planejamento com IA.' }, { status: 500 });
  }
}
