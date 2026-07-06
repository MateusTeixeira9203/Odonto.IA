import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

interface SugerirOrcamentoBody {
  texto: string;
  // clinicaId removido — resolvido server-side a partir de users.active_clinica_id.
  // Aceitar clinicaId do cliente sem validação permitiria ler tabelas de preços de qualquer clínica.
}

export interface ItemSugerido {
  descricao: string;
  quantidade: number;
  precoSugerido: number | null;
}

/**
 * POST /api/sugerir-orcamento
 * Recebe o texto de uma evolução clínica e usa Gemini para identificar
 * procedimentos odontológicos e sugerir um rascunho de orçamento.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // Resolve clínica ativa — fonte canônica é users.active_clinica_id, não o body do cliente
  const { data: userRecord } = await supabase
    .from('users')
    .select('active_clinica_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) {
    return NextResponse.json({ error: 'Clínica não encontrada.' }, { status: 403 });
  }

  const clinicId = userRecord.active_clinica_id as string;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }

  let body: SugerirOrcamentoBody;
  try {
    body = (await req.json()) as SugerirOrcamentoBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  if (!body.texto?.trim()) {
    return NextResponse.json({ error: '"texto" é obrigatório.' }, { status: 400 });
  }

  // Busca procedimentos da clínica ativa (clinicId resolvido server-side)
  const { data: procedimentosClinica } = await supabase
    .from('procedimentos')
    .select('nome, preco_padrao')
    .eq('clinica_id', clinicId)
    .eq('ativo', true)
    .order('nome');

  const tabelaPrecos =
    procedimentosClinica && procedimentosClinica.length > 0
      ? `\nTabela de preços da clínica (use como referência):\n` +
        procedimentosClinica
          .map((p) => `- ${p.nome}: R$ ${(p.preco_padrao ?? 0).toFixed(2)}`)
          .join('\n')
      : '';

  const prompt = `Você é um assistente odontológico especializado em orçamentos.
Analise esta evolução clínica e identifique os procedimentos odontológicos mencionados.
Para cada procedimento, sugira um item de orçamento com descrição clara para o paciente, quantidade e preço.
${tabelaPrecos}

Evolução clínica:
"${body.texto}"

Retorne APENAS um JSON válido (sem markdown, sem blocos de código) com este formato exato:
{
  "itens": [
    { "descricao": "Restauração em resina composta – dente 46", "quantidade": 1, "precoSugerido": 250.00 }
  ]
}

Regras:
- Use nomes simples e compreensíveis para o paciente.
- Se um dente específico foi mencionado, inclua no nome do procedimento.
- Se não houver preço na tabela da clínica, use null para precoSugerido.
- Máximo de 10 itens.
- Se não identificar procedimentos, retorne { "itens": [] }.`;

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = (response.text ?? '').replace(/```(?:json)?/g, '').replace(/```/g, '').trim();

    let parsed: { itens?: ItemSugerido[] };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      console.error('[sugerir-orcamento] Resposta Gemini não é JSON válido:', text);
      return NextResponse.json({ error: 'Resposta inválida da IA.' }, { status: 500 });
    }

    const itens = (parsed.itens ?? []).filter(
      (i) => typeof i.descricao === 'string' && i.descricao.trim(),
    );

    return NextResponse.json({ itens });
  } catch (err) {
    console.error('[sugerir-orcamento] Erro Gemini:', err);
    return NextResponse.json({ error: 'Erro ao processar com IA.' }, { status: 500 });
  }
}
