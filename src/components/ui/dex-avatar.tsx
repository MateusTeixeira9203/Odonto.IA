'use client';

import { motion } from 'motion/react';
import { prefersReducedMotion } from '@/hooks/useDexGuide';

const TEAL = '#2f9c85';

interface DexAvatarProps {
  /** Diâmetro do avatar em px. */
  size?: number;
  /** Anima escala (respiração) + piscar. Desliga automaticamente com reduced motion. */
  animated?: boolean;
  className?: string;
}

/**
 * Logo canônico do DEX — círculo teal com dois olhos retangulares verticais.
 * Identidade única do DEX no app (substitui usos avulsos do ícone `Bot`).
 * Variante circular do `DexFace` (que é arredondado-quadrado), mantendo a mesma cor de marca.
 */
export function DexAvatar({ size = 32, animated = true, className }: DexAvatarProps) {
  const reduce = prefersReducedMotion();
  const active = animated && !reduce;
  const eyeW = size * 0.14;
  const eyeH = size * 0.34; // retângulos verticais
  // Sombra proporcional ao tamanho — evita "glow blob" em avatares pequenos.
  const shadow = `0 ${Math.round(size * 0.15)}px ${Math.round(size * 0.5)}px -${Math.round(size * 0.18)}px rgba(47,156,133,0.5)`;

  return (
    <motion.div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${TEAL} 0%, #1a7a65 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: size * 0.14,
        flexShrink: 0,
        boxShadow: shadow,
      }}
      animate={active ? { scale: [1, 1.06, 1] } : undefined}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          style={{ width: eyeW, height: eyeH, borderRadius: eyeW, background: '#fff' }}
          animate={active ? { scaleY: [1, 0.15, 1] } : undefined}
          transition={{ duration: 0.24, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut', delay: 0.4 }}
        />
      ))}
    </motion.div>
  );
}
