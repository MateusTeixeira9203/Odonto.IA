import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface RequestBody {
  message: string;
  history: ChatMessage[];
}

/**
 * POST /api/dex/chat
 * Responde perguntas operacionais do DEX usando Gemini com contexto da clínica.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
  }

  const supabase = await createClient();
  const agora = new Date();
  const hojeInicio = new Date(agora);
  hojeInicio.setHours(0, 0, 0, 0);
  const hojeFim = new Date(agora);
  hojeFim.setHours(23, 59, 59, 999);
  const tresDiasAtras = new Date(agora);
  tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

  const [agendamentosRes, orcamentosRes, pacientesRes, followUpRes, aprovadosRes, futuroAgendsRes] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('data_hora, duracao_minutos, status, paciente:pacientes(nome), observacoes')
      .eq('clinica_id', dentista.clinica_id)
      .gte('data_hora', hojeInicio.toISOString())
      .lte('data_hora', hojeFim.toISOString())
      .not('status', 'eq', 'cancelado')
      .order('data_hora', { ascending: true })
      .limit(20),

    supabase
      .from('orcamentos')
      .select('status, total, paciente:pacientes(nome), created_at')
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['rascunho', 'enviado'])
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('pacientes')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id),

    // Follow-up: orçamentos enviados há >3 dias, com nome do paciente
    supabase
      .from('orcamentos')
      .select('paciente_id, total, updated_at, paciente:pacientes(nome)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'enviado')
      .lte('updated_at', tresDiasAtras.toISOString())
      .order('updated_at', { ascending: true })
      .limit(8),

    // Orçamentos aprovados sem agendamento futuro — passo 1: buscar aprovados com paciente
    supabase
      .from('orcamentos')
      .select('paciente_id, paciente:pacientes(nome)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'aprovado')
      .limit(50),

    // Passo 2: agendamentos futuros para cruzar
    supabase
      .from('agendamentos')
      .select('paciente_id')
      .eq('clinica_id', dentista.clinica_id)
      .gte('data_hora', agora.toISOString())
      .not('status', 'eq', 'cancelado'),
  ]);

  const agendaHoje = (agendamentosRes.data ?? []).map((ag) => {
    const hora = new Date(ag.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const pacienteNome = (ag.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente';
    return `${hora} - ${pacienteNome} (${ag.status})`;
  });

  const orcamentosPendentes = (orcamentosRes.data ?? []).map((o) => {
    const pacienteNome = (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente';
    return `${pacienteNome}: R$ ${(o.total ?? 0).toFixed(2)} (${o.status})`;
  });

  // Follow-up: pacientes com orçamento enviado parado há +3 dias
  const followUpPacientes = (followUpRes.data ?? []).map((o) => {
    const nome = (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente';
    const diasParado = Math.floor((agora.getTime() - new Date(o.updated_at as string).getTime()) / 86400000);
    return `${nome} (há ${diasParado} dias, R$ ${(o.total as number ?? 0).toFixed(2)})`;
  });

  // Cruzamento: aprovados sem agendamento futuro
  const futuroIds = new Set((futuroAgendsRes.data ?? []).map((a) => a.paciente_id as string));
  const semAgendamento = (aprovadosRes.data ?? [])
    .filter((o) => !futuroIds.has(o.paciente_id as string))
    .map((o) => (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente')
    .filter((nome, idx, arr) => arr.indexOf(nome) === idx) // deduplica
    .slice(0, 6);

  const systemPrompt = `Você é o DEX, assistente clínico de IA integrado ao DentIA — sistema de gestão odontológica.
Você é direto, prestativo e fala em português brasileiro informal mas profissional.
Responda em no máximo 3 frases curtas, salvo quando listar dados estruturados ou gerar mensagens de texto.
Nunca invente dados — use apenas as informações fornecidas abaixo.

═══════════════════════════════════════
CONTEXTO DO DIA (${agora.toLocaleDateString('pt-BR')})
═══════════════════════════════════════
- Dentista: ${dentista.nome} (${dentista.role})
- Total de pacientes cadastrados: ${pacientesRes.count ?? 0}

Agenda de hoje (${agendaHoje.length} consulta${agendaHoje.length !== 1 ? 's' : ''}):
${agendaHoje.length > 0 ? agendaHoje.map(a => `  • ${a}`).join('\n') : '  Nenhuma consulta hoje.'}

Orçamentos aguardando aprovação (${orcamentosPendentes.length}):
${orcamentosPendentes.length > 0 ? orcamentosPendentes.map(o => `  • ${o}`).join('\n') : '  Nenhum orçamento pendente.'}

Orçamentos enviados sem retorno há +3 dias — PRIORIDADE DE FOLLOW-UP (${followUpPacientes.length}):
${followUpPacientes.length > 0 ? followUpPacientes.map(p => `  • ${p}`).join('\n') : '  Nenhum.'}

Pacientes com orçamento APROVADO mas sem agendamento futuro — OPORTUNIDADE DE AGENDA (${semAgendamento.length}):
${semAgendamento.length > 0 ? semAgendamento.map(p => `  • ${p}`).join('\n') : '  Nenhum.'}

═══════════════════════════════════════
SUAS CAPACIDADES — responda com precisão quando perguntado
═══════════════════════════════════════
1. AGENDA: mostrar consultas do dia, próximo paciente, horário e status.
2. ORÇAMENTOS: listar pendentes de aprovação, identificar quem precisa de follow-up.
3. BRIEFING PRÉ-CONSULTA: gerar resumo do próximo paciente com histórico, queixas e alertas.
4. PERFIL DO PACIENTE: quando no perfil de um paciente, responder sobre histórico, alergias, fichas e orçamentos.
5. NAVEGAÇÃO: orientar sobre onde encontrar cada função — pacientes, orçamentos, agenda, financeiro, configurações.
6. FINANCEIRO: explicar custo por hora clínica, orientar registro de despesas e interpretação do fluxo de caixa.
7. FICHAS E DOCUMENTOS: explicar como preencher fichas clínicas e gerar atestados, receitas e termos.
8. APRESENTAÇÃO AO PACIENTE: explicar como montar slides com IA para apresentar o plano de tratamento.
9. FOLLOW-UP: identificar pacientes parados e GERAR MENSAGENS DE WHATSAPP prontas para copiar.
10. AGENDAMENTO INTELIGENTE: cruzar pacientes com orçamento aprovado sem consulta marcada para sugerir quem agendar.
11. ANIVERSÁRIOS: informar sobre pacientes aniversariantes do dia e gerar mensagem de parabéns.
12. SUGESTÕES PROATIVAS: sempre que o contexto indicar uma ação útil, sugerí-la proativamente.

═══════════════════════════════════════
COMO GERAR MENSAGEM DE FOLLOW-UP (WhatsApp)
═══════════════════════════════════════
Quando o dentista pedir para enviar ou gerar uma mensagem de follow-up para um paciente:
1. Use um tom cordial e profissional, como se fosse o próprio dentista escrevendo.
2. Mencione o nome do paciente.
3. Referencie o orçamento ou tratamento de forma natural, sem revelar valores a menos que pedido.
4. Inclua uma chamada para ação clara (confirmar interesse, agendar, tirar dúvidas).
5. Mantenha a mensagem curta — no máximo 4 linhas.
6. Formate o texto pronto para copiar, precedido de: "Mensagem pronta para copiar:"

Exemplo de saída:
Mensagem pronta para copiar:
"Olá, [Nome]! Tudo bem? Passando para verificar se ficou alguma dúvida sobre o plano de tratamento que conversamos. Quando quiser, é só me chamar para agendarmos! 😊"

═══════════════════════════════════════
REGRAS
═══════════════════════════════════════
- Se perguntado "o que você faz?", liste todas as 12 capacidades de forma clara.
- Ao sugerir ação, seja específico: diga o que fazer e onde.
- Nunca responda sobre diagnósticos médicos, prescrições ou assuntos não relacionados à clínica.
- Se não tiver dados suficientes, diga claramente o que está faltando.`;

  const genai = new GoogleGenAI({ apiKey });

  try {
    const chat = genai.chats.create({
      model: 'gemini-2.0-flash',
      config: { systemInstruction: systemPrompt },
      history: (body.history ?? []).slice(-10),
    });

    const result = await chat.sendMessage({ message: body.message });
    const text = result.text ?? 'Não consegui gerar uma resposta. Tente novamente.';

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error('[dex/chat] Erro Gemini:', err);
    return NextResponse.json({ error: 'Erro ao processar resposta.' }, { status: 500 });
  }
}
