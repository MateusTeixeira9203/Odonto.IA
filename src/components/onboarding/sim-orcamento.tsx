'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Sparkles } from 'lucide-react';

const ITEMS = [
  { descricao: 'Limpeza (Profilaxia)',   valor: 150 },
  { descricao: 'Restauração (Dente 46)', valor: 320 },
  { descricao: 'Avaliação Clínica',      valor: 80  },
] as const;

const TOTAL = ITEMS.reduce((s, i) => s + i.valor, 0); // 550

function useCounter(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function fmt(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface SimOrcamentoProps { onComplete?: () => void }

export function SimOrcamento({ onComplete }: SimOrcamentoProps) {
  const [visible,       setVisible]       = useState(true);
  const [visibleItems,  setVisibleItems]  = useState(0);
  const [countActive,   setCountActive]   = useState(false);
  const [showBadge,     setShowBadge]     = useState(false);

  const total = useCounter(TOTAL, countActive);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleItems(1),   900),
      setTimeout(() => setVisibleItems(2),   2900),
      setTimeout(() => setVisibleItems(3),   4900),
      setTimeout(() => setCountActive(true), 6500),
      setTimeout(() => setShowBadge(true),   8500),
      setTimeout(() => { setVisible(false); onComplete?.(); }, 10000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9994 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(47,156,133,0.1)' }}
              >
                <FileText className="w-4 h-4" style={{ color: '#2f9c85' }} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Orçamento — Ana Souza</h3>
                <p className="text-xs text-gray-400">Gerado automaticamente pela IA</p>
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2 mb-4">
              {ITEMS.slice(0, visibleItems).map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                  style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
                >
                  <span className="text-sm text-gray-700">{item.descricao}</span>
                  <span className="text-sm font-semibold font-mono" style={{ color: '#2f9c85' }}>
                    {fmt(item.valor)}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Total counter */}
            <AnimatePresence>
              {countActive && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between py-3 px-4 rounded-xl mb-4"
                  style={{
                    background: 'rgba(47,156,133,0.06)',
                    border: '1.5px solid rgba(47,156,133,0.18)',
                  }}
                >
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="font-mono font-bold text-lg" style={{ color: '#2f9c85' }}>
                    {fmt(total)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge */}
            <AnimatePresence>
              {showBadge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="flex items-center gap-2 justify-center py-2.5 rounded-xl font-semibold text-xs"
                  style={{ background: 'rgba(47,156,133,0.10)', color: '#2f9c85' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Orçamento gerado por IA — pronto para enviar
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
