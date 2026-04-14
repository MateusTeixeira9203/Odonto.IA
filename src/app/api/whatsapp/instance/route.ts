/**
 * /api/whatsapp/instance
 *
 * POST   — cria instância Evolution API para a clínica
 * GET    — retorna status + QR Code da instância ativa
 * DELETE — desconecta e remove a instância
 *
 * Todos os métodos exigem role = 'admin' ou 'secretaria'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  createInstance,
  getQRCode,
  getInstanceStatus,
  deleteInstance,
  mapEvolutionStatus,
} from '@/lib/whatsapp/evolution-admin';

// ─── Guard de autenticação ────────────────────────────────────────────────────

async function getAuthorizedClinica(): Promise<{ clinicaId: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('dentistas')
    .select('clinica_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data || (data.role !== 'admin' && data.role !== 'secretaria')) return null;
  return { clinicaId: data.clinica_id as string };
}

// ─── POST — criar instância ───────────────────────────────────────────────────

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const auth = await getAuthorizedClinica();
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const db = createServiceClient();

  // Verifica se já existe instância ativa
  const { data: existente } = await db
    .from('instancias_whatsapp')
    .select('id, instance_name, status')
    .eq('clinica_id', auth.clinicaId)
    .maybeSingle();

  if (existente && existente.status !== 'inactive') {
    return NextResponse.json({ error: 'Já existe uma instância ativa para esta clínica.' }, { status: 409 });
  }

  const instanceName = `dentai-${auth.clinicaId.replace(/-/g, '').slice(0, 10)}`;

  try {
    const result = await createInstance(instanceName);

    // Upsert na tabela
    await db.from('instancias_whatsapp').upsert({
      clinica_id:    auth.clinicaId,
      instance_name: instanceName,
      status:        'connecting',
      qrcode:        result.qrcode,
      last_qrcode_at: result.qrcode ? new Date().toISOString() : null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'clinica_id' });

    return NextResponse.json({
      ok:           true,
      instanceName: result.instanceName,
      qrcode:       result.qrcode,
      status:       'connecting',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET — status e QR Code ───────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const auth = await getAuthorizedClinica();
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const db = createServiceClient();

  const { data: instancia } = await db
    .from('instancias_whatsapp')
    .select('id, instance_name, status, qrcode')
    .eq('clinica_id', auth.clinicaId)
    .maybeSingle();

  if (!instancia) {
    return NextResponse.json({ status: 'none' });
  }

  const instanceName = instancia.instance_name as string;

  // Consulta status ao vivo na Evolution API
  const rawState   = await getInstanceStatus(instanceName);
  const novoStatus = mapEvolutionStatus(rawState);

  // Busca QR Code se ainda conectando
  let qrcode = instancia.qrcode as string | null;
  if (novoStatus === 'connecting') {
    const novoQr = await getQRCode(instanceName);
    if (novoQr) qrcode = novoQr;
  } else if (novoStatus === 'connected') {
    qrcode = null; // limpa QR code após conexão
  }

  // Atualiza DB com status atual
  await db
    .from('instancias_whatsapp')
    .update({
      status:     novoStatus,
      qrcode:     qrcode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', instancia.id as string);

  return NextResponse.json({ status: novoStatus, qrcode, instanceName });
}

// ─── DELETE — desconectar ─────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest): Promise<NextResponse> {
  const auth = await getAuthorizedClinica();
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  const db = createServiceClient();

  const { data: instancia } = await db
    .from('instancias_whatsapp')
    .select('id, instance_name')
    .eq('clinica_id', auth.clinicaId)
    .maybeSingle();

  if (!instancia) return NextResponse.json({ ok: true });

  try {
    await deleteInstance(instancia.instance_name as string);
  } catch (err) {
    console.error('[instance DELETE] Evolution API error:', err);
    // Continua para remover do banco mesmo se a API falhar
  }

  await db
    .from('instancias_whatsapp')
    .update({ status: 'inactive', qrcode: null, updated_at: new Date().toISOString() })
    .eq('id', instancia.id as string);

  return NextResponse.json({ ok: true });
}
