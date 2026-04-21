import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createServiceClient } from '@/lib/supabase/service';
import { getInstanceForClinica } from '@/services/whatsapp.service';
import { processMessage, type ConversaBot } from '@/lib/whatsapp/message-handler';
import { STATES } from '@/lib/whatsapp/states';

/**
 * POST /api/whatsapp/testar-fluxo
 * Reseta a conversa do número informado e dispara o fluxo completo do DEX,
 * como se fosse um paciente novo chegando pelo WhatsApp.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (dentista.role !== 'admin' && dentista.role !== 'secretaria') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  let body: { numero?: string };
  try { body = await req.json() as typeof body; } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const numero = (body.numero ?? '').replace(/\D/g, '');
  if (numero.length < 10) {
    return NextResponse.json({ error: 'Número inválido — use DDI + DDD + número (mín. 10 dígitos)' }, { status: 400 });
  }

  const instancia = await getInstanceForClinica(dentista.clinica_id);
  if (!instancia || instancia.status !== 'connected') {
    return NextResponse.json({ error: 'WhatsApp não está conectado' }, { status: 400 });
  }
  if (!instancia.instanceName) {
    return NextResponse.json({ error: 'Instância sem nome configurado' }, { status: 500 });
  }

  const db = createServiceClient();

  // Desativa conversas anteriores desse número nessa clínica
  await db
    .from('conversas_bot')
    .update({ ativo: false })
    .eq('clinica_id', dentista.clinica_id)
    .eq('telefone', numero);

  // Cria nova conversa de teste simulando paciente novo
  const { data: novaConversa, error } = await db
    .from('conversas_bot')
    .insert({
      clinica_id: dentista.clinica_id,
      telefone:   numero,
      etapa:      STATES.INICIO,
      contexto:   { paciente_nome: 'Teste DEX', is_novo_paciente: true },
      ativo:      true,
    })
    .select()
    .single();

  if (error || !novaConversa) {
    console.error('[testar-fluxo] Erro ao criar conversa:', error);
    return NextResponse.json({ error: 'Erro ao criar conversa de teste' }, { status: 500 });
  }

  try {
    await processMessage(novaConversa as ConversaBot, 'oi', instancia.instanceName);
  } catch (err) {
    console.error('[testar-fluxo] Erro ao iniciar fluxo:', err);
    return NextResponse.json({ error: 'Erro ao iniciar fluxo de teste' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
