import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST — aceita convite após signup com sessão imediata
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let token: string;
  try {
    const body = (await request.json()) as { token: string };
    token = body.token;
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 });
  }

  const service = createServiceClient();

  // Valida token via SECURITY DEFINER (funciona sem auth)
  const { data, error: rpcError } = await service.rpc('get_convite_by_token', { p_token: token });

  if (rpcError || !data || (data as unknown[]).length === 0) {
    return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 404 });
  }

  const convite = (data as Array<{
    id: string;
    clinica_id: string;
    email: string;
    role: string;
  }>)[0];

  // Verifica se o email do convite bate com o do usuário
  if (convite.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'Este convite é para outro email' }, { status: 403 });
  }

  // Verifica se já tem dentista (não duplicar)
  const { data: existing } = await service
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Já tem cadastro — apenas apaga o convite e retorna ok
    await service.from('convites').delete().eq('token', token);
    return NextResponse.json({ success: true });
  }

  // Cria o dentista com os dados do convite (service role para ignorar RLS de clinica_id)
  const { error: insertError } = await service.from('dentistas').insert({
    user_id: user.id,
    clinica_id: convite.clinica_id,
    nome: (user.user_metadata as { nome?: string }).nome ?? user.email ?? 'Sem nome',
    email: user.email ?? null,
    role: convite.role,
    ativo: true,
  });

  if (insertError) {
    console.error('Erro ao criar dentista via convite:', insertError);
    return NextResponse.json({ error: 'Erro ao criar cadastro' }, { status: 500 });
  }

  // Remove convite usado
  await service.from('convites').delete().eq('token', token);

  return NextResponse.json({ success: true });
}
