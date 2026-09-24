'use server';

import { revalidatePath } from 'next/cache';

import { getClinicHubContext } from '@/server/consultorio/context';
import { createTeamInvite } from '@/server/services/team-invites';

export type InviteState = { ok: boolean; message: string };

export async function inviteTeamMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const context = await getClinicHubContext();
  if (!context.ok) return { ok: false, message: context.mensagem };
  const result = await createTeamInvite({
    clinicaId: context.data.member.clinicaId,
    nome: formData.get('nome'),
    email: formData.get('email'),
    tipo: formData.get('tipo'),
    chaveIdempotencia: crypto.randomUUID(),
  });
  if (!result.ok) return { ok: false, message: result.mensagem };
  revalidatePath('/dashboard/meu-consultorio/equipe');
  revalidatePath('/consultorio/equipe');
  return { ok: true, message: result.emailEnviado ? 'Convite enviado por e-mail.' : 'Convite criado. O e-mail não pôde ser entregue agora.' };
}
