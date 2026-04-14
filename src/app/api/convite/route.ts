import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isSuperUser } from '@/lib/super-user';

// POST — envia convite via Supabase Auth (admin ou secretaria autenticados)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: dentista } = await supabase
    .from('dentistas')
    .select('id, clinica_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!dentista || !['admin', 'secretaria'].includes(dentista.role as string)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  let body: { email: string; role: 'dentista' | 'secretaria' };
  try {
    body = (await request.json()) as { email: string; role: 'dentista' | 'secretaria' };
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const { email, role } = body;

  if (!email || !['dentista', 'secretaria'].includes(role)) {
    return NextResponse.json({ error: 'email e role são obrigatórios' }, { status: 400 });
  }

  // Verifica limite de dentistas — super-usuário não tem limite
  if (role === 'dentista' && !isSuperUser(user.email)) {
    const [{ data: clinica }, { count }] = await Promise.all([
      supabase
        .from('clinicas')
        .select('limite_dentistas')
        .eq('id', dentista.clinica_id)
        .single(),
      supabase
        .from('dentistas')
        .select('*', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .neq('role', 'secretaria')
        .eq('ativo', true),
    ]);

    if (clinica && count !== null && count >= clinica.limite_dentistas) {
      return NextResponse.json(
        { error: `Limite de ${clinica.limite_dentistas} dentistas atingido` },
        { status: 400 }
      );
    }
  }

  // Verifica se já existe convite pendente para este email
  const { data: conviteExistente } = await supabase
    .from('convites')
    .select('id')
    .eq('clinica_id', dentista.clinica_id)
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (conviteExistente) {
    return NextResponse.json(
      { error: 'Já existe um convite pendente para este email' },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const service = createServiceClient();

  // Envia convite — redireciona para /auth/callback que cria o dentista automaticamente
  const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (inviteError) {
    if (inviteError.message?.includes('already been registered')) {
      return NextResponse.json(
        { error: 'Este email já possui uma conta no DentIA' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `Erro ao enviar convite: ${inviteError.message}` },
      { status: 500 }
    );
  }

  console.log('[convite] inviteUserByEmail OK, user id:', inviteData?.user?.id);

  // Registra na tabela convites (service role — funciona para qualquer role)
  await service.from('convites').insert({
    clinica_id: dentista.clinica_id,
    email,
    role,
    token: crypto.randomUUID(),
  });

  return NextResponse.json({ success: true });
}
