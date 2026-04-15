'use client';

import { useEffect, useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

// Chave de localStorage — tour mostrado uma vez por usuário (não por paciente).
const TOUR_KEY = 'patient_profile_tour_v1';

interface Step {
  element?: string;
  title: string;
  description: string;
}

const ALL_STEPS: Step[] = [
  {
    // Passo 1 — centro da tela, sem elemento âncora
    title: '🤖 Bem-vindo ao Perfil do Paciente!',
    description:
      'Aqui é onde a mágica acontece. Vou te mostrar as 4 áreas principais.',
  },
  {
    element: '#tab-fichas',
    title: '📝 Fichas',
    description:
      'Aqui você preenche a anamnese, evolução e odontograma do paciente.',
  },
  {
    element: '#tab-documentos',
    title: '📄 Documentos',
    description:
      'Gere atestados, receitas e termos de consentimento em 1 clique.',
  },
  {
    element: '#tab-apresentacao',
    title: '🖥️ Apresentação',
    description:
      'Mostre modelos 3D, raios-x e encante o paciente na cadeira.',
  },
  {
    element: '#tab-orcamento',
    title: '💰 Orçamento',
    description:
      'Monte o plano de tratamento, aprove valores e feche o negócio!',
  },
];

interface PatientDexTourProps {
  /** Inicia automaticamente na primeira visita (baseado em localStorage). */
  autoStart?: boolean;
  /** Disparado quando o tour termina ou é fechado. */
  onComplete?: () => void;
}

/**
 * Tour guiado do Perfil do Paciente usando driver.js.
 *
 * Pré-requisitos nas abas (paciente-detail-client.tsx):
 *   #tab-fichas       → aba "Fichas Clínicas"
 *   #tab-documentos   → aba "Documentos"
 *   #tab-apresentacao → aba "Planejamento"
 *   #tab-orcamento    → aba "Orçamentos"
 *
 * Para estilizar o popover, adicione regras CSS para `.dex-config-theme`.
 */
export function PatientDexTour({ autoStart = false, onComplete }: PatientDexTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const startTour = useCallback(() => {
    // Filtra passos cujos elementos não estão no DOM (ex.: abas clínicas ocultas para secretária)
    const visibleSteps = ALL_STEPS.filter((s) => {
      if (!s.element) return true;
      return document.querySelector(s.element) !== null;
    });

    if (visibleSteps.length === 0) return;

    driverRef.current = driver({
      popoverClass: 'dex-config-theme',
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Finalizar ✓',
      showProgress: true,
      animate: true,
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY, 'done');
        onComplete?.();
      },
      steps: visibleSteps.map((s) => ({
        ...(s.element ? { element: s.element } : {}),
        popover: {
          title: s.title,
          description: s.description,
          side: s.element ? ('bottom' as const) : undefined,
          align: s.element ? ('start' as const) : undefined,
        },
      })),
    });

    driverRef.current.drive();
  }, [onComplete]);

  // Inicia automaticamente na primeira visita
  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    // Aguarda a página renderizar completamente antes de medir elementos
    const t = setTimeout(startTour, 900);
    return () => {
      clearTimeout(t);
      driverRef.current?.destroy();
    };
  }, [autoStart, startTour]);

  return null;
}

/**
 * Reseta o tour (útil para botão "Ver tour novamente").
 */
export function resetPatientTour(): void {
  localStorage.removeItem(TOUR_KEY);
}
