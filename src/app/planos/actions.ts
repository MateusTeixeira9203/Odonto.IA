'use server';

import { unstable_rethrow } from 'next/navigation';
import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { isCicloCobranca } from '@/lib/billing/plan-catalog';
import { criarCheckoutAssinaturaDentista } from '@/server/services/assinatura-dentista';
import { iniciarFormacaoClinica } from '@/server/services/formacao-clinica';
import { limiteDentistasParaPlano, type PlanoId } from '@/lib/planos';
import { papelPodeAlterarPlano, MSG_SEM_PERMISSAO_PLANO } from '@/lib/billing/permissao-plano';

export async function createCheckout(
  planoId: 'SOLO' | 'CLINICA',
  ciclo: string,
  fluxo: 'padrao' | 'onboarding' = 'padrao',
): Promise<{ url?: string; error?: string }> {
  if (!isCicloCobranca(ciclo)) return { error: 'Ciclo de cobrança inválido.' };
  const { user, clinicId, dentistaId, role } = await requireClinicContext();
  if (!papelPodeAlterarPlano(role)) return { error: MSG_SEM_PERMISSAO_PLANO };
  try {
    const service = createServiceClient();
    const [{ data: assinaturaAtual }, { data: clinicaAtual }] = await Promise.all([
      service.from('assinaturas_dentista').select('status')
        .eq('usuario_id', user.id).eq('dentista_id', dentistaId).maybeSingle<{ status: string }>(),
      service.from('clinicas').select('plano, limite_dentistas')
        .eq('id', clinicId).maybeSingle<{ plano: PlanoId; limite_dentistas: number }>(),
    ]);
    if (assinaturaAtual && ['trialing', 'active', 'past_due'].includes(assinaturaAtual.status)) {
      return { error: 'Sua assinatura já está ativa. Use Configurações → Plano para alterá-la.' };
    }
    if (!clinicaAtual) return { error: 'Clínica não encontrada para definir o plano.' };

    const planoClinica: PlanoId = planoId === 'SOLO' ? 'SOLO' : 'CLINICA';
    const { error: planoError } = await service.from('clinicas').update({
      plano: planoClinica,
      limite_dentistas: limiteDentistasParaPlano(planoClinica),
    }).eq('id', clinicId);
    if (planoError) return { error: 'Não foi possível registrar o plano escolhido.' };

    if (planoId === 'CLINICA') {
      const formacao = await iniciarFormacaoClinica({ userId: user.id, clinicId, dentistaId, ciclo });
      if (!formacao.ok) {
        await service.from('clinicas').update({
          plano: clinicaAtual.plano,
          limite_dentistas: clinicaAtual.limite_dentistas,
        }).eq('id', clinicId);
        return { error: formacao.error };
      }
    }
    return criarCheckoutAssinaturaDentista(
      user.id,
      ciclo,
      planoId === 'SOLO' ? 'CONSULTORIO' : 'CLINICA',
      clinicId,
      fluxo,
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error('[planos] checkout não iniciado:', error);
    return { error: 'Não foi possível preparar a cobrança. Tente novamente.' };
  }
}
