/**
 * GET /api/whatsapp/run-reminders
 *
 * Endpoint para execução do cron de lembretes.
 * Protegido por CRON_SECRET no header Authorization.
 *
 * Exemplo de chamada (Vercel Cron Jobs / cron externo):
 *   GET /api/whatsapp/run-reminders
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendReminders } from '@/lib/whatsapp/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Valida segredo do cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const resultado = await sendReminders();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-reminders] Erro:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
