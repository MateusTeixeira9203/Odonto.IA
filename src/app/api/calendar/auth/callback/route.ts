import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/calendar/google-provider';
import { createClient } from '@/lib/supabase/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * GET /api/calendar/auth/callback?code=...&state=<dentistaId>
 * Recebe o código OAuth2 do Google, valida que o dentistaId pertence ao
 * usuário autenticado + clínica ativa, troca pelos tokens e redireciona.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get('code');
  const dentistaId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !dentistaId) {
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=denied`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=denied`);
  }

  // Resolve clínica ativa
  const { data: userRecord } = await supabase
    .from('users')
    .select('active_clinica_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) {
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=error`);
  }

  // Valida que o dentistaId do state pertence ao usuário autenticado e à sua clínica ativa
  const { data: dentista } = await supabase
    .from('dentistas')
    .select('id')
    .eq('id', dentistaId)
    .eq('user_id', user.id)
    .eq('clinica_id', userRecord.active_clinica_id)
    .maybeSingle();

  if (!dentista) {
    console.error('[calendar/callback] dentistaId inválido ou não pertence ao usuário:', {
      dentistaId,
      userId: user.id,
      clinicId: userRecord.active_clinica_id,
    });
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=error`);
  }

  try {
    await exchangeCodeForTokens(code, dentistaId);
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=connected`);
  } catch (err) {
    console.error('[calendar/callback] Erro ao trocar código:', err);
    return NextResponse.redirect(`${APP_URL}/dashboard/agendamentos?calendar=error`);
  }
}
