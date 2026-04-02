import { NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { revokeGoogleTokens } from '@/lib/calendar/google-provider';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * POST /api/calendar/disconnect
 * Revoga os tokens do Google Calendar e remove do banco.
 */
export async function POST(): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    await revokeGoogleTokens(dentista.id);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/agendamentos?calendar=disconnected`
    );
  } catch (err) {
    console.error('[calendar/disconnect] Erro:', err);
    return NextResponse.json({ error: 'Erro ao desconectar' }, { status: 500 });
  }
}
