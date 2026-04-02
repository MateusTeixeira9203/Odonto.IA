import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/convite/:id — cancela convite pendente (admin/dentista)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: dentista } = await supabase
    .from('dentistas')
    .select('clinica_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!dentista || !['admin', 'dentista'].includes(dentista.role as string)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const { error } = await supabase
    .from('convites')
    .delete()
    .eq('id', id)
    .eq('clinica_id', dentista.clinica_id);

  if (error) {
    console.error('Erro ao deletar convite:', error);
    return NextResponse.json({ error: 'Erro ao cancelar convite' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
