'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useDexGuide, prefersReducedMotion } from '@/hooks/useDexGuide';
import { DexFace, DexMascot } from './dex-mascot';

const TEAL = '#2f9c85';

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

interface DexGuideProps {
  nome: string;
  dentistaId: string;
}

/**
 * Orquestrador do onboarding guiado na superfície do dashboard.
 * - Cena de abertura (tela escura, DEX no centro, saudação) → "Começar"
 * - Depois o DEX sobe pro canto e aponta pro botão da demo (card de primeiros passos)
 */
export function DexGuide({ nome, dentistaId }: DexGuideProps) {
  const { phase, setPhase } = useDexGuide(dentistaId);
  const firstName = nome.split(' ')[0];
  const reduce = prefersReducedMotion();

  return (
    <>
      {/* ── Cena de abertura ── */}
      <AnimatePresence>
        {phase === 'welcome' && (
          <motion.div
            key="welcome"
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(47,156,133,0.07) 0%, transparent 70%), rgba(0,0,0,0.95)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setPhase('done')}
              className="absolute top-6 right-6 text-sm font-medium text-white/30 hover:text-white/60 transition-colors"
            >
              Pular
            </button>

            <motion.div
              className="flex flex-col items-center text-center gap-7 px-6 max-w-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <DexFace size={72} />
              <div className="flex flex-col gap-3">
                <h1
                  className="font-heading text-4xl md:text-5xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {saudacao()}, Dr(a). {firstName}.
                </h1>
                <p className="text-lg text-white/55 leading-relaxed max-w-md">
                  Eu sou o Dex, seu copiloto no sistema. Em 1 minuto eu te mostro como nunca mais
                  digitar uma ficha.
                </p>
              </div>
              <motion.button
                onClick={() => setPhase('point_demo')}
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="px-8 py-3.5 rounded-2xl font-bold text-base text-white"
                style={{ background: TEAL, boxShadow: '0 8px 32px rgba(47,156,133,0.4)' }}
              >
                Começar →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mascote no canto apontando pra demo ── */}
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
    </>
  );
}
