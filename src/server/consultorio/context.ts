import { createClient } from '@/lib/supabase/server';
import { getGovernanceContext, type GovernanceContext } from '@/server/auth/governance-context';
import { getMemberContext, type MemberContext } from '@/server/auth/member-context';

export type ClinicHubContext = {
  member: MemberContext;
  governanca: GovernanceContext | null;
  nomeClinica: string;
  titulo: 'Meu Consultório' | 'Minha Clínica';
  basePath: '/dashboard/meu-consultorio' | '/consultorio';
};

export type ClinicHubContextResult =
  | { ok: true; data: ClinicHubContext }
  | { ok: false; mensagem: string };

/** Contexto mínimo compartilhado pelas rotas de gestão, sem inferir permissões no navegador. */
export async function getClinicHubContext(): Promise<ClinicHubContextResult> {
  const member = await getMemberContext();
  if (!member.ok) return { ok: false, mensagem: member.mensagem };

  const [governanca, client] = await Promise.all([
    getGovernanceContext(member.data.clinicaId),
    createClient(),
  ]);
  const { data: clinica, error } = await client
    .from('clinicas')
    .select('nome')
    .eq('id', member.data.clinicaId)
    .maybeSingle<{ nome: string }>();

  if (error) return { ok: false, mensagem: 'Não foi possível carregar a clínica ativa.' };
  const isClinical = member.data.perfilClinico !== null;
  return {
    ok: true,
    data: {
      member: member.data,
      governanca: governanca.ok ? governanca.data : null,
      nomeClinica: clinica?.nome ?? 'Sua clínica',
      titulo: isClinical ? 'Meu Consultório' : 'Minha Clínica',
      basePath: isClinical ? '/dashboard/meu-consultorio' : '/consultorio',
    },
  };
}
