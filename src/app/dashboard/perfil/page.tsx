import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { PerfilClient } from './_components/perfil-client';
import { PageTransition } from '@/components/layout/page-transition';

export default async function PerfilPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Busca campos profissionais que não estão no cache
  const { data: dados } = await supabase
    .from('dentistas')
    .select('nome, cro, especialidade, telefone, cpf')
    .eq('user_id', user!.id)
    .single();

  return (
    <PageTransition>
    <PerfilClient
      nome={dados?.nome ?? dentista.nome}
      email={user?.email ?? null}
      role={dentista.role}
      clinica={dentista.clinica}
      avatarUrl={dentista.avatar_url}
      cro={dados?.cro ?? null}
      especialidade={dados?.especialidade ?? null}
      telefone={dados?.telefone ?? null}
      cpf={(dados as { cpf?: string | null } | null)?.cpf ?? null}
    />
    </PageTransition>
  );
}
