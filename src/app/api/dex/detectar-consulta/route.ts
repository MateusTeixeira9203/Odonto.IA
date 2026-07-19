import { NextRequest, NextResponse } from 'next/server';
import { Type, type Schema } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { withRateLimit } from '@/lib/rate-limit';
import { generateStructuredGemini } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';
import { buildDentalContext } from '@/lib/odonto-dictionary';
import { isArch } from '@/lib/arcadas';

/**
 * Detecção ao vivo do Modo Consulta (spec fase1-5, adendo 13/07 §H).
 *
 * Alimenta o painel "Detectando ao vivo" enquanto o dentista dita/escreve. Antes o
 * painel reusava /api/sugerir-orcamento (máx. 10 itens, agrupamento de orçamento) e
 * divergia da ficha final — procedimento sumia do preview mas aparecia ao organizar.
 * Esta rota usa a mesma família de prompt/cérebro do organizador, com schema mínimo:
 * só "o que foi mencionado, em quais dentes". Sem tabela de preços, sem ficha.
 */

export interface ProcedimentoDetectado {
  descricao: string;
  dentes: number[];
  status: 'indicado' | 'realizado';   // NOVO (§3.2) — dirige a cor do chip (coral/teal) ao vivo
}

const DETECCAO_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ['procedimentos'],
  properties: {
    procedimentos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['descricao', 'dentes', 'status'],
        properties: {
          descricao: { type: Type.STRING },
          dentes:    { type: Type.ARRAY, items: { type: Type.INTEGER } },
          status:    { type: Type.STRING, enum: ['indicado', 'realizado'] },
        },
      },
    },
  },
};

const isValidFDI = (d: number): boolean => {
  const q = Math.floor(d / 10);
  const t = d % 10;
  if (q >= 1 && q <= 4) return t >= 1 && t <= 8; // permanentes
  if (q >= 5 && q <= 8) return t >= 1 && t <= 5; // decíduos
  return false;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Bucket próprio, mais folgado que o do organizador: dispara por pausa de digitação.
  const limited = await withRateLimit(req, 'dex:detectar-consulta', 30, 60_000);
  if (limited) return limited;

  try {
    const dentista = await getDentistaCached();
    if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    let body: { texto: string };
    try {
      body = (await req.json()) as { texto: string };
    } catch {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }

    if (!body.texto?.trim()) return NextResponse.json({ error: 'Texto vazio' }, { status: 400 });

    const prompt = `Você é o copiloto de um dentista durante a consulta. O texto abaixo é o relato PARCIAL, ainda sendo ditado — seu trabalho é só listar o que já foi mencionado, para feedback visual imediato.

${buildDentalContext()}

RELATO PARCIAL DO DENTISTA:
"${body.texto}"

Liste TODOS os procedimentos mencionados até aqui — realizados, indicados/planejados e notas de planejamento — cada um com os dentes FDI envolvidos.

Regras:
- descricao: nome clínico curto do procedimento (ex: "Tratamento endodôntico", "Exodontia simples").
- status: "realizado" se o dentista falou no passado / que já fez; "indicado" se é a fazer, planejado, ou apenas o achado (intervenção ainda não feita). Na dúvida, "indicado".
- ACHADO ≠ procedimento: cárie/pulpite/fratura são achados — liste a intervenção correspondente (cárie → Restauração), nunca o achado.
- Arcada/boca inteira: use sentinelas em dentes (99 boca toda, 97 arcada superior, 98 arcada inferior). Não liste dentes individuais nesses casos.
- Nota de planejamento/coordenação (preparo, encaminhamento, avaliação futura, sem intervenção executável): descricao prefixada com "Planejamento: ".
- NÃO invente dente nem procedimento que não foi dito. dentes: [] quando nenhum dente específico foi citado para aquele procedimento.
- O relato vem de transcrição de voz: corrija erro fonético óbvio pelo contexto clínico, sem inventar conteúdo.
- Português brasileiro.`;

    const result = await generateStructuredGemini<{ procedimentos: ProcedimentoDetectado[] }>({
      prompt,
      responseSchema: DETECCAO_SCHEMA,
      feature: 'detectar-consulta',
      maxOutputTokens: 2_048,
    });

    const procedimentos = (Array.isArray(result.data.procedimentos) ? result.data.procedimentos : [])
      .filter((p): p is ProcedimentoDetectado => !!p && typeof p.descricao === 'string' && !!p.descricao.trim())
      .map((p): ProcedimentoDetectado => ({
        descricao: p.descricao.trim(),
        dentes: (Array.isArray(p.dentes) ? p.dentes : [])
          .map(Number)
          .filter((d) => !isNaN(d) && (isValidFDI(d) || isArch(d))),
        status: p.status === 'realizado' ? 'realizado' : 'indicado', // default seguro: a fazer
      }));

    logAICall({
      feature:    'detectar-consulta',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json({ procedimentos });
  } catch (err) {
    console.error('[dex/detectar-consulta] Erro:', err);
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
