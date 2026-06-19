'use client';

import { useState, useEffect, useCallback } from 'react';

export type DexGuidePhase = 'welcome' | 'point_demo' | 'in_demo' | 'done';

const KEY = (id: string) => `dex_guide_phase_v1_${id}`;
// Chaves legadas do onboarding antigo (DexWelcome) — usadas pelo DexWidget.
const LEGACY_DONE_KEY = (id: string) => `dex_onboarding_v1_${id}`;
const LEGACY_WELCOME_KEY = (id: string) => `dex_welcome_v1_${id}`;
const EVENT = 'dex-guide-phase';

/**
 * Estado do onboarding guiado, persistido em localStorage e sincronizado
 * entre componentes da mesma página via CustomEvent.
 *
 * Migração: usuário que já concluiu o onboarding antigo (chaves legadas
 * setadas) começa em 'done' — não revê a cena de abertura.
 *
 * Ao chegar em 'done', também seta a chave legada e dispara
 * 'dex-onboarding-done' para o DexWidget liberar o FAB e carregar contexto.
 */
export function useDexGuide(dentistaId: string) {
  const [phase, setPhaseState] = useState<DexGuidePhase>('done'); // default seguro p/ SSR

  useEffect(() => {
    const stored = localStorage.getItem(KEY(dentistaId)) as DexGuidePhase | null;
    if (stored) {
      setPhaseState(stored);
    } else {
      const jaConcluiuAntigo =
        localStorage.getItem(LEGACY_DONE_KEY(dentistaId)) ||
        localStorage.getItem(LEGACY_WELCOME_KEY(dentistaId));
      setPhaseState(jaConcluiuAntigo ? 'done' : 'welcome');
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; phase: DexGuidePhase }>).detail;
      if (detail.id === dentistaId) setPhaseState(detail.phase);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [dentistaId]);

  const setPhase = useCallback((next: DexGuidePhase) => {
    localStorage.setItem(KEY(dentistaId), next);
    if (next === 'done') {
      // Mantém o DexWidget funcionando (gate de onboarding legado).
      localStorage.setItem(LEGACY_DONE_KEY(dentistaId), '1');
      window.dispatchEvent(new Event('dex-onboarding-done'));
    }
    setPhaseState(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: dentistaId, phase: next } }));
  }, [dentistaId]);

  return { phase, setPhase };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
