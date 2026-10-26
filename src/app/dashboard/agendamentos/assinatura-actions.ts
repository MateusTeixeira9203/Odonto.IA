'use server';

import { randomUUID } from 'node:crypto';
import { usarCaminhoLegado, NADA_A_ASSINAR } from '@/lib/prontuario/assinatura-recepcao';
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
 * autoria/status via a RPC do R-03a); só cai pro caminho legado (service role)
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
  if (granular.ok || granular.error !== NADA_A_ASSINAR) return granular;

  // Caminho legado (ficha sem evento): nunca substituir uma assinatura já registrada.
  const db = createServiceClient();

  const { data: ficha, error: fichaError } = await db
    .from('fichas')
    .select('id, assinado_em, assinatura_url')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (fichaError) return { ok: false, error: 'Não foi possível consultar a ficha para assinatura.' };
  if (!ficha) return { ok: false, error: 'Ficha não encontrada' };
  if (ficha.assinado_em != null || ficha.assinatura_url != null) {
    return { ok: false, error: 'Esta ficha já está assinada e não pode ser assinada novamente.' };
  }

  const { count, error: eventosError } = await db
    .from('odontograma_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('ficha_id', fichaId)
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', clinicId)
    .is('retirado_em', null);

  if (eventosError || count == null) {
    return { ok: false, error: 'Não foi possível consultar os procedimentos para assinatura.' };
  }
  if (!usarCaminhoLegado({ totalProcedimentos: count })) {
    return { ok: false, error: 'Não há procedimento realizado para assinar nesta ficha.' };
  }

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida' };
  const buffer = Buffer.from(base64, 'base64');

  const storagePath = `${clinicId}/${pacienteId}/assinatura_${fichaId}_${randomUUID()}.png`;
  const storage = db.storage.from('fichas');
  const erroArquivoPendente = 'Não foi possível concluir a assinatura nem remover o arquivo desta tentativa. Atualize a página e peça à equipe para verificar.';
  const erroGravacaoIncerta = 'Não foi possível confirmar a gravação da assinatura. Atualize a página antes de tentar novamente.';

  const removerArquivoDaTentativa = async (): Promise<boolean> => {
    try {
      const { error } = await storage.remove([storagePath]);
      return !error;
    } catch {
      return false;
    }
  };

  try {
    const { error: storageErr } = await storage.upload(storagePath, buffer, { contentType: 'image/png', upsert: false });
    // O SDK pode devolver a falha de transporte em vez de rejeitar a promessa.
    if (storageErr?.name === 'StorageUnknownError') throw storageErr;
    if (storageErr) return { ok: false, error: storageErr.message };
  } catch {
    const removido = await removerArquivoDaTentativa();
    return { ok: false, error: removido ? 'Não foi possível enviar a assinatura. Verifique a conexão e tente novamente.' : erroArquivoPendente };
  }

  let atualizadas: Array<{ id: string }> | null;
  let dbErr: { code: string; message: string } | null;
  try {
    const resultado = await db
      .from('fichas')
      .update({ assinatura_url: storagePath, assinado_em: new Date().toISOString() })
      .eq('id', fichaId)
      .eq('clinica_id', clinicId)
      .eq('paciente_id', pacienteId)
      .is('assinado_em', null)
      .is('assinatura_url', null)
      .select('id');
    atualizadas = resultado.data;
    dbErr = resultado.error;
  } catch {
    // A resposta pode ter se perdido após o commit. Não apagar uma prova possivelmente vinculada.
    return { ok: false, error: erroGravacaoIncerta };
  }

  if (dbErr && !/^[0-9A-Z]{5}$/.test(dbErr.code)) return { ok: false, error: erroGravacaoIncerta };
  if (dbErr || !atualizadas?.length) {
    if (!await removerArquivoDaTentativa()) return { ok: false, error: erroArquivoPendente };
    return { ok: false, error: dbErr?.message ?? 'Registro nao encontrado.' };
  }

  return { ok: true };
}
