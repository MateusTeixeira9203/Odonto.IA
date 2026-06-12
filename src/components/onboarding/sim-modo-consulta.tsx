'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Sparkles, Check } from 'lucide-react';

// ── Typing hook ───────────────────────────────────────────────────────────────
function useTypingText(text: string, startDelay: number, speed = 32): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, startDelay, speed]);
  return displayed;
}

// ── Waveform bar ──────────────────────────────────────────────────────────────
function WaveBar({ delay, height }: { delay: number; height: number }) {
  return (
    <motion.div
      className="rounded-full"
      style={{ width: 3, background: '#2f9c85' }}
      animate={{ height: [4, height, 4] }}
      transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

const WAVE_BARS = [8, 18, 28, 20, 12, 30, 16, 26, 10, 22, 28, 14, 24, 18, 30];

// ── Odontogram tooth ─────────────────────────────────────────────────────────
function Tooth({ number, highlight }: { number: number; highlight: boolean }) {
  return (
    <motion.div
      animate={{
        background: highlight ? 'rgba(47,156,133,0.25)' : 'rgba(255,255,255,0.05)',
        borderColor: highlight ? 'rgba(47,156,133,0.7)' : 'rgba(255,255,255,0.1)',
        scale: highlight ? 1.18 : 1,
      }}
      transition={{ duration: 0.4 }}
      className="w-6 h-7 rounded-md border flex items-center justify-center text-[8px] font-bold"
      style={{ color: highlight ? '#2f9c85' : 'rgba(255,255,255,0.3)' }}
    >
      {number}
    </motion.div>
  );
}

const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];

// ── Ficha field ───────────────────────────────────────────────────────────────
function FichaField({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(47,156,133,0.7)' }}>
        {label}
      </p>
      <p className="text-xs text-white/80 leading-relaxed">{value}</p>
    </motion.div>
  );
}

// ── Timeline constants (ms) ───────────────────────────────────────────────────
const T = {
  WAVE_START:       600,
  TEXT_START:       1200,
  TEXT_1:           'Paciente relata dor ao mastigar no lado direito. Verificado desgaste em dente 46.',
  TEXT_2:           ' Necessita restauração em resina composta. Raio-X periapical solicitado.',
  PROCESSING_START: 4600,
  FICHA_START:      5400,
  BADGE_START:      6600,
  ORC_START:        7400,
  RESET:            9800,
};

// ── Main ──────────────────────────────────────────────────────────────────────

export function SimModoConsulta() {
  const [phase, setPhase]         = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [showFicha, setShowFicha] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [showOrc, setShowOrc]     = useState(false);
  const [toothHighlight, setTooth]= useState(false);
  const timerRef                  = useRef<ReturnType<typeof setTimeout>[]>([]);

  function schedule(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timerRef.current.push(t);
  }

  function reset() {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    setPhase('idle');
    setShowFicha(false);
    setShowBadge(false);
    setShowOrc(false);
    setTooth(false);
  }

  useEffect(() => {
    schedule(() => setPhase('recording'),   T.WAVE_START);
    schedule(() => setPhase('processing'),  T.PROCESSING_START);
    schedule(() => { setPhase('done'); setShowFicha(true); setTooth(true); }, T.FICHA_START);
    schedule(() => setShowBadge(true),      T.BADGE_START);
    schedule(() => setShowOrc(true),        T.ORC_START);
    schedule(() => reset(),                 T.RESET);
    return reset;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text1 = useTypingText(T.TEXT_1, T.TEXT_START, 28);
  const text2 = useTypingText(T.TEXT_2, T.TEXT_START + T.TEXT_1.length * 28 + 200, 24);
  const fullText = text1 + text2;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-[440px] mx-auto select-none"
    >
      {/* ── Patient header ── */}
      <div
        className="rounded-2xl px-5 py-3.5 mb-3 flex items-center gap-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: 'rgba(47,156,133,0.18)', color: '#2f9c85' }}>
          AS
        </div>
        <div>
          <p className="text-white/90 text-sm font-semibold">Ana Souza</p>
          <p className="text-white/35 text-[11px]">34 anos · Retorno</p>
        </div>
        {/* Status badge */}
        <AnimatePresence>
          {phase === 'recording' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-red-400"
                animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
              />
              Gravando
            </motion.div>
          )}
          {phase === 'processing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(47,156,133,0.15)', color: '#2f9c85', border: '1px solid rgba(47,156,133,0.3)' }}
            >
              <Sparkles className="w-3 h-3" />
              Processando IA
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mic + waveform ── */}
      <div
        className="rounded-2xl px-5 py-4 mb-3 flex items-center gap-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Mic button */}
        <motion.div
          animate={{
            background: phase === 'recording'
              ? ['rgba(239,68,68,0.2)', 'rgba(239,68,68,0.35)', 'rgba(239,68,68,0.2)']
              : 'rgba(47,156,133,0.15)',
            borderColor: phase === 'recording' ? 'rgba(239,68,68,0.5)' : 'rgba(47,156,133,0.3)',
          }}
          transition={{ duration: 0.9, repeat: phase === 'recording' ? Infinity : 0 }}
          className="w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0"
        >
          <Mic className="w-5 h-5" style={{ color: phase === 'recording' ? '#f87171' : '#2f9c85' }} />
        </motion.div>

        {/* Waveform / transcript */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Clique para iniciar a consulta
              </motion.p>
            )}
            {phase === 'recording' && !fullText && (
              <motion.div key="wave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-[3px] h-8">
                {WAVE_BARS.map((h, i) => (
                  <WaveBar key={i} delay={i * 0.04} height={h} />
                ))}
              </motion.div>
            )}
            {(phase === 'recording' || phase === 'processing' || phase === 'done') && fullText && (
              <motion.p key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {fullText}
                {phase === 'recording' && (
                  <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
                    style={{ color: '#2f9c85' }}>|</motion.span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Odontogram strip ── */}
      <div
        className="rounded-2xl px-4 py-3 mb-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Odontograma
        </p>
        <div className="space-y-1.5">
          <div className="flex gap-1 justify-center">
            {LOWER_RIGHT.map((n) => <Tooth key={n} number={n} highlight={toothHighlight && n === 46} />)}
          </div>
          <div className="flex gap-1 justify-center">
            {LOWER_LEFT.map((n) => <Tooth key={n} number={n} highlight={false} />)}
          </div>
        </div>
      </div>

      {/* ── Structured ficha ── */}
      <AnimatePresence>
        {showFicha && (
          <motion.div
            key="ficha"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl px-5 py-4 mb-3 space-y-3"
            style={{ background: 'rgba(47,156,133,0.07)', border: '1px solid rgba(47,156,133,0.25)' }}
          >
            <FichaField label="Queixa principal"  value="Dor ao mastigar — lado direito"         delay={0}    />
            <FichaField label="Diagnóstico"        value="Desgaste oclusal — dente 46"            delay={0.12} />
            <FichaField label="Procedimento"       value="Restauração em resina composta"         delay={0.24} />
            <FichaField label="Exame solicitado"   value="Raio-X periapical"                     delay={0.36} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Badge + Orçamento row ── */}
      <div className="flex items-center gap-2">
        <AnimatePresence>
          {showBadge && (
            <motion.div
              key="badge"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 200 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(47,156,133,0.18)', color: '#2f9c85', border: '1px solid rgba(47,156,133,0.35)' }}
            >
              <Check className="w-3 h-3 stroke-[3]" />
              Ficha estruturada em 4s
            </motion.div>
          )}
          {showOrc && (
            <motion.div
              key="orc"
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Orçamento · R$&nbsp;320
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
