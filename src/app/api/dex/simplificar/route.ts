import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';
import { generateText } from '@/lib/ai/provider';
import { logAICall } from '@/lib/ai/logger';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:simplificar', 20, 60_000);
  if (limited) return limited;

  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
  }

  let body: { orcamentoId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
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

  const callStart = Date.now();
  try {
    const result = await generateText({ prompt, feature: 'simplificar' });

    logAICall({
      feature:    'simplificar',
      provider:   result.provider,
      model:      result.model,
      latencyMs:  result.latencyMs,
      success:    true,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
    });

    return NextResponse.json({ texto: result.data, pacienteNome });
  } catch (err) {
    console.error('[dex/simplificar] Erro:', err);
    logAICall({
      feature:    'simplificar',
      provider:   'groq',
      model:      'llama-3.3-70b-versatile',
      latencyMs:  Date.now() - callStart,
      success:    false,
      dentistaId: dentista.id,
      clinicaId:  dentista.clinica_id,
      error:      err instanceof Error ? err.message : 'Erro interno',
    });
    return NextResponse.json({ error: 'Erro ao simplificar' }, { status: 500 });
  }
}
