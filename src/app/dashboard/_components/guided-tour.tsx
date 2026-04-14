'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Users, BarChart2, ArrowRight, X, CheckCircle2 } from 'lucide-react';

interface TourStep {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  cta: string;
  color: string;
}

const STEPS: TourStep[] = [
  {
    icon: Bot,
    title: 'Configure o Assistente Bot',
    description:
      'Personalize as respostas automáticas do WhatsApp: horários, procedimentos e mensagens de boas-vindas para seus pacientes.',
    href: '/dashboard/bot',
    cta: 'Configurar Bot',
    color: 'rgba(47,156,133,1)',
  },
  {
    icon: Users,
    title: 'Cadastre o Primeiro Paciente',
    description:
      'Adicione o perfil do seu paciente com dados de contato, histórico clínico e informações de convênio.',
    href: '/dashboard/pacientes',
    cta: 'Ir para Pacientes',
    color: 'rgba(99,102,241,1)',
  },
  {
    icon: BarChart2,
    title: 'Explore o Financeiro',
    description:
      'Registre despesas, visualize receitas e acompanhe o lucro líquido real da sua clínica em tempo real.',
    href: '/dashboard/financeiro',
    cta: 'Ver Financeiro',
    color: 'rgba(236,72,153,1)',
  },
];

export function GuidedTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const open = searchParams.get('tour') === 'true' && !dismissed;
  const current = STEPS[step];

  const handleClose = useCallback(() => {
    setDismissed(true);
    router.replace('/dashboard');
  }, [router]);

  const handleGo = useCallback(() => {
    setCompleted((prev) => new Set(prev).add(step));
    router.push(current.href);
    handleClose();
  }, [step, current.href, router, handleClose]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setCompleted((prev) => new Set(prev).add(step));
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  }, [step, handleClose]);

  const handleSkip = useCallback(() => {
    handleClose();
  }, [handleClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleSkip}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div
              className="pointer-events-auto w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(47,156,133,0.10) 0%, #09090b 55%)',
                border: '1px solid rgba(47,156,133,0.20)',
                boxShadow: '0 24px 80px -12px rgba(47,156,133,0.30)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(47,156,133,0.8)' }}
                >
                  Tour guiado · {step + 1} / {STEPS.length}
                </span>
                <button
                  onClick={handleSkip}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                  aria-label="Fechar tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 px-6 pb-5">
                {STEPS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="flex items-center gap-1.5 group"
                    aria-label={`Ir para etapa ${i + 1}`}
                  >
                    {completed.has(i) ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#2f9c85' }} />
                    ) : (
                      <span
                        className="w-4 h-4 rounded-full shrink-0 transition-all"
                        style={{
                          background: i === step ? '#2f9c85' : 'rgba(255,255,255,0.12)',
                          boxShadow: i === step ? '0 0 8px rgba(47,156,133,0.6)' : 'none',
                        }}
                      />
                    )}
                    {i < STEPS.length - 1 && (
                      <span
                        className="h-px w-6 transition-colors"
                        style={{ background: completed.has(i) ? '#2f9c85' : 'rgba(255,255,255,0.1)' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="px-6 pb-8"
                >
                  {/* Icon */}
                  <div className="mb-5">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `${current.color.replace('1)', '0.12)')}`,
                        border: `1px solid ${current.color.replace('1)', '0.25)')}`,
                      }}
                    >
                      <current.icon
                        className="w-6 h-6"
                        style={{ color: current.color }}
                      />
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-7">
                    {current.description}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGo}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
                        boxShadow: '0 8px 24px -8px rgba(47,156,133,0.5)',
                      }}
                    >
                      {current.cta}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="py-3 px-4 rounded-xl font-semibold text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors border border-white/10"
                    >
                      {step < STEPS.length - 1 ? 'Pular' : 'Concluir'}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
