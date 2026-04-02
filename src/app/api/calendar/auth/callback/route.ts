import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/calendar/google-provider';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * GET /api/calendar/auth/callback?code=...&state=<dentistaId>
 * Recebe o código OAuth2 do Google, troca pelos tokens e redireciona para a agenda.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get('code');
  const dentistaId = searchParams.get('state');
  const error = searchParams.get('error');

  // Usuário negou o acesso
  if (error || !code || !dentistaId) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/agendamentos?calendar=denied`
    );
  }

  try {
    await exchangeCodeForTokens(code, dentistaId);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/agendamentos?calendar=connected`
    );
  } catch (err) {
    console.error('[calendar/callback] Erro ao trocar código:', err);
    return NextResponse.redirect(
      `${APP_URL}/dashboard/agendamentos?calendar=error`
    );
  }
}
