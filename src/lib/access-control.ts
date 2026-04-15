/**
 * Regras de acesso baseadas em role + plano.
 * Centraliza a lógica para evitar duplicação entre sidebar, guards e pages.
 */

import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';

/**
 * Retorna true se o usuário pode visualizar menus e configurações de WhatsApp/Bot.
 *
 * Regras:
 * - Plano SOLO: o admin/dentista gerencia tudo sozinho → pode ver.
 * - Plano BASICO ou CLINICA: a secretária é responsável pelo bot → só ela vê.
 */
export function canViewWhatsApp(
  role: DentistaRole,
  plan: PlanoId | null | undefined,
): boolean {
  if (plan === 'SOLO') {
    return role === 'admin' || role === 'dentista';
  }
  // BASICO / CLINICA: apenas secretária
  return role === 'secretaria';
}
