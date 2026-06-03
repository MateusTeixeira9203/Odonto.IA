import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructured } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { buildDentalContext } from '@/lib/odonto-dictionary';

export interface EvolucaoFormatada {
  queixa_principal:    string;
  anotacoes:           string;
  dentes_afetados:     number[];
  dentes_observacoes:  Record<string, string>;
  // Campos novos:
  procedimentos:       string[];
  conduta:             string;
  retorno_sugerido:    string | null;
  alerta_novo:         string | null;
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

    const prompt = `Você é um assistente clínico odontológico especializado em documentação.
Analise o relato livre do dentista e extraia TODAS as informações clínicas de forma estruturada.

${buildDentalContext()}

RELATO DO DENTISTA:
"${body.texto}"

CONTEXTO:
- Paciente: ${body.pacienteNome ?? 'não informado'}
- Data: ${new Date().toLocaleDateString('pt-BR')}

Retorne SOMENTE um JSON válido, sem markdown, com exatamente esta estrutura:
{
  "queixa_principal": "título objetivo do procedimento principal (ex: Endodontia dente 26, Restauração dentes 14 e 15)",
  "anotacoes": "evolução clínica completa e organizada em linguagem técnica — procedimento realizado, técnica usada, intercorrências, observações relevantes. 2-4 frases.",
  "dentes_afetados": [lista de números FDI mencionados como inteiros — ex: [26, 36]],
  "dentes_observacoes": {"número": "observação específica deste dente"},
  "procedimentos": ["lista dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- dentes_afetados: array de inteiros FDI válidos (11-48), nunca strings
- Se nenhum dente mencionado: [] e {}
- procedimentos: array de strings, mínimo 1 item baseado no relato
- conduta: string vazia "" se não houver orientações mencionadas
- retorno_sugerido: null se não mencionado
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;

    const callStart = Date.now();
    const result = await generateStructured<EvolucaoFormatada>({ prompt, feature: 'formatar-evolucao' });

    const parsed = result.data;
    parsed.dentes_afetados = (parsed.dentes_afetados ?? [])
      .map((d) => Number(d))
      .filter((d) => !isNaN(d) && d >= 11 && d <= 99);
    parsed.dentes_observacoes = parsed.dentes_observacoes ?? {};
    parsed.procedimentos = Array.isArray(parsed.procedimentos)
      ? (parsed.procedimentos as unknown[]).filter((p): p is string => typeof p === 'string')
      : [];
    parsed.conduta = typeof parsed.conduta === 'string' ? parsed.conduta : '';
    parsed.retorno_sugerido = typeof parsed.retorno_sugerido === 'string' ? parsed.retorno_sugerido : null;
    parsed.alerta_novo = typeof parsed.alerta_novo === 'string' ? parsed.alerta_novo : null;

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
