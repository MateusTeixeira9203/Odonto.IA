import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { cancelarConvite, renovarConvite } from '@/server/services/invites';

// Resolução canônica: users.active_clinica_id → clinica_usuarios (não dentistas)
async function resolveAdminCtx(user: { id: string }) {
  const supabase = await createClient();

  const { data: userRecord } = await supabase
    .from('users')
    .select('active_clinica_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!userRecord?.active_clinica_id) return null;
  const clinicId = userRecord.active_clinica_id as string;

  const db = createServiceClient();
  const { data: membership } = await db
    .from('clinica_usuarios')
    .select('role')
    .eq('usuario_id', user.id)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (!membership || membership.role !== 'admin') return null;

  return {
    userId:   user.id,
    clinicId,
    role:     membership.role as string,
  };
}

// DELETE — cancelar convite pendente
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const ctx = await resolveAdminCtx(user);
  if (!ctx) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const result = await cancelarConvite(ctx, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true });
}

// PATCH — renovar convite expirado/cancelado
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const ctx = await resolveAdminCtx(user);
  if (!ctx) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

  const result = await renovarConvite(ctx, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true, link: result.link });
}
