import { createClient } from '@/lib/supabase/server';
import { getMemberContext, type MemberContextResult } from './member-context';

export type ReceptionContext = {
  usuarioId: string;
  membroId: string;
  clinicaId: string;
  nome: string;
  clinicaNome: string;
};

export type ReceptionContextResult =
  | { ok: true; data: ReceptionContext }
  | { ok: false; codigo: 'SEM_ACESSO' | 'CONTEXTO_ALTERADO' | 'INDISPONIVEL'; mensagem: string };

type ReceptionDependencies = {
  member(): Promise<MemberContextResult>;
  profile(clinicaId: string, userId: string): Promise<{
    data: { nome: string } | null;
    error: { message: string } | null;
  }>;
  clinic(clinicaId: string): Promise<{
    data: { nome: string } | null;
    error: { message: string } | null;
  }>;
};

async function defaultDependencies(): Promise<ReceptionDependencies> {
  const client = await createClient();
  return {
    member: () => getMemberContext(),
    profile: (clinicaId, userId) => client.from('secretarias')
      .select('nome').eq('clinica_id', clinicaId).eq('usuario_id', userId).maybeSingle(),
    clinic: (clinicaId) => client.from('clinicas').select('nome').eq('id', clinicaId).maybeSingle(),
  };
}

/** Identidade de recepção não contém dentistaId, CRO ou qualquer capacidade clínica. */
export async function getReceptionContext(
  dependencies?: ReceptionDependencies,
): Promise<ReceptionContextResult> {
  try {
    const source = dependencies ?? await defaultDependencies();
    const member = await source.member();
    if (!member.ok) return member;
    if (member.data.role !== 'secretaria' || member.data.perfilClinico !== null) {
      return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Este acesso não é de recepção operacional.' };
    }

    const [profile, clinic] = await Promise.all([
      source.profile(member.data.clinicaId, member.data.usuarioId),
      source.clinic(member.data.clinicaId),
    ]);
    if (profile.error || clinic.error) {
      return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar a recepção agora.' };
    }
    if (!profile.data || !clinic.data) {
      return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'O perfil de recepção não está disponível nesta clínica.' };
    }
    return {
      ok: true,
      data: {
        usuarioId: member.data.usuarioId,
        membroId: member.data.membroId,
        clinicaId: member.data.clinicaId,
        nome: profile.data.nome,
        clinicaNome: clinic.data.nome,
      },
    };
  } catch {
    return { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar a recepção agora.' };
  }
}
