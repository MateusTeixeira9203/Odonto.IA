import { z } from 'zod';

import { createServiceClient } from '@/lib/supabase/service';
import { getClinicHubContext } from './context';

export type ClinicTeamMember = {
  membroId: string;
  nome: string;
  email: string | null;
  papel: string;
  status: string;
  proprietario: boolean;
  atuaClinicamente: boolean;
};
export type ClinicTeamResult = { ok: true; data: ClinicTeamMember[] } | { ok: false; mensagem: string };

export async function getClinicTeam(clinicaId: string): Promise<ClinicTeamResult> {
  if (!z.string().uuid().safeParse(clinicaId).success) return { ok: false, mensagem: 'Clínica inválida.' };
  const context = await getClinicHubContext();
  if (!context.ok || context.data.member.clinicaId !== clinicaId) {
    return { ok: false, mensagem: 'Sem acesso à equipe desta clínica.' };
  }
  const db = createServiceClient();
  const { data: memberships, error } = await db.from('clinica_usuarios')
    .select('id, usuario_id, role, status')
    .eq('clinica_id', clinicaId)
    .neq('status', 'removido')
    .order('created_at', { ascending: true });
  if (error) return { ok: false, mensagem: 'Não foi possível carregar a equipe agora.' };
  const userIds = (memberships ?? []).map((item) => item.usuario_id as string);
  const [usersResult, dentistsResult, secretariesResult, governanceResult, dentistInvitesResult, governanceInvitesResult] = await Promise.all([
    userIds.length > 0 ? db.from('users').select('id, email').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    userIds.length > 0 ? db.from('dentistas').select('user_id, nome, ativo').eq('clinica_id', clinicaId).in('user_id', userIds) : Promise.resolve({ data: [], error: null }),
    userIds.length > 0 ? db.from('secretarias').select('usuario_id, nome').eq('clinica_id', clinicaId).in('usuario_id', userIds) : Promise.resolve({ data: [], error: null }),
    db.from('clinica_vinculos_governanca').select('membro_id, papel, estado').eq('clinica_id', clinicaId).eq('estado', 'ativo'),
    db.from('convites').select('id, nome_convidado, email, role').eq('clinica_id', clinicaId).eq('status', 'pendente').gt('expires_at', new Date().toISOString()),
    db.from('convites_governanca').select('id, nome, email, papel').eq('clinica_id', clinicaId).eq('status', 'pendente').gt('expires_at', new Date().toISOString()),
  ]);
  const readError = usersResult.error ?? dentistsResult.error ?? secretariesResult.error ?? governanceResult.error ?? dentistInvitesResult.error ?? governanceInvitesResult.error;
  if (readError) {
    console.error('[consultorio/team] consulta falhou:', readError.message);
    return { ok: false, mensagem: 'Não foi possível carregar a equipe agora.' };
  }
  const users = usersResult.data;
  const dentists = dentistsResult.data;
  const secretaries = secretariesResult.data;
  const governance = governanceResult.data;
  const dentistInvites = dentistInvitesResult.data;
  const governanceInvites = governanceInvitesResult.data;
  const emails = new Map((users ?? []).map((item) => [item.id as string, item.email as string | null]));
  const dentistByUser = new Map((dentists ?? []).map((item) => [item.user_id as string, { nome: item.nome as string, ativo: item.ativo as boolean }]));
  const secretaryByUser = new Map((secretaries ?? []).map((item) => [item.usuario_id as string, item.nome as string]));
  const governanceByMember = new Map((governance ?? []).map((item) => [item.membro_id as string, item.papel as string]));
  const activeMembers: ClinicTeamMember[] = (memberships ?? []).map((item) => {
      const memberId = item.id as string;
      const userId = item.usuario_id as string;
      const dentist = dentistByUser.get(userId);
      const governanceRole = governanceByMember.get(memberId);
      return {
        membroId: memberId,
        nome: dentist?.nome ?? secretaryByUser.get(userId) ?? emails.get(userId) ?? 'Pessoa da equipe',
        email: emails.get(userId) ?? null,
        papel: governanceRole ?? (item.role as string),
        status: item.status as string,
        proprietario: governanceRole === 'proprietario',
        atuaClinicamente: dentist?.ativo === true,
      };
  });
  const pendingMembers: ClinicTeamMember[] = [
    ...(dentistInvites ?? []).map((item) => ({
      membroId: item.id as string,
      nome: (item.nome_convidado as string | null) ?? (item.email as string),
      email: item.email as string,
      papel: (item.role as string) || 'dentista',
      status: 'convite_pendente',
      proprietario: false,
      atuaClinicamente: true,
    })),
    ...(governanceInvites ?? []).map((item) => ({
      membroId: item.id as string,
      nome: item.nome as string,
      email: item.email as string,
      papel: item.papel as string,
      status: 'convite_pendente',
      proprietario: false,
      atuaClinicamente: item.papel === 'responsavel_tecnico',
    })),
  ];
  return { ok: true, data: [...activeMembers, ...pendingMembers] };
}
