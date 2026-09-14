'use server';

import { revalidatePath } from 'next/cache';
import { adicionarProcedimentosFichaSchema, montarPayloadAdicionarProcedimentos, type AdicionarProcedimentosFichaInput, type MutacaoFichaResult } from '@/lib/odontograma/adicionar-procedimentos';
import { requireClinicContext } from '@/server/auth/clinic';

/** Acrescenta um lote confirmado à ficha existente, sem criar visita, evolução ou ficha nova. */
export async function adicionarProcedimentosFicha(input: AdicionarProcedimentosFichaInput): Promise<MutacaoFichaResult> {
  const parsed = adicionarProcedimentosFichaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'INVALIDO', error: parsed.error.issues[0]?.message ?? 'Revise os procedimentos antes de adicionar.' };
  }

  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria' || role === 'protetico') {
    return { ok: false, code: 'SEM_PERMISSAO', error: 'Sem permissão para adicionar procedimentos nesta ficha.' };
  }

  const payload = montarPayloadAdicionarProcedimentos(parsed.data.eventos, {
    clinicId,
    pacienteId: parsed.data.pacienteId,
    dentistaId,
    fichaId: parsed.data.fichaId,
  });
  const { data, error } = await supabase.rpc('adicionar_procedimentos_ficha', {
    p_ficha_id: parsed.data.fichaId,
    p_paciente_id: parsed.data.pacienteId,
    p_captura_id: parsed.data.capturaId,
    p_eventos: payload,
  });

  if (error) {
    if (error.message.includes('ficha_assinada')) {
      return { ok: false, code: 'ASSINADO', error: 'Esta ficha já foi assinada e não pode receber procedimentos.' };
    }
    if (error.message.includes('conflito_evento') || error.message.includes('evento_retirado')) {
      return { ok: false, code: 'CONFLITO', error: 'Este lote conflita com um procedimento já existente. Recarregue a ficha antes de tentar novamente.' };
    }
    if (error.message.includes('sem_permissao') || error.message.includes('ficha_nao_encontrada')) {
      return { ok: false, code: 'SEM_PERMISSAO', error: 'Esta ficha não está disponível para alteração.' };
    }
    if (error.message.includes('evento_invalido') || error.message.includes('procedimento_catalogo_invalido') || error.message.includes('encaminhamento_invalido')) {
      return { ok: false, code: 'INVALIDO', error: 'Revise os procedimentos antes de adicionar.' };
    }
    console.error('[adicionarProcedimentosFicha]', error.message);
    return { ok: false, code: 'INDISPONIVEL', error: 'Não foi possível adicionar os procedimentos agora.' };
  }

  if (!Array.isArray(data) || !data.every((id): id is string => typeof id === 'string')) {
    console.error('[adicionarProcedimentosFicha] RPC sem ids de evento', data);
    return { ok: false, code: 'INDISPONIVEL', error: 'Não foi possível confirmar os procedimentos adicionados.' };
  }

  revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  revalidatePath('/dashboard/meu-dia');
  return { ok: true, fichaId: parsed.data.fichaId, eventoIds: data };
}
