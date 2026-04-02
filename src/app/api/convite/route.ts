import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST — envia convite via Supabase Auth (admin/dentista autenticado)
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[convite] INICIO');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[convite] user:', user?.id ?? 'NÃO AUTENTICADO');

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: dentista } = await supabase
    .from('dentistas')
    .select('id, clinica_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  console.log('[convite] dentista:', dentista);

  if (!dentista || !['admin', 'dentista'].includes(dentista.role as string)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  let body: { email: string; role: 'dentista' | 'secretaria' };
  try {
    body = (await request.json()) as { email: string; role: 'dentista' | 'secretaria' };
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
  }

  const { email, role } = body;
  console.log('[convite] email, role:', email, role);

  if (!email || !['dentista', 'secretaria'].includes(role)) {
    return NextResponse.json({ error: 'email e role são obrigatórios' }, { status: 400 });
  }

  // Verifica limite de dentistas
  if (role === 'dentista') {
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

  // Verifica se já tem convite pendente para este email
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

  // Usa a origem do request para garantir que o callback vá para o mesmo
  // ambiente (localhost em dev, domínio real em produção).
  const origin = new URL(request.url).origin;

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (err) {
    console.error('[convite] ERRO ao criar service client:', err);
    return NextResponse.json({ error: 'Configuração do servidor inválida' }, { status: 500 });
  }

  // Teste de sanidade: listar usuários para confirmar que a chave funciona
  const { error: listError } = await service.auth.admin.listUsers({ perPage: 1 });
  if (listError) {
    console.error('[convite] listUsers FALHOU — chave inválida ou sem permissão:', listError.message, listError);
    return NextResponse.json(
      { error: `Service key inválida: ${listError.message}` },
      { status: 500 }
    );
  }
  console.log('[convite] listUsers OK — service key válida');

  // Envia convite nativo do Supabase Auth — o email é gerenciado pelo Supabase
  let inviteError: Error | null = null;
  try {
    const redirectTo = `${origin}/aceitar-convite`;
    console.log('[convite] redirectTo:', redirectTo);
    const result = await service.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        clinica_id: dentista.clinica_id,
      },
      redirectTo,
    });
    inviteError = result.error;
    if (result.error) {
      console.error('[convite] inviteUserByEmail ERRO completo:', JSON.stringify(result.error, null, 2));
    } else {
      console.log('[convite] inviteUserByEmail OK, user id:', result.data?.user?.id);
    }
  } catch (err) {
    console.error('[convite] inviteUserByEmail EXCEPTION:', err);
    return NextResponse.json({ error: 'Erro inesperado ao enviar convite' }, { status: 500 });
  }

  if (inviteError) {
    // "User already registered" significa que o email já existe no Supabase
    if (inviteError.message?.includes('already been registered')) {
      return NextResponse.json(
        { error: 'Este email já possui uma conta no DentIA' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `Erro ao enviar convite: ${inviteError.message}` }, { status: 500 });
  }

  // Registra na tabela convites para exibição na UI (rastreamento de pendentes)
  await supabase.from('convites').insert({
    clinica_id: dentista.clinica_id,
    email,
    role,
    token: crypto.randomUUID(),
  });

  console.log('[convite] FIM — sucesso');
  return NextResponse.json({ success: true });
}
