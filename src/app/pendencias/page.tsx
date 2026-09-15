import { notFound, redirect } from 'next/navigation';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { getMemberContext } from '@/server/auth/member-context';
import { requireUser } from '@/server/auth/user';
import { PendenciasClient } from '@/components/pendencias/pendencias-client';
import { DashboardShell } from '@/components/layout/dashboard-shell';
export const metadata = { title: 'Pendências · Odonto.IA' };
/** Rota operacional do piloto: secretária não precisa de um perfil de dentista. */
export default async function OperationalContactsPage() {
  if (!isTeamWorkspaceEnabled()) notFound();
  const { supabase, user } = await requireUser();
  const member = await getMemberContext();
  if (!member.ok) return <section role="alert" className="p-8 text-foreground">{member.mensagem}</section>;
  const { clinicaId, role } = member.data;
  // Perfil do proprietário não clínico é o próximo lote, não uma persona clínica artificial.
  if (role === 'protetico' || role === 'gestor') notFound();
  const [{ data: clinic }, { data: professional }, { data: receptionist }] = await Promise.all([
    supabase.from('clinicas').select('nome').eq('id', clinicaId).maybeSingle<{ nome: string }>(),
    supabase.from('dentistas').select('nome,avatar_url').eq('user_id', user.id).eq('clinica_id', clinicaId).eq('ativo', true).maybeSingle<{ nome: string; avatar_url: string | null }>(),
    role === 'secretaria' ? supabase.from('secretarias').select('nome,must_change_password').eq('usuario_id', user.id).eq('clinica_id', clinicaId).maybeSingle<{ nome: string; must_change_password: boolean }>() : Promise.resolve({ data: null }),
  ]);
  if (receptionist?.must_change_password) redirect('/primeiro-acesso');
  if (process.env.LEGAL_ACCEPTS_ENABLED === 'true') {
    const { data: legal } = await supabase.from('aceites_termos').select('id').eq('usuario_id', user.id).eq('versao', '1.0-draft').maybeSingle();
    if (!legal) redirect('/termos-de-uso?next=%2Fpendencias');
  }
  return <DashboardShell nome={professional?.nome ?? receptionist?.nome ?? 'Minha conta'} clinicaNome={clinic?.nome ?? 'Sua clínica'} activeClinicId={clinicaId} role={role} avatarUrl={professional?.avatar_url} consultorioPessoalEnabled={role !== 'secretaria'} pendenciasEnabled>
    <PendenciasClient clinicaId={clinicaId} />
  </DashboardShell>;
}
