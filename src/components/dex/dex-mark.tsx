'use client';

import { useId } from 'react';
import { motion } from 'motion/react';
import { prefersReducedMotion } from '@/hooks/useDexGuide';

const TEAL = '#2f9c85';
const TEAL_DK = '#1a7a65';

/** Estados de expressão do DEX — o rosto reage ao que o sistema está fazendo. */
export type DexExpression = 'neutro' | 'pensando' | 'feliz' | 'atento';

export interface DexMarkProps {
  /** Diâmetro/lado em px. */
  size?: number;
  /** Silhueta — squircle (mascote/cena) ou circle (avatar em listas/chat). */
  shape?: 'squircle' | 'circle';
  /** Expressão atual. */
  expression?: DexExpression;
  /** Liga respiração/piscar/scan. Desliga sozinho com prefers-reduced-motion. */
  animated?: boolean;
  className?: string;
}

/**
 * DexMark — identidade visual canônica do DEX (o ajudante do dentista).
 *
 * Personagem único usado em TODA superfície (onboarding, Modo Consulta, widget,
 * loaders, feedback). Mantém a "cara" com olhos — familiaridade e presença — mas
 * com acabamento refinado (SVG nítido + leve profundidade) e EXPRESSÕES que reagem
 * ao contexto: neutro, pensando (processando), feliz (concluiu) e atento (ouvindo).
 *
 * Substitui os antigos DexFace (squircle) e DexAvatar (circle), que agora são
 * apenas wrappers finos deste componente.
 */
export function DexMark({
  size = 48,
  shape = 'squircle',
  expression = 'neutro',
  animated = true,
  className,
}: DexMarkProps) {
  const reduce = prefersReducedMotion();
  const active = animated && !reduce;
  const gradId = useId();

  // Geometria em unidades de viewBox (100×100) — escala junto com o size.
  const eyeY = expression === 'pensando' ? 46 : 50;
  const eyeH = expression === 'atento' ? 34 : expression === 'pensando' ? 15 : 30;
  const eyeW = expression === 'pensando' ? 12 : 13;
  const eyeXL = 37;
  const eyeXR = 63;

  const blink = active && (expression === 'neutro' || expression === 'feliz');

  const Background =
    shape === 'circle' ? (
      <circle cx={50} cy={50} r={46} fill={`url(#${gradId})`} />
    ) : (
      <rect x={4} y={4} width={92} height={92} rx={32} fill={`url(#${gradId})`} />
    );

  // Sheen sutil pra dar profundidade premium sem virar "glow".
  const Sheen =
    shape === 'circle' ? (
      <circle cx={50} cy={50} r={46} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
    ) : (
      <rect x={4} y={4} width={92} height={92} rx={32} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1.5} />
    );

  // Render-helper (invocado como função, não como componente) — evita recriar
  // identidade de componente a cada render.
  const renderEye = (cx: number, key: string) => {
    if (expression === 'feliz') {
      // Olhos em arco pra cima (sorriso nos olhos).
      const d = `M ${cx - 7} ${eyeY + 4} Q ${cx} ${eyeY - 7} ${cx + 7} ${eyeY + 4}`;
      return <path key={key} d={d} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" />;
    }
    return (
      <motion.rect
        key={key}
        x={cx - eyeW / 2}
        y={eyeY - eyeH / 2}
        width={eyeW}
        height={eyeH}
        rx={eyeW / 2}
        fill="#fff"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={blink ? { scaleY: [1, 0.12, 1] } : undefined}
        transition={
          blink
            ? { duration: 0.24, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut', delay: 0.4 }
            : undefined
        }
      />
    );
  };

  // Scan horizontal sutil quando "pensando".
  const eyesAnim =
    active && expression === 'pensando'
      ? { x: [-3, 3, -3] as number[] }
      : undefined;

  return (
    <motion.svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="DEX"
      style={{ flexShrink: 0, filter: `drop-shadow(0 ${Math.round(size * 0.12)}px ${Math.round(size * 0.4)}px rgba(47,156,133,0.4))` }}
      animate={active && expression !== 'pensando' ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TEAL} />
          <stop offset="100%" stopColor={TEAL_DK} />
        </linearGradient>
      </defs>

      {Background}
      {Sheen}

      {/* Anel de "atento" (ouvindo) — pulso ao redor. */}
      {active && expression === 'atento' && (
        <motion.circle
          cx={50}
          cy={50}
          r={48}
          fill="none"
          stroke={TEAL}
          strokeWidth={2}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <motion.g animate={eyesAnim} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
        {renderEye(eyeXL, 'l')}
        {renderEye(eyeXR, 'r')}
      </motion.g>
    </motion.svg>
  );
}
