import { requireRole } from '@/server/auth/roles';
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
  const { supabase, user, clinicId, role } = await requireRole(['admin', 'dentista']);

  const [{ data: dentistaPerfil }, { data: usuarios }, { data: convites }, { data: clinica }] =
    await Promise.all([
      supabase
        .from('dentistas')
        .select('id')
        .eq('user_id', user.id)
        .eq('clinica_id', clinicId)
        .maybeSingle(),
      supabase
        .from('dentistas')
        .select('id, nome, email, role, ativo, created_at')
        .eq('clinica_id', clinicId)
        .order('created_at', { ascending: true }),
      supabase
        .from('convites')
        .select('id, email, role, expires_at, created_at')
        .eq('clinica_id', clinicId)
        .eq('status', 'pendente')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('clinicas')
        .select('limite_dentistas, plano')
        .eq('id', clinicId)
        .single(),
    ]);

  const dentistasAtivos = (usuarios ?? []).filter(
    (u) => (u as UsuarioRow).role !== 'secretaria' && (u as UsuarioRow).ativo
  ).length;
  const convitesDentistasPendentes = (convites ?? []).filter(
    (c) => (c as ConvitePendente).role !== 'secretaria'
  ).length;
  const clinicaData = clinica as { limite_dentistas: number; plano: string } | null;
  const limiteDentistas = clinicaData?.limite_dentistas ?? 5;
  const plano = (clinicaData?.plano ?? 'SOLO') as import('@/lib/planos').PlanoId;
  const convitesRestantes = Math.max(0, limiteDentistas - dentistasAtivos - convitesDentistasPendentes);

  return (
    <UsuariosClient
      usuarios={(usuarios as UsuarioRow[]) ?? []}
      convitesPendentes={(convites as ConvitePendente[]) ?? []}
      meuId={dentistaPerfil?.id ?? ''}
      meuRole={role as DentistaRole}
      limiteDentistas={limiteDentistas}
      convitesRestantes={convitesRestantes}
      plano={plano}
    />
  );
}
