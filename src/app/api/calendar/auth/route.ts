import { NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { getGoogleAuthUrl } from '@/lib/calendar/google-provider';

/**
 * GET /api/calendar/auth
 * Inicia o fluxo OAuth2 do Google Calendar.
 * Redireciona para a página de autorização do Google.
 */
export async function GET(): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? ''));
  }

  const authUrl = getGoogleAuthUrl(dentista.id);
  return NextResponse.redirect(authUrl);
}
