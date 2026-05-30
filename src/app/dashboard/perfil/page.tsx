import { requireUser } from '@/server/auth/user';
import { getDentistaCached } from '@/lib/get-dentista';
import { redirect } from 'next/navigation';
import { PerfilClient } from './_components/perfil-client';
import { PageTransition } from '@/components/layout/page-transition';

export default async function PerfilPage() {
  const { supabase, user } = await requireUser();

  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const { data: dados } = await supabase
    .from('dentistas')
    .select('nome, cro, especialidade, telefone, cpf, chave_pix')
    .eq('user_id', user.id)
    .single();

  return (
    <PageTransition>
      <PerfilClient
        nome={dados?.nome ?? dentista.nome}
        email={user.email ?? null}
        role={dentista.role}
        clinica={dentista.clinica}
        avatarUrl={dentista.avatar_url}
        cro={dados?.cro ?? null}
        especialidade={dados?.especialidade ?? null}
        telefone={dados?.telefone ?? null}
        cpf={(dados as { cpf?: string | null } | null)?.cpf ?? null}
        chavePix={(dados as { chave_pix?: string | null } | null)?.chave_pix ?? null}
      />
    </PageTransition>
  );
}
