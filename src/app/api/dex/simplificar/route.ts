import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/dex/simplificar
 * Traduz um orçamento técnico para linguagem acessível ao paciente.
 * Body: { orcamentoId: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });

  let body: { orcamentoId?: string };
  try { body = (await req.json()) as typeof body; } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }
  if (!body.orcamentoId) return NextResponse.json({ error: 'orcamentoId obrigatório' }, { status: 400 });

  const supabase = await createClient();

  const { data: orc } = await supabase
    .from('orcamentos')
    .select('total, desconto, paciente:pacientes(nome), orcamento_itens(descricao, quantidade, preco_unitario, preco_total)')
    .eq('id', body.orcamentoId)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!orc) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

  const pacienteNome = (orc.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente';
  const itens = (orc.orcamento_itens as unknown as Array<{
    descricao: string; quantidade: number; preco_unitario: number; preco_total: number;
  }>) ?? [];

  const itensTexto = itens.map(i =>
    `• ${i.descricao} (${i.quantidade}x) — R$ ${(i.preco_total ?? 0).toFixed(2)}`
  ).join('\n');

  const desconto = (orc.desconto as number) ?? 0;
  const total = (orc.total as number) ?? 0;

  const prompt = `Você é o DEX, assistente de uma clínica odontológica.
Reescreva o orçamento abaixo em linguagem simples e amigável para o paciente ${pacienteNome}.
Explique cada procedimento em termos que qualquer pessoa entenda, sem jargões técnicos.
Use um tom acolhedor, objetivo e transparente.
Inclua o total ao final.
Responda em português brasileiro, pronto para ser enviado pelo WhatsApp (sem markdown, texto puro).

ORÇAMENTO TÉCNICO:
${itensTexto}
${desconto > 0 ? `Desconto: R$ ${desconto.toFixed(2)}` : ''}
Total: R$ ${total.toFixed(2)}`;

  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    const texto = (result.text ?? '').trim();
    return NextResponse.json({ texto, pacienteNome });
  } catch (err) {
    console.error('[dex/simplificar] Erro Gemini:', err);
    return NextResponse.json({ error: 'Erro ao simplificar' }, { status: 500 });
  }
}
