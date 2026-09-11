import { createClient } from '@/lib/supabase/server';

const CLINIC_ROLES = ['dentista', 'secretaria', 'admin', 'protetico'] as const;

export type ClinicMembershipRole = (typeof CLINIC_ROLES)[number];
export type ClinicalProfile = { tipo: 'dentista'; dentistaId: string } | null;

export type MemberContext = {
  usuarioId: string;
  email: string | null;
  clinicaId: string;
  membroId: string;
  role: ClinicMembershipRole;
  perfilClinico: ClinicalProfile;
};

export type MemberContextFailure = 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL';

export type MemberContextResult =
  | { ok: true; data: MemberContext }
  | { ok: false; codigo: MemberContextFailure; mensagem: string };

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

type ActiveClinicRow = { active_clinica_id: string | null };
type MembershipRow = { id: string; role: string; status: string };
type DentistRow = { id: string; role: string };

type AuthenticatedUser = { id: string; email?: string | null };

/** Só expõe as quatro leituras que este contexto precisa, inclusive nos testes. */
export type MemberContextDependencies = {
  getUser(): Promise<QueryResult<AuthenticatedUser>>;
  getActiveClinic(userId: string): Promise<QueryResult<ActiveClinicRow>>;
  getMembership(userId: string, clinicaId: string): Promise<QueryResult<MembershipRow>>;
  getClinicalProfile(userId: string, clinicaId: string): Promise<QueryResult<DentistRow>>;
};

export type GetMemberContextOptions = {
  clinicaIdEsperada?: string;
  /** Dependência de leitura estreita para testes; em produção usa o cliente autenticado/RLS. */
  dependencies?: MemberContextDependencies;
};

function failure(codigo: MemberContextFailure, mensagem: string): MemberContextResult {
  return { ok: false, codigo, mensagem };
}

function isClinicRole(role: string): role is ClinicMembershipRole {
  return (CLINIC_ROLES as readonly string[]).includes(role);
}

function canHaveClinicalProfile(role: string): boolean {
  return role === 'dentista' || role === 'admin';
}

async function createDefaultDependencies(): Promise<MemberContextDependencies> {
  const client = await createClient();

  return {
    async getUser() {
      const { data, error } = await client.auth.getUser();
      return {
        data: data.user ? { id: data.user.id, email: data.user.email } : null,
        error: error ? { message: error.message } : null,
      };
    },
    async getActiveClinic(userId) {
      return client
        .from('users')
        .select('active_clinica_id')
        .eq('id', userId)
        .maybeSingle<ActiveClinicRow>();
    },
    async getMembership(userId, clinicaId) {
      return client
        .from('clinica_usuarios')
        .select('id, role, status')
        .eq('usuario_id', userId)
        .eq('clinica_id', clinicaId)
        .eq('status', 'ativo')
        .maybeSingle<MembershipRow>();
    },
    async getClinicalProfile(userId, clinicaId) {
      return client
        .from('dentistas')
        .select('id, role')
        .eq('user_id', userId)
        .eq('clinica_id', clinicaId)
        .eq('ativo', true)
        .maybeSingle<DentistRow>();
    },
  };
}

/**
 * Resolve somente a identidade autenticada e o vínculo ativo da clínica atual.
 * Não substitui os guards legados e não infere atuação clínica por cargo de secretaria/protético.
 */
export async function getMemberContext(
  options: GetMemberContextOptions = {},
): Promise<MemberContextResult> {
  try {
    const dependencies = options.dependencies ?? await createDefaultDependencies();

    const { data: user, error: authError } = await dependencies.getUser();
    if (authError) return failure('INDISPONIVEL', 'Não foi possível validar a sessão atual.');
    if (!user) return failure('SEM_ACESSO', 'Sessão autenticada obrigatória.');

    const { data: activeClinic, error: activeClinicError } = await dependencies.getActiveClinic(user.id);

    if (activeClinicError) return failure('INDISPONIVEL', 'Não foi possível resolver a clínica ativa.');
    if (!activeClinic?.active_clinica_id) return failure('SEM_ACESSO', 'Nenhuma clínica ativa foi encontrada.');

    const clinicaId = activeClinic.active_clinica_id;
    if (options.clinicaIdEsperada && options.clinicaIdEsperada !== clinicaId) {
      return failure('CONTEXTO_ALTERADO', 'A clínica ativa foi alterada. Atualize a operação e tente novamente.');
    }

    const { data: membership, error: membershipError } = await dependencies.getMembership(user.id, clinicaId);

    if (membershipError) return failure('INDISPONIVEL', 'Não foi possível validar o vínculo com a clínica.');
    if (!membership || membership.status !== 'ativo' || !isClinicRole(membership.role)) {
      return failure('SEM_ACESSO', 'Não há vínculo ativo com esta clínica.');
    }

    let perfilClinico: ClinicalProfile = null;
    if (canHaveClinicalProfile(membership.role)) {
      const { data: dentist, error: dentistError } = await dependencies.getClinicalProfile(user.id, clinicaId);

      if (dentistError) return failure('INDISPONIVEL', 'Não foi possível validar o perfil clínico.');
      if (dentist && canHaveClinicalProfile(dentist.role)) {
        perfilClinico = { tipo: 'dentista', dentistaId: dentist.id };
      }
    }

    return {
      ok: true,
      data: {
        usuarioId: user.id,
        email: user.email ?? null,
        clinicaId,
        membroId: membership.id,
        role: membership.role,
        perfilClinico,
      },
    };
  } catch {
    return failure('INDISPONIVEL', 'Não foi possível resolver o contexto de acesso.');
  }
}
