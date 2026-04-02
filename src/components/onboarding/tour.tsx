'use client';

import { useEffect, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { HelpCircle } from 'lucide-react';

const TOUR_KEY = 'dentai_tour_v1';

const STEPS = [
  {
    element: '#sidebar',
    popover: {
      title: 'Navegação Principal',
      description:
        'Aqui você acessa todas as funcionalidades da sua clínica. Recolha a barra clicando na seta para ganhar mais espaço.',
    },
  },
  {
    element: '#pacientes-link',
    popover: {
      title: 'Pacientes',
      description:
        'Cadastre e gerencie todos os seus pacientes com histórico clínico completo.',
    },
  },
  {
    element: '#fichas-link',
    popover: {
      title: 'Fichas Clínicas',
      description:
        'Registre evoluções com voz (transcrição por IA), odontograma interativo e anexos de imagem.',
    },
  },
  {
    element: '#orcamentos-link',
    popover: {
      title: 'Orçamentos',
      description:
        'Gere orçamentos automaticamente com IA, exporte em PDF e envie por WhatsApp com um clique.',
    },
  },
  {
    element: '#agendamentos-link',
    popover: {
      title: 'Agendamentos',
      description: 'Organize sua agenda de consultas com visualização semanal e diária.',
    },
  },
  {
    element: '#configuracoes-link',
    popover: {
      title: 'Configurações',
      description:
        'Ajuste os dados da clínica, horários de atendimento e catálogo de procedimentos.',
    },
  },
];

function buildDriver(onDone?: () => void) {
  // Filtra steps cujo elemento já existe no DOM
  const validSteps = STEPS.filter((s) => !!document.querySelector(s.element));

  return driver({
    steps: validSteps,
    showProgress: true,
    popoverClass: 'driverjs-theme',
    nextBtnText: 'Próximo →',
    prevBtnText: '← Anterior',
    doneBtnText: '✓ Entendi!',
    onDestroyed: onDone,
  });
}

export function OnboardingTour(): React.JSX.Element {
  const runAutoTour = useCallback((): void => {
    const d = buildDriver(() => {
      localStorage.setItem(TOUR_KEY, 'done');
    });
    d.drive();
  }, []);

  const runManualTour = useCallback((): void => {
    buildDriver().drive();
  }, []);

  // Dispara automaticamente na primeira visita
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TOUR_KEY)) return;

    // Aguarda o DOM estar completamente renderizado
    const timer = setTimeout(runAutoTour, 900);
    return () => clearTimeout(timer);
  }, [runAutoTour]);

  return (
    <button
      onClick={runManualTour}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
      aria-label="Iniciar tour de ajuda"
    >
      <HelpCircle className="w-4 h-4" />
      Ajuda
    </button>
  );
}
