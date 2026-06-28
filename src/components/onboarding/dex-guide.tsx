'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useDexGuide, prefersReducedMotion } from '@/hooks/useDexGuide';
import { DexMascot } from './dex-mascot';

interface DexGuideProps {
  /** Mantido por compat com o ponto de montagem; não usado após a apresentação migrar pro aha. */
  nome?: string;
  dentistaId: string;
}

/**
 * Guia do DEX na superfície do dashboard.
 *
 * A apresentação do DEX migrou para o passo `aha` do onboarding (Workstream A/F),
 * então a antiga cena preta de boas-vindas foi REMOVIDA — ela duplicava o primeiro
 * contato com o DEX. Resta só o mascote no canto que aponta pra demo (útil pra quem
 * pulou a demo no onboarding); o alvo é o card de primeiros passos.
 */
export function DexGuide({ dentistaId }: DexGuideProps) {
  const { phase, setPhase } = useDexGuide(dentistaId);
  const reduce = prefersReducedMotion();

  return (
    <AnimatePresence>
      {phase === 'point_demo' && (
        <motion.div
          key="mascot"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -120 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        >
          <DexMascot
            step={1}
            totalSteps={3}
            text="Deixei um paciente demo pronto pra você testar. Clique no botão que está brilhando 👇"
            onSkip={() => setPhase('done')}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
