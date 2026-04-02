import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { PerfilClient } from './_components/perfil-client';

export default async function PerfilPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Busca o email do usuário autenticado
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <PerfilClient
      nome={dentista.nome}
      email={user?.email ?? null}
      role={dentista.role}
      clinica={dentista.clinica}
      avatarUrl={dentista.avatar_url}
    />
  );
}
