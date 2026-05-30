import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ClinicaUsuarioRow = {
  clinica_id: string;
  role: string;
  clinicas: { id: string; nome: string } | { id: string; nome: string }[] | null;
};

/**
 * GET /api/user/clinicas
 * Retorna todas as clínicas com membership ativa do usuário autenticado.
 * Usa service client para contornar RLS (que filtra por active_clinica_id).
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from('clinica_usuarios')
    .select('clinica_id, role, clinicas(id, nome)')
    .eq('usuario_id', user.id)
    .eq('status', 'ativo');

  if (error) {
    console.error('[GET /api/user/clinicas]', error);
    return NextResponse.json({ success: false, error: 'Erro ao buscar clínicas' }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as ClinicaUsuarioRow[];

  const clinicas = rows.map((row) => {
    const ref = row.clinicas;
    const clinica = Array.isArray(ref) ? ref[0] : ref;
    return {
      id: row.clinica_id,
      nome: clinica?.nome ?? '',
      role: row.role,
    };
  });

  return NextResponse.json({ success: true, data: clinicas });
}
