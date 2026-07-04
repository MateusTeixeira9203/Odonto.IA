import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructured } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { buildDentalContext } from '@/lib/odonto-dictionary';
import { isArch } from '@/lib/arcadas';

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
  "dentes_afetados": [lista de números FDI mencionados como inteiros — ex: [26, 36]. Para procedimentos de arcada ou boca inteira, use os sentinelas: 97 (arcada superior), 98 (arcada inferior), 99 (boca toda / todas as arcadas)],
  "dentes_observacoes": {"13": "Tratamento de canal\nPino\nProvisório\nCoroa de porcelana", "98": "PPR (prótese parcial removível)"},
  "procedimentos": ["lista resumida dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- dentes_afetados: array de inteiros FDI válidos (11-48), nunca strings
- ARCADA / BOCA INTEIRA: procedimentos sem dente FDI individual usam sentinelas em dentes_afetados:
    99 = boca toda (ex: limpeza, profilaxia, clareamento, raspagem geral, "boca toda", "toda a boca", "geral")
    97 = arcada superior / 98 = arcada inferior (ex: PPR / prótese parcial removível, prótese total, aparelho, placa — na arcada indicada)
  Exemplos de mapeamento: "PPR inferior" → 98; "prótese superior" → 97; "limpeza boca toda" → 99. NÃO liste dentes individuais nesses casos e NUNCA invente quais dentes foram afetados.
  Para CADA sentinela em dentes_afetados, crie também a entrada correspondente em dentes_observacoes com o nome do procedimento (ex: dentes_observacoes["98"] = "PPR (prótese parcial removível)") — sem isso o procedimento não aparece marcável.
- Se nenhum dente mencionado: [] e {}
- dentes_observacoes: se mais de um procedimento no mesmo dente, separar por \\n — cada linha vira um item independente marcável pelo dentista
- procedimentos: array de strings resumidas, mínimo 1 item baseado no relato
- conduta: string vazia "" se não houver orientações mencionadas
- retorno_sugerido: null se não mencionado
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;

    const result = await generateStructured<EvolucaoFormatada>({ prompt, feature: 'formatar-evolucao' });

    const parsed = result.data;
    // Validação FDI estrita por quadrante:
    //   Permanentes: quadrantes 1–4, dentes 1–8  → 11–18, 21–28, 31–38, 41–48
    //   Decíduos:    quadrantes 5–8, dentes 1–5  → 51–55, 61–65, 71–75, 81–85
    const isValidFDI = (d: number): boolean => {
      const q = Math.floor(d / 10); // quadrante (1–8)
      const t = d % 10;             // número do dente dentro do quadrante
      if (q >= 1 && q <= 4) return t >= 1 && t <= 8; // permanentes
      if (q >= 5 && q <= 8) return t >= 1 && t <= 5; // decíduos
      return false;
    };
    parsed.dentes_afetados = (parsed.dentes_afetados ?? [])
      .map((d) => Number(d))
      .filter((d) => !isNaN(d) && (isValidFDI(d) || isArch(d))); // aceita dentes FDI e sentinelas de arcada (97/98/99)
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
