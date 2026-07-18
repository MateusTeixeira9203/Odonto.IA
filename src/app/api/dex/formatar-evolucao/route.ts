import { NextRequest, NextResponse } from 'next/server';
import { Type, type Schema } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructuredGemini } from '@/lib/ai/provider';
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
  alerta_novo:         string | null;
}

// Formato que o MODELO devolve (spec fase1-5 §C2): schema estrito não aceita chaves
// dinâmicas, então dentes_observacoes chega como lista de pares e a rota converte.
// O contrato com o cliente (EvolucaoFormatada) permanece intacto.
interface EvolucaoWire {
  queixa_principal:    string;
  anotacoes:           string;
  dentes_afetados:     number[];
  dentes_observacoes:  Array<{ dente: string; observacao: string }>;
  procedimentos:       string[];
  conduta:             string;
  alerta_novo:         string | null;
}

// Schema imposto pela API do Gemini — validado no bake-off 13/07 (plans/specs/eval/).
const EVOLUCAO_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ['queixa_principal', 'anotacoes', 'dentes_afetados', 'dentes_observacoes', 'procedimentos', 'conduta'],
  properties: {
    queixa_principal: { type: Type.STRING },
    anotacoes:        { type: Type.STRING },
    dentes_afetados:  { type: Type.ARRAY, items: { type: Type.INTEGER } },
    dentes_observacoes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['dente', 'observacao'],
        properties: {
          dente:      { type: Type.STRING },
          observacao: { type: Type.STRING },
        },
      },
    },
    procedimentos:    { type: Type.ARRAY, items: { type: Type.STRING } },
    conduta:          { type: Type.STRING },
    alerta_novo:      { type: Type.STRING, nullable: true },
  },
};

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
  "anotacoes": "evolução clínica em linguagem técnica — procedimento realizado, técnica usada, intercorrências relevantes. 2-3 frases (caso extenso: até 6, cobrindo os principais diagnósticos), sem repetição, sem encher linguiça.",
  "dentes_afetados": [26, 36],
  "dentes_observacoes": [{"dente": "13", "observacao": "Tratamento de canal\\nPino\\nProvisório\\nCoroa de porcelana"}, {"dente": "98", "observacao": "PPR (prótese parcial removível)"}],
  "procedimentos": ["lista resumida dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- IGNORE conversa não-clínica: saudação, small talk, divagação, interrupção — não vira anotação nem aparece no JSON.
- NÃO INVENTE nem infira o que não foi dito — dente, procedimento, conduta ou diagnóstico ausentes no relato ficam vazios/null, nunca "chutados".
- CORREÇÃO DE TRANSCRIÇÃO: o relato vem de transcrição de voz e pode ter erros fonéticos — corrija-os pelo contexto clínico (ex: "reza"→"resina", "pério"→"periodontia"). Números de dente só corrigir se o contexto tornar o erro inequívoco. Nunca invente conteúdo novo ao corrigir.
- dentes_afetados: array de inteiros FDI válidos (11-48, decíduos 51-85). Para procedimentos de arcada ou boca inteira, use os sentinelas (99 boca toda, 97 arcada superior, 98 arcada inferior — ver glossário). NÃO liste dentes individuais nesses casos.
- OBRIGATÓRIO — dentes_observacoes cobre TODO dente: para CADA número em dentes_afetados (dente individual OU sentinela 97/98/99), crie um item {"dente": "<número>", "observacao": "<procedimento(s)>"} em dentes_observacoes. Nenhum dente citado em dentes_afetados pode ficar sem item correspondente — se o dente foi mencionado, o que se fez nele TEM que estar lá. Sem isso o procedimento some do orçamento e do progresso.
- PLANEJADO TAMBÉM CONTA: procedimento indicado ou planejado para sessão futura (ex: "indiquei exodontia", "vou extrair o 28 na próxima", "facetas nos incisivos, preparo na próxima") ENTRA em dentes_afetados e dentes_observacoes igual ao realizado — marque o status na observação (ex: "Exodontia — planejado"). A ficha alimenta o plano de tratamento e o orçamento: o que foi indicado e não registrado é tratamento e receita perdidos.
- NOTA DE PLANEJAMENTO/COORDENAÇÃO ≠ procedimento: fala de preparo, encaminhamento ou avaliação futura SEM intervenção executável definida (ex: "preparar o dente pra passar pro Dr. Fulano", "planejar um implante ali mais pra frente", "avaliar na próxima consulta") vira observação do dente prefixada com "Planejamento: " (ex: "Planejamento: preparo para prótese — encaminhar ao Dr. Fulano") e NUNCA entra no array procedimentos — não é item orçável. Distinção: "vou extrair o 28 na próxima" é intervenção concreta indicada (entra como "Exodontia — planejado"); "preparar pro protesista" é coordenação (vira "Planejamento: ...").
- Se nenhum dente mencionado: [] e []
- observacao: se mais de um procedimento no mesmo dente, separar por \\n — cada linha vira um item independente marcável pelo dentista
- procedimentos: array de strings resumidas, mínimo 1 item baseado no relato
- procedimentos = INTERVENÇÕES (o que foi feito ou será feito: restauração, endodontia, exodontia, profilaxia…), NUNCA achados/diagnósticos. Cárie, pulpite, necrose, fratura, mobilidade, retração gengival são ACHADOS — descrevem o problema, vão em anotacoes/queixa_principal, jamais em procedimentos. Ex: relato "cárie oclusal no 14" → procedimento = "Restauração com resina composta", não "Cárie oclusal".
- O diagnóstico e o raciocínio clínico (ex: "pulpite irreversível confirmada por teste de vitalidade") entram em anotacoes — registrar, não descartar.
- GENERALIZAÇÃO: termo clínico fora do glossário → use o nome clínico padrão brasileiro do procedimento; o glossário ancora nomenclatura, não limita cobertura.
- conduta: string vazia "" se não houver orientações mencionadas
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;

    const result = await generateStructuredGemini<EvolucaoWire>({
      prompt,
      responseSchema: EVOLUCAO_SCHEMA,
      feature: 'formatar-evolucao',
    });

    const wire = result.data;

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

    const dentesAfetados = (wire.dentes_afetados ?? [])
      .map((d) => Number(d))
      .filter((d) => !isNaN(d) && (isValidFDI(d) || isArch(d))); // aceita dentes FDI e sentinelas de arcada (97/98/99)

    // Pares → Record (contrato do cliente). Duplicatas do mesmo dente concatenam com \n.
    const dentesObservacoes: Record<string, string> = {};
    const pares = Array.isArray(wire.dentes_observacoes) ? wire.dentes_observacoes : [];
    for (const par of pares) {
      if (!par || par.dente == null) continue;
      const dente = Number(par.dente);
      if (isNaN(dente)) continue;
      const key = String(dente);
      const texto = (par.observacao ?? '').trim();
      if (!texto) continue;
      dentesObservacoes[key] = dentesObservacoes[key] ? `${dentesObservacoes[key]}\n${texto}` : texto;
    }

    // Rede de segurança: nenhum dente detectado pode ficar sem observação (senão some do
    // orçamento/progresso, que derivam de dentes_observacoes). O prompt já exige isso;
    // aqui é o fallback caso o modelo escorregue. Rótulo genérico — o dentista revisa/edita
    // na tela "Confirmar evolução" antes de salvar.
    for (const dente of dentesAfetados) {
      const key = String(dente);
      if (!dentesObservacoes[key]?.trim()) {
        dentesObservacoes[key] = 'Procedimento a confirmar';
      }
    }

    const parsed: EvolucaoFormatada = {
      queixa_principal:   typeof wire.queixa_principal === 'string' ? wire.queixa_principal : '',
      anotacoes:          typeof wire.anotacoes === 'string' ? wire.anotacoes : '',
      dentes_afetados:    dentesAfetados,
      dentes_observacoes: dentesObservacoes,
      procedimentos: Array.isArray(wire.procedimentos)
        ? (wire.procedimentos as unknown[]).filter((p): p is string => typeof p === 'string')
        : [],
      conduta:            typeof wire.conduta === 'string' ? wire.conduta : '',
      alerta_novo:        typeof wire.alerta_novo === 'string' ? wire.alerta_novo : null,
    };

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
