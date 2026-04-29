import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/dex/briefing?agendamentoId=xxx
 * Gera um resumo pré-consulta do paciente usando IA.
 * Lê fichas anteriores, alergias, histórico de tratamentos.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const agendamentoId = req.nextUrl.searchParams.get('agendamentoId');
  if (!agendamentoId) return NextResponse.json({ error: 'agendamentoId obrigatório' }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });

  const supabase = await createClient();

  // Busca o agendamento com dados do paciente
  const { data: ag } = await supabase
    .from('agendamentos')
    .select('data_hora, duracao_minutos, observacoes, paciente:pacientes(id, nome, data_nascimento, telefone, observacoes)')
    .eq('id', agendamentoId)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });

  const paciente = ag.paciente as unknown as {
    id: string;
    nome: string;
    data_nascimento: string | null;
    telefone: string | null;
    observacoes: string | null;
  } | null;

  if (!paciente) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });

  // Busca últimas 3 fichas do paciente
  const { data: fichas } = await supabase
    .from('fichas')
    .select('created_at, queixa_principal, anotacoes, dentes_afetados')
    .eq('paciente_id', paciente.id)
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false })
    .limit(3);

  // Busca último orçamento aprovado
  const { data: ultimoOrc } = await supabase
    .from('orcamentos')
    .select('total, status, created_at, orcamento_itens(descricao)')
    .eq('paciente_id', paciente.id)
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Calcula idade
  const idadeStr = paciente.data_nascimento
    ? `${new Date().getFullYear() - new Date(paciente.data_nascimento).getFullYear()} anos`
    : 'idade não informada';

  const fichasTexto = (fichas ?? []).map((f, i) => {
    const data = new Date(f.created_at as string).toLocaleDateString('pt-BR');
    return `Consulta ${i + 1} (${data}): ${f.queixa_principal ?? ''} — ${f.anotacoes ?? 'sem anotações'}`;
  }).join('\n') || 'Nenhuma consulta anterior registrada.';

  const orcTexto = ultimoOrc
    ? `Último orçamento: R$ ${(ultimoOrc.total as number ?? 0).toFixed(2)} (${ultimoOrc.status})`
    : 'Sem orçamentos anteriores.';

  const hora = new Date(ag.data_hora as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const prompt = `Você é o DEX, assistente clínico de uma clínica odontológica.
Gere um briefing pré-consulta CONCISO (máximo 5 itens com bullet points •) para o dentista que vai atender este paciente agora.
Foque em: alergias, histórico recente, tratamentos em andamento, pontos de atenção.
Tom: direto, profissional, como se fosse um lembrete rápido antes de entrar no consultório.
Responda em português brasileiro.

DADOS DO PACIENTE:
Nome: ${paciente.nome}
Idade: ${idadeStr}
Horário: ${hora}
Observações do agendamento: ${(ag.observacoes as string | null) ?? 'nenhuma'}
Observações gerais: ${paciente.observacoes ?? 'nenhuma'}

HISTÓRICO DE FICHAS:
${fichasTexto}

${orcTexto}`;

  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const briefing = (result.text ?? '').trim();
    return NextResponse.json({ briefing, pacienteNome: paciente.nome, hora });
  } catch (err) {
    console.error('[dex/briefing] Erro Gemini:', err);
    return NextResponse.json({ error: 'Erro ao gerar briefing' }, { status: 500 });
  }
}
