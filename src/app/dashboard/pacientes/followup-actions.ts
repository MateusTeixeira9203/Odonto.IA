'use server';

import { revalidatePath } from 'next/cache';
import { requireClinicContext } from '@/server/auth/clinic';
import { registrarLog } from '@/lib/activity-log';

export async function marcarFollowUp(
  pacienteId: string,
  nota?: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { error } = await supabase
    .from('pacientes')
    .update({
      followup_pendente: true,
      followup_nota:     nota?.trim() || null,
      followup_em:       new Date().toISOString(),
    })
    .eq('id', pacienteId)
    .eq('clinica_id', clinicId);

  if (error) return { ok: false, erro: error.message };

  registrarLog(supabase, {
    clinicaId:   clinicId,
    actorId:     dentistaId,
    pacienteId,
    entityType:  'followup',
    entityId:    pacienteId,
    action:      'followup.marcado',
    metadata:    nota ? { nota } : undefined,
  });

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  revalidatePath('/dashboard/pacientes');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function limparFollowUp(
  pacienteId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, clinicId, dentistaId } = await requireClinicContext();

  const { error } = await supabase
    .from('pacientes')
    .update({
      followup_pendente:    false,
      followup_nota:        null,
      followup_em:          null,
      followup_snooze_ate:  null,
    })
    .eq('id', pacienteId)
    .eq('clinica_id', clinicId);

  if (error) return { ok: false, erro: error.message };

  registrarLog(supabase, {
    clinicaId:  clinicId,
    actorId:    dentistaId,
    pacienteId,
    entityType: 'followup',
    entityId:   pacienteId,
    action:     'followup.concluido',
  });

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  revalidatePath('/dashboard/pacientes');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function snoozeFollowUp(
  pacienteId: string,
  days: number,
): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const ate = new Date(Date.now() + days * 86_400_000).toISOString();

  const { error } = await supabase
    .from('pacientes')
    .update({ followup_snooze_ate: ate })
    .eq('id', pacienteId)
    .eq('clinica_id', clinicId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}
