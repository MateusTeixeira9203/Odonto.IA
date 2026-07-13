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

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
    }

    let body: { texto: string; pacienteNome?: string };
    try {
      body = (await req.json()) as { texto: string; pacienteNome?: string };
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    if (!body.texto?.trim()) return NextResponse.json({ error: 'Texto vazio' }, { status: 400 });

    const prompt = `Você é um assistente clínico odontológico especializado em documentação.
Analise o relato livre do dentista e extraia SOMENTE o que é clinicamente relevante — sinal, não ruído.

${buildDentalContext()}

RELATO DO DENTISTA:
"${body.texto}"

CONTEXTO:
- Paciente: ${body.pacienteNome ?? 'não informado'}
- Data: ${new Date().toLocaleDateString('pt-BR')}

Retorne SOMENTE um JSON válido, sem markdown, com exatamente esta estrutura:
{
  "queixa_principal": "título objetivo do procedimento principal (ex: Endodontia dente 26, Restauração dentes 14 e 15)",
  "anotacoes": "evolução clínica em linguagem técnica — procedimento realizado, técnica usada, intercorrências relevantes. 2-3 frases, sem repetição, sem encher linguiça.",
  "dentes_afetados": [lista de números FDI mencionados como inteiros — ex: [26, 36]. Para procedimentos de arcada ou boca inteira, use os sentinelas do glossário acima (97/98/99)],
  "dentes_observacoes": {"13": "Tratamento de canal\nPino\nProvisório\nCoroa de porcelana", "98": "PPR (prótese parcial removível)"},
  "procedimentos": ["lista resumida dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- IGNORE conversa não-clínica: saudação, small talk, divagação, interrupção — não vira anotação nem aparece no JSON.
- NÃO INVENTE nem infira o que não foi dito — dente, procedimento, conduta ou diagnóstico ausentes no relato ficam vazios/null, nunca "chutados".
- dentes_afetados: array de inteiros FDI válidos (11-48, decíduos 51-85), nunca strings.
- ARCADA / BOCA INTEIRA: procedimentos sem dente FDI individual usam sentinelas em dentes_afetados (99 boca toda, 97 arcada superior, 98 arcada inferior — ver glossário). NÃO liste dentes individuais nesses casos.
- OBRIGATÓRIO — dentes_observacoes cobre TODO dente: para CADA número em dentes_afetados (dente individual OU sentinela 97/98/99), crie a entrada correspondente em dentes_observacoes com o(s) procedimento(s) daquele dente/região (ex: dentes_observacoes["26"] = "Tratamento de canal", dentes_observacoes["98"] = "PPR (prótese parcial removível)"). Nenhum dente citado em dentes_afetados pode ficar sem entrada em dentes_observacoes — se o dente foi mencionado, o que se fez nele TEM que estar lá. Sem isso o procedimento some do orçamento e do progresso.
- Se nenhum dente mencionado: [] e {}
- dentes_observacoes: se mais de um procedimento no mesmo dente, separar por \\n — cada linha vira um item independente marcável pelo dentista
- procedimentos: array de strings resumidas, mínimo 1 item baseado no relato
- procedimentos = INTERVENÇÕES (o que foi feito ou será feito: restauração, endodontia, exodontia, profilaxia…), NUNCA achados/diagnósticos. Cárie, pulpite, necrose, fratura, mobilidade, retração gengival são ACHADOS — descrevem o problema, vão em anotacoes/queixa_principal, jamais em procedimentos. Ex: relato "cárie oclusal no 14" → procedimento = "Restauração com resina composta", não "Cárie oclusal".
- O diagnóstico e o raciocínio clínico (ex: "pulpite irreversível confirmada por teste de vitalidade") entram em anotacoes — registrar, não descartar.
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
    // Rede de segurança: nenhum dente detectado pode ficar sem observação (senão some do
    // orçamento/progresso, que derivam de dentes_observacoes). O prompt (C2) já exige isso;
    // aqui é o fallback caso o modelo escorregue. Rótulo genérico — o dentista revisa/edita
    // na tela "Confirmar evolução" antes de salvar.
    for (const dente of parsed.dentes_afetados) {
      const key = String(dente);
      if (!parsed.dentes_observacoes[key]?.trim()) {
        parsed.dentes_observacoes[key] = 'Procedimento a confirmar';
      }
    }
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
