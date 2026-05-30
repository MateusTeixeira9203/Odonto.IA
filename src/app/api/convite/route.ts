import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { criarConvite } from '@/server/services/invites';

// POST — admin convida dentista
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Resolução canônica: users.active_clinica_id → clinica_usuarios (não dentistas)
  const { data: userRecord } = await supabase
    .from('users')
    .select('active_clinica_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) {
    return NextResponse.json({ error: 'Clínica ativa não encontrada' }, { status: 403 });
  }

  const clinicId = userRecord.active_clinica_id as string;

  const db = createServiceClient();
  const { data: membership } = await db
    .from('clinica_usuarios')
    .select('role')
    .eq('usuario_id', user.id)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem convidar dentistas' }, { status: 403 });
  }

  let body: { email: string };
  try {
    body = (await request.json()) as { email: string };
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 });
  }

  const result = await criarConvite(
    { userId: user.id, clinicId, role: membership.role },
    { email: body.email },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, link: result.link });
}
