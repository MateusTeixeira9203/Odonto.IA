import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { UsuariosClient } from './_components/usuarios-client';
import type { DentistaRole } from '@/types/database';

export type UsuarioRow = {
  id: string;
  nome: string;
  email: string | null;
  role: DentistaRole;
  ativo: boolean;
  created_at: string;
};

export type ConvitePendente = {
  id: string;
  email: string;
  role: DentistaRole;
  expires_at: string;
  created_at: string;
};

export default async function UsuariosPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role === 'secretaria') redirect('/dashboard');

  const supabase = await createClient();

  const [{ data: usuarios }, { data: convites }, { data: clinica }] = await Promise.all([
    supabase
      .from('dentistas')
      .select('id, nome, email, role, ativo, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('convites')
      .select('id, email, role, expires_at, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('clinicas')
      .select('limite_dentistas')
      .eq('id', dentista.clinica_id)
      .single(),
  ]);

  const dentistasAtivos = (usuarios ?? []).filter(
    (u) => (u as UsuarioRow).role !== 'secretaria' && (u as UsuarioRow).ativo
  ).length;
  const limiteDentistas = (clinica as { limite_dentistas: number } | null)?.limite_dentistas ?? 5;
  const convitesRestantes = Math.max(0, limiteDentistas - dentistasAtivos);

  return (
    <UsuariosClient
      usuarios={(usuarios as UsuarioRow[]) ?? []}
      convitesPendentes={(convites as ConvitePendente[]) ?? []}
      meuId={dentista.id}
      meuRole={dentista.role}
      limiteDentistas={limiteDentistas}
      convitesRestantes={convitesRestantes}
    />
  );
}
