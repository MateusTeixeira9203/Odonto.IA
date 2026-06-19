'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Check, X, ChevronRight, Mic } from 'lucide-react';
import { useDexGuide } from '@/hooks/useDexGuide';
import type { OnboardingProgresso } from '@/lib/onboarding-progress';

const PASSO_LABEL: Record<string, { label: string; href: string }> = {
  demo:          { label: 'Experimente o Modo Consulta',         href: '/consulta/demo' },
  paciente:      { label: 'Cadastre seu primeiro paciente',      href: '/dashboard/pacientes/novo' },
  consulta_real: { label: 'Faça sua primeira consulta com o DEX', href: '/dashboard/agendamentos' },
  planejamento:  { label: 'Apresente um planejamento',           href: '/dashboard/pacientes' },
  procedimentos: { label: 'Configure seus procedimentos',        href: '/dashboard/configuracoes?aba=procedimentos' },
};

const DISMISS_KEY = (id: string) => `dex_passos_dismiss_v1_${id}`;
const DEMO_DONE_KEY = (id: string) => `dex_demo_done_v1_${id}`;

interface Props {
  progresso: OnboardingProgresso;
  dentistaId: string;
}

export function PrimeirosPassosCard({ progresso, dentistaId }: Props) {
  const router = useRouter();
  const { phase, setPhase } = useDexGuide(dentistaId);
  const [dismissed, setDismissed] = useState(true);
  const [demoLocalDone, setDemoLocalDone] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY(dentistaId)));
    setDemoLocalDone(!!localStorage.getItem(DEMO_DONE_KEY(dentistaId)));
  }, [dentistaId]);

  const passos = progresso.passos.map((p) =>
    p.id === 'demo' ? { ...p, done: p.done || demoLocalDone } : p
  );
  const completos = passos.filter((p) => p.done).length;
  const pct = Math.round((completos / progresso.total) * 100);

  if (dismissed || completos === progresso.total) return null;

  const entrarDemo = () => {
    if (phase === 'point_demo') setPhase('in_demo');
    router.push('/consulta/demo');
  };

  const dispensar = () => {
    localStorage.setItem(DISMISS_KEY(dentistaId), '1');
    setDismissed(true);
    if (phase !== 'done') setPhase('done');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-3xl border border-teal/20 bg-teal/[0.04] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-text-primary">Primeiros passos</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-teal font-bold">{completos} de {progresso.total}</span>
          <button
            onClick={dispensar}
            aria-label="Dispensar primeiros passos"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-teal/15 overflow-hidden mb-4">
        <motion.div
          className="h-full bg-teal"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {passos.map((p) => {
          const meta = PASSO_LABEL[p.id];
          const isDemoStep = p.id === 'demo';
          const pulse = isDemoStep && !p.done && phase === 'point_demo';
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  p.done ? 'bg-teal text-white' : 'border-[1.5px] border-teal/40'
                }`}
              >
                {p.done && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
              {isDemoStep && !p.done ? (
                <button
                  onClick={entrarDemo}
                  className={`flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-1.5 rounded-xl transition-all ${
                    pulse ? 'animate-pulse ring-2 ring-teal/50' : ''
                  }`}
                  style={{ background: 'linear-gradient(135deg, #2f9c85, #1a7a65)' }}
                >
                  <Mic className="w-3.5 h-3.5" /> Entrar no Modo Consulta
                </button>
              ) : (
                <button
                  onClick={() => !p.done && router.push(meta.href)}
                  disabled={p.done}
                  className={`flex items-center gap-1 text-sm text-left ${
                    p.done ? 'text-text-secondary line-through' : 'text-text-primary hover:text-teal'
                  }`}
                >
                  {meta.label}
                  {!p.done && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
