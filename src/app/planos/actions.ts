'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { TRIAL_DAYS } from '@/lib/billing/trial';
import { isCicloCobranca } from '@/lib/billing/plan-catalog';
import { criarCheckoutAssinaturaDentista } from '@/server/services/assinatura-dentista';
import { iniciarFormacaoClinica } from '@/server/services/formacao-clinica';
import { limiteDentistasParaPlano, type PlanoId } from '@/lib/planos';

export type AtivarTrialResult =
  | { ok: true; trialEndsAt: string }
  | { ok: false; error: string };

/**
 * Dá partida no relógio do trial. **Só no relógio** — `plano` não é tocado aqui.
 *
 * R-105a §4.3(a) — três mudanças em relação à versão anterior, e as três são contrato:
 *
 *  1. **Não grava mais `plano: 'CLINICA'` hardcoded.** Isso jogava dentista solo no plano
 *     errado sem ele ter escolhido nada. Quem escreve plano é `definirPlano` (invariante I8).
 *  2. **Não redireciona.** Quem chama decide o que fazer — o card de ativação do Meu dia
 *     precisa do resultado na mão, não de um redirect pro dashboard.
 *  3. **É idempotente por construção**: o `trial_ends_at IS NULL` está no WHERE, não só numa
 *     leitura anterior. Duas chamadas concorrentes (o save do Meu dia e o cron do R-105b, por
 *     exemplo) não podem mover a data — a 2ª afeta 0 linhas e devolve o valor já gravado.
 *
 * Chamada logo DEPOIS do primeiro save do dentista (R-105a §5). Falha aqui nunca pode derrubar
 * o salvamento clínico (I6) — quem chama trata como best-effort, e o cron do R-105b §4.3
 * corrige quem ficou pra trás em até 24h (I5).
 */
export async function activateTrial(): Promise<AtivarTrialResult> {
  if (process.env.STRIPE_BILLING_ENABLED === 'true') {
    return { ok: false, error: 'O período de teste agora é iniciado pela Stripe após o cadastro do cartão.' };
  }
  // requireClinicContext resolve clinicId via users.active_clinica_id + clinica_usuarios.
  // Nenhuma dependência de dentistas.maybeSingle().
  const { clinicId } = await requireClinicContext();

  const service = createServiceClient();

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  // `.select()` no update é o que distingue "gravei" de "não gravei": sem ele o Postgrest
  // devolve sucesso com 0 linhas afetadas e a gente não teria como saber que o WHERE barrou
  // (mesmo modo de falha silenciosa que o UPDATE-barrado-por-RLS já produziu neste projeto).
  const { data: gravadas, error: updateError } = await service
    .from('clinicas')
    .update({
      status_assinatura: 'trial',
      trial_ends_at:     trialEndsAt.toISOString(),
    })
    .eq('id', clinicId)
    .is('trial_ends_at', null)
    .neq('status_assinatura', 'ativo')
    .select('trial_ends_at');

  if (updateError) {
    console.error('[activateTrial] Erro ao atualizar clínica:', {
      message: updateError.message,
      code:    updateError.code,
    });
    return { ok: false, error: 'Erro ao ativar o trial. Se o problema persistir, contate o suporte.' };
  }

  if (gravadas && gravadas.length > 0) {
    console.log(`[activateTrial] Trial ativado — clinica_id=${clinicId}, expira em ${trialEndsAt.toISOString()}`);
    return { ok: true, trialEndsAt: trialEndsAt.toISOString() };
  }

  // 0 linhas: o WHERE barrou. Descobre por quê pra devolver a mensagem certa — e, no caso de
  // trial já iniciado, devolve a data REAL, que é o que o card precisa mostrar.
  const { data: clinica } = await service
    .from('clinicas')
    .select('status_assinatura, trial_ends_at')
    .eq('id', clinicId)
    .maybeSingle();

  if (!clinica) {
    console.error('[activateTrial] Clínica não encontrada:', clinicId);
    return { ok: false, error: 'Clínica não encontrada. Contate o suporte.' };
  }
  if (clinica.status_assinatura === 'ativo') {
    return { ok: false, error: 'Você já possui uma assinatura ativa.' };
  }
  if (clinica.trial_ends_at) {
    // Idempotência: não é erro do ponto de vista de quem chama — o relógio já está correndo.
    return { ok: true, trialEndsAt: clinica.trial_ends_at };
  }
  return { ok: false, error: 'Não foi possível ativar o trial. Tente novamente.' };
}

export async function createCheckout(
  planoId: 'SOLO' | 'CLINICA',
  ciclo: string,
  fluxo: 'padrao' | 'onboarding' = 'padrao',
): Promise<{ url?: string; error?: string }> {
  if (!isCicloCobranca(ciclo)) return { error: 'Ciclo de cobrança inválido.' };
  try {
    const { user, clinicId, dentistaId } = await requireClinicContext({ allowBlockedBilling: true });
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
    console.error('[planos] checkout não iniciado:', error);
    return { error: 'Não foi possível preparar a cobrança. Tente novamente.' };
  }
}
