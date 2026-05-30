import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructured } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';

export interface EvolucaoFormatada {
  queixa_principal: string;
  anotacoes: string;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:formatar-evolucao', 20, 60_000);
  if (limited) return limited;

  try {
    const dentista = await getDentistaCached();
    if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    let body: { texto: string; pacienteNome?: string };
    try {
      body = (await req.json()) as { texto: string; pacienteNome?: string };
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    if (!body.texto?.trim()) return NextResponse.json({ error: 'Texto vazio' }, { status: 400 });

    const prompt = `Você é um assistente clínico odontológico. Analise o relato livre do dentista abaixo e extraia as informações estruturadas da evolução clínica.

RELATO DO DENTISTA:
"${body.texto}"

Retorne SOMENTE um JSON válido, sem markdown, sem explicações, com exatamente esta estrutura:
{
  "queixa_principal": "título curto do procedimento realizado (ex: Extração do elemento 36, Restauração dos dentes 14 e 15)",
  "anotacoes": "texto clínico organizado e completo, incluindo procedimento, anestesia se mencionada, intercorrências, orientações, retorno — em linguagem profissional mas clara",
  "dentes_afetados": [lista de números de dentes ISO mencionados — apenas números inteiros],
  "dentes_observacoes": {"número_do_dente": "observação específica para aquele dente"}
}

Regras:
- Se nenhum dente específico for mencionado, use [] e {}
- Use numeração ISO adulta (11–48)
- Se mencionar "arcada superior", "arcada inferior" ou "todos os dentes", não incluir dentes individuais
- dentes_afetados deve ser array de números inteiros, não strings
- Mantenha anotacoes concisas mas completas (2-5 frases)
- Se o relato mencionar ${body.pacienteNome ? `o paciente "${body.pacienteNome}"` : 'o paciente'}, não repetir o nome nas anotações`;

    const callStart = Date.now();
    const result = await generateStructured<EvolucaoFormatada>({ prompt, feature: 'formatar-evolucao' });

    const parsed = result.data;
    parsed.dentes_afetados = (parsed.dentes_afetados ?? [])
      .map((d) => Number(d))
      .filter((d) => !isNaN(d) && d >= 11 && d <= 99);
    parsed.dentes_observacoes = parsed.dentes_observacoes ?? {};

    logAICall({
      feature:    'formatar-evolucao',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json(parsed satisfies EvolucaoFormatada);
  } catch (err) {
    console.error('[dex/formatar-evolucao] Erro:', err);
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
