'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';

export async function buscarFichaParaAssinar(
  pacienteId: string,
): Promise<{ fichaId: string | null; error?: string }> {
  const { clinicId, role } = await requireClinicContext();

  if (role !== 'secretaria') return { fichaId: null, error: 'Sem permissão' };

  const db = createServiceClient();
  const { data } = await db
    .from('fichas')
    .select('id')
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', clinicId)
    .is('assinatura_url', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { fichaId: data?.id ?? null };
}

export async function salvarAssinaturaRecepcao(
  fichaId: string,
  pacienteId: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, role } = await requireClinicContext();

  if (role !== 'secretaria') return { ok: false, error: 'Sem permissão' };

  const db = createServiceClient();

  const { data: ficha } = await db
    .from('fichas')
    .select('id')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada' };

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida' };
  const buffer = Buffer.from(base64, 'base64');

  const storagePath = `${clinicId}/${pacienteId}/assinatura_${fichaId}.png`;

  const { error: storageErr } = await db.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) return { ok: false, error: storageErr.message };

  const { error: dbErr } = await db
    .from('fichas')
    .update({ assinatura_url: storagePath, assinado_em: new Date().toISOString() })
    .eq('id', fichaId)
    .eq('clinica_id', clinicId);

  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true };
}
