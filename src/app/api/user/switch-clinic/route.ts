import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/switch-clinic
 * Troca a clínica ativa do usuário.
 *
 * Segurança:
 * - Valida membership ativa antes de atualizar.
 * - Usuário jamais pode trocar para clínica sem membership ativa.
 * - Usa service client apenas após validação de auth + membership.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
  }

  let clinicId: string;
  try {
    const body = await request.json() as { clinicId?: unknown };
    if (!body.clinicId || typeof body.clinicId !== 'string') throw new Error('invalid');
    clinicId = body.clinicId;
  } catch {
    return NextResponse.json({ success: false, error: 'clinicId inválido ou ausente' }, { status: 400 });
  }

  const service = createServiceClient();

  // Valida membership ativa — nunca confiar apenas no input do cliente
  const { data: membership } = await service
    .from('clinica_usuarios')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { success: false, error: 'Acesso não autorizado a esta clínica' },
      { status: 403 },
    );
  }

  const { error } = await service
    .from('users')
    .update({ active_clinica_id: clinicId })
    .eq('id', user.id);

  if (error) {
    console.error('[POST /api/user/switch-clinic]', error);
    return NextResponse.json({ success: false, error: 'Erro ao trocar clínica' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
