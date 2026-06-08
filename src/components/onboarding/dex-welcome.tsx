'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface DexWelcomeProps {
  nome: string;
  dentistaId: string;
}

const STORAGE_KEY = (id: string) => `dex_welcome_v1_${id}`;

const EASE = [0.22, 1, 0.36, 1] as const;

const TRANSITION = { duration: 0.3, ease: EASE };

export function DexWelcome({ nome: _nome, dentistaId }: DexWelcomeProps) {
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);

  // Verificar localStorage após mount para evitar hydration mismatch
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY(dentistaId))) {
      setDone(true);
    }
  }, [dentistaId]);

  function finish() {
    localStorage.setItem(STORAGE_KEY(dentistaId), '1');
    setDone(true);
  }

  function next() {
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(47,156,133,0.07) 0%, transparent 70%), rgba(0,0,0,0.95)',
      }}
    >
      {/* Skip button */}
      <button
        onClick={finish}
        className="absolute top-6 right-6 text-sm font-medium text-white/30 hover:text-white/60 transition-colors duration-200"
      >
        Pular
      </button>

      {/* Slide content */}
      <div className="max-w-lg mx-auto px-6 w-full">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={TRANSITION}
              className="flex flex-col items-center text-center gap-8"
            >
              <DexSymbol />

              <div className="flex flex-col gap-3">
                <h1
                  className="font-heading text-5xl md:text-6xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Sou o Dex.
                </h1>
                <p className="text-xl text-white/50 font-medium">
                  Seu copiloto clínico.
                </p>
              </div>

              <ActionButton onClick={next}>Conhecer →</ActionButton>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={TRANSITION}
              className="flex flex-col items-center text-center gap-8"
            >
              <div className="flex flex-col gap-2">
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Antes de você chegar,
                </h2>
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold"
                  style={{ color: '#2f9c85', letterSpacing: '-0.02em' }}
                >
                  já sei o seu dia.
                </h2>
              </div>

              <p className="text-base text-white/50 max-w-sm leading-relaxed">
                Procedimentos, alertas de pacientes e próximas consultas —
                organizados automaticamente.
              </p>

              {/* Decorative: "Ver procedimentos do dia" button mockup */}
              <div
                className="flex items-center gap-3 px-5 py-3 rounded-2xl border"
                style={{
                  background: 'rgba(47,156,133,0.08)',
                  borderColor: 'rgba(47,156,133,0.25)',
                }}
              >
                <span style={{ color: '#2f9c85', fontSize: '18px' }}>◆</span>
                <span className="text-sm font-medium text-white/70 font-mono">
                  Ver procedimentos do dia
                </span>
              </div>

              <ActionButton onClick={next}>Continuar →</ActionButton>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={TRANSITION}
              className="flex flex-col items-center text-center gap-8"
            >
              <div className="flex flex-col gap-2">
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Alertas, métricas,
                </h2>
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold"
                  style={{ color: '#2f9c85', letterSpacing: '-0.02em' }}
                >
                  fechamento do dia.
                </h2>
              </div>

              <p className="text-base text-white/50 max-w-sm leading-relaxed">
                Tudo disponível quando você precisar — sem precisar abrir nada.
              </p>

              {/* Decorative: mini Dex panel mockup */}
              <DexPanelMockup />

              <ActionButton onClick={next}>Continuar →</ActionButton>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={TRANSITION}
              className="flex flex-col items-center text-center gap-8"
            >
              <div className="flex flex-col gap-2">
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Durante a consulta,
                </h2>
                <h2
                  className="font-heading text-4xl md:text-5xl font-bold"
                  style={{ color: '#2f9c85', letterSpacing: '-0.02em' }}
                >
                  trabalho junto com você.
                </h2>
              </div>

              <p className="text-base text-white/50 max-w-sm leading-relaxed">
                Estruturo sua ficha clínica enquanto você fala. Sem digitação,
                sem burocracia.
              </p>

              <WaveformIcon />

              <ActionButton onClick={finish}>Começar →</ActionButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? '20px' : '6px',
              height: '6px',
              background: i === step ? '#2f9c85' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function DexSymbol() {
  return (
    <motion.div
      animate={{
        scale: [1, 1.08, 1],
        opacity: [0.9, 1, 0.9],
      }}
      transition={{
        duration: 2.8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        fontSize: '72px',
        color: '#2f9c85',
        lineHeight: 1,
        filter: 'drop-shadow(0 0 24px rgba(47,156,133,0.5))',
      }}
    >
      ◆
    </motion.div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="px-8 py-3.5 rounded-2xl font-bold text-base text-white transition-shadow duration-200"
      style={{
        background: '#2f9c85',
        boxShadow: '0 8px 32px rgba(47,156,133,0.4)',
      }}
    >
      {children}
    </motion.button>
  );
}

function DexPanelMockup() {
  const items: { label: string; value: string }[] = [
    { label: 'Receita hoje', value: 'R$ 1.840' },
    { label: 'Consultas', value: '6 / 8' },
    { label: 'Atenção', value: '2 alertas' },
  ];

  return (
    <div
      className="w-full max-w-xs rounded-2xl border p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: '#2f9c85', fontSize: '12px' }}>◆</span>
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
          Dex
        </span>
      </div>
      {items.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-xs text-white/40">{label}</span>
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function WaveformIcon() {
  const bars = [3, 6, 10, 14, 10, 6, 14, 10, 6, 3];

  return (
    <div className="flex items-end gap-1" style={{ height: '32px' }}>
      {bars.map((h, i) => (
        <motion.div
          key={i}
          animate={{ scaleY: [1, 1.5, 0.7, 1.2, 1] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
          className="w-1 rounded-full"
          style={{
            height: `${h}px`,
            background: '#2f9c85',
            opacity: 0.7,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}
