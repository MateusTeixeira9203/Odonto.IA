/**
 * POST /api/whatsapp/enviar-teste
 *
 * Envia uma mensagem de teste para validar que a instância está funcionando.
 * Requer role = 'admin' ou 'secretaria'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstanceForClinica, sendMessage } from '@/services/whatsapp.service';

// Resolução canônica: users.active_clinica_id → clinica_usuarios (não dentistas)
async function getAuthorizedClinica(): Promise<{ clinicaId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRecord } = await supabase
    .from('users')
    .select('active_clinica_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) return null;
  const clinicId = userRecord.active_clinica_id as string;

  const { data: membership } = await supabase
    .from('clinica_usuarios')
    .select('role')
    .eq('usuario_id', user.id)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!membership || (membership.role !== 'admin' && membership.role !== 'secretaria')) {
    return null;
  }

  return { clinicaId: clinicId };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await getAuthorizedClinica();
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  let body: { numero?: string; mensagem?: string };
  try {
    body = await req.json() as { numero?: string; mensagem?: string };
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const numero   = body.numero?.replace(/\D/g, '').trim();
  const mensagem = body.mensagem?.trim();

  if (!numero || numero.length < 10) {
    return NextResponse.json({ error: 'Número inválido. Use o formato: 5511999999999' }, { status: 400 });
  }
  if (!mensagem) {
    return NextResponse.json({ error: 'Mensagem não pode ser vazia' }, { status: 400 });
  }

  const instancia = await getInstanceForClinica(auth.clinicaId);
  if (!instancia || instancia.status !== 'connected') {
    return NextResponse.json(
      { error: 'WhatsApp não está conectado. Conecte primeiro antes de enviar.' },
      { status: 409 },
    );
  }

  try {
    await sendMessage(instancia.instanceName, numero, mensagem);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
