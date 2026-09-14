'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { assinarTodosRealizadosDaFicha } from '@/server/patients/registro-actions';

/**
 * R-03b — uma ficha "falta assinar" de 2 formas agora: granular (algum evento realizado
 * sem assinatura_id) ou legado (zero evento, `fichas.assinatura_url` nunca preenchido).
 * Antes do R-03b bastava checar assinatura_url — mas isso nunca é tocado pelo caminho
 * granular, então uma ficha com TODOS os eventos já assinados individualmente continuaria
 * aparecendo como "falta assinar" pra sempre se a query não soubesse da diferença.
 */
export async function buscarFichaParaAssinar(
  pacienteId: string,
): Promise<{ fichaId: string | null; error?: string }> {
  const { clinicId, role } = await requireClinicContext();

  if (role !== 'secretaria') return { fichaId: null, error: 'Sem permissão' };

  const db = createServiceClient();
  const [{ data: fichas }, { data: eventos }] = await Promise.all([
    db
      .from('fichas')
      .select('id, created_at, assinatura_url')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicId)
      .order('created_at', { ascending: false }),
    db
      .from('odontograma_eventos')
      .select('ficha_id, status, assinatura_id')
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicId)
    .is('retirado_em', null),
  ]);

  for (const f of fichas ?? []) {
    const doFicha = (eventos ?? []).filter((e) => e.ficha_id === f.id);
    const elegivel = doFicha.length > 0
      ? doFicha.some((e) => e.status === 'realizado' && e.assinatura_id == null)
      : f.assinatura_url == null;
    if (elegivel) return { fichaId: f.id };
  }
  return { fichaId: null };
}

/**
 * R-03b — tenta primeiro o caminho granular (assinarTodosRealizadosDaFicha, que já valida
 * autoria/status via a RPC do R-03a); só cai pro caminho legado (service role, inalterado)
 * quando a ficha genuinamente não tem evento nenhum pra assinar granularmente.
 */
export async function salvarAssinaturaRecepcao(
  fichaId: string,
  pacienteId: string,
  assinadoPor: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, role } = await requireClinicContext();

  if (role !== 'secretaria') return { ok: false, error: 'Sem permissão' };

  const granular = await assinarTodosRealizadosDaFicha({ fichaId, pacienteId, assinadoPor, assinaturaDataUrl });
  if (granular.ok || granular.error !== 'Nada a assinar nesta ficha.') return granular;

  // Caminho legado (ficha sem evento) — inalterado, spec R-03b Decisão #B3.
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
