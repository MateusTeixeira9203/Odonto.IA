'use client';

import { motion } from 'motion/react';
import { prefersReducedMotion } from '@/hooks/useDexGuide';

const TEAL = '#2f9c85';

/** Rosto do DEX — bloco arredondado com olhinhos (retângulos altos) que pulsa e pisca. */
export function DexFace({ size = 48 }: { size?: number }) {
  const reduce = prefersReducedMotion();
  const eyeW = size * 0.14;
  const eyeH = size * 0.32; // retângulos altos

  return (
    <motion.div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: `linear-gradient(135deg, ${TEAL} 0%, #1a7a65 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.12,
        flexShrink: 0,
        boxShadow: '0 8px 24px -6px rgba(47,156,133,0.5)',
      }}
      animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          style={{ width: eyeW, height: eyeH, borderRadius: eyeW, background: '#fff' }}
          animate={reduce ? undefined : { scaleY: [1, 0.15, 1] }}
          transition={{ duration: 0.24, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut', delay: 0.4 }}
        />
      ))}
    </motion.div>
  );
}

interface DexMascotProps {
  step: number;
  totalSteps: number;
  text: string;
  onSkip?: () => void;
}

/** Mascote no canto inferior direito: caixinha de fala + rosto do DEX. */
export function DexMascot({ step, totalSteps, text, onSkip }: DexMascotProps) {
  return (
    <div
      className="fixed bottom-7 right-7 z-[120] flex items-end gap-2.5 max-w-[360px]"
      role="status"
      aria-live="polite"
    >
      <div
        className="bg-surface border-[1.5px] rounded-2xl px-4 py-3 shadow-xl"
        style={{ borderColor: TEAL }}
      >
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <span className="text-[11px] font-bold" style={{ color: TEAL }}>
            Dex · passo {step} de {totalSteps}
          </span>
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-[11px] text-text-secondary hover:text-text-primary transition-colors"
            >
              Pular
            </button>
          )}
        </div>
        <p className="text-[13px] text-text-primary leading-relaxed">{text}</p>
      </div>
      <DexFace size={52} />
    </div>
  );
}
