'use server';

import { getDentistaCached } from '@/lib/get-dentista';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';

/** Busca a ficha mais recente sem assinatura para o paciente. */
export async function buscarFichaParaAssinar(
  pacienteId: string,
): Promise<{ fichaId: string | null; error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role !== 'secretaria') return { fichaId: null, error: 'Sem permissão' };

  const db = createServiceClient();
  const { data } = await db
    .from('fichas')
    .select('id')
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', dentista.clinica_id)
    .is('assinatura_url', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { fichaId: data?.id ?? null };
}

/** Salva a assinatura do paciente em uma ficha via service role (bypassa RLS de fichas). */
export async function salvarAssinaturaRecepcao(
  fichaId: string,
  pacienteId: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role !== 'secretaria') return { ok: false, error: 'Sem permissão' };

  const db = createServiceClient();

  // Verifica que a ficha pertence à clínica E ao paciente antes de salvar
  const { data: ficha } = await db
    .from('fichas')
    .select('id')
    .eq('id', fichaId)
    .eq('clinica_id', dentista.clinica_id)
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada' };

  // Converte data URL → Buffer para upload no Storage
  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida' };
  const buffer = Buffer.from(base64, 'base64');

  const storagePath = `${dentista.clinica_id}/${pacienteId}/assinatura_${fichaId}.png`;

  const { error: storageErr } = await db.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) return { ok: false, error: storageErr.message };

  const { data: urlData } = db.storage.from('fichas').getPublicUrl(storagePath);

  const { error: dbErr } = await db
    .from('fichas')
    .update({ assinatura_url: urlData.publicUrl, assinado_em: new Date().toISOString() })
    .eq('id', fichaId)
    .eq('clinica_id', dentista.clinica_id);

  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true };
}
