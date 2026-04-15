'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Sparkles, Loader2, Send } from 'lucide-react';

// Orçamento sendo gerado a partir da ficha no perfil do paciente
// Timeline (~10s):
// 0ms      : card da ficha clínica aparece
// 1400ms   : botão "Gerar Orçamento" aparece
// 2400ms   : estado "gerando" (spinner)
// 4200ms   : item 1
// 5600ms   : item 2
// 7000ms   : item 3
// 8000ms   : total counter ativo
// 9000ms   : badge + botão enviar
// 10000ms  : fecha

const ITEMS = [
  { descricao: 'Restauração (Dente 46)', valor: 320 },
  { descricao: 'Limpeza (Profilaxia)',   valor: 150 },
  { descricao: 'Avaliação Clínica',      valor: 80  },
] as const;

const TOTAL = ITEMS.reduce((s, i) => s + i.valor, 0);

function useCounter(target: number, active: boolean, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
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

interface SimOrcamentoPerfilProps { onComplete?: () => void }

export function SimOrcamentoPerfil({ onComplete }: SimOrcamentoPerfilProps) {
  const [visible,       setVisible]       = useState(true);
  const [showButton,    setShowButton]    = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [visibleItems,  setVisibleItems]  = useState(0);
  const [countActive,   setCountActive]   = useState(false);
  const [showBadge,     setShowBadge]     = useState(false);
  const [showSend,      setShowSend]      = useState(false);

  const total = useCounter(TOTAL, countActive);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowButton(true),                              1400),
      setTimeout(() => setGenerating(true),                              2400),
      setTimeout(() => { setGenerating(false); setVisibleItems(1); },   4200),
      setTimeout(() => setVisibleItems(2),                               5600),
      setTimeout(() => setVisibleItems(3),                               7000),
      setTimeout(() => setCountActive(true),                             8000),
      setTimeout(() => { setShowBadge(true); setShowSend(true); },      9000),
      setTimeout(() => { setVisible(false); onComplete?.(); },          10000),
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
            className="bg-white rounded-2xl shadow-2xl w-[460px] max-w-[90vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header — perfil do paciente */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Perfil do Paciente</p>
                <h3 className="font-semibold text-gray-900">Ana Souza</h3>
              </div>
              <div className="flex gap-1.5">
                {['Fichas Clínicas', 'Planejamento', 'Orçamentos'].map((tab, i) => (
                  <span
                    key={tab}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                    style={i === 2
                      ? { background: 'rgba(47,156,133,0.12)', color: '#2f9c85' }
                      : { background: '#f3f4f6', color: '#9ca3af' }}
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>

            {/* Card da ficha clínica */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Evolução clínica — hoje</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                "Dor ao mastigar lado direito. Desgaste em dente 46 com necessidade de restauração.
                Solicitado raio-x periapical."
              </p>
            </div>

            {/* Botão gerar orçamento */}
            <AnimatePresence>
              {showButton && !generating && visibleItems === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center mb-4"
                >
                  <motion.div
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)',
                      boxShadow: '0 6px 20px -4px rgba(47,156,133,0.55)',
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Gerar Orçamento com IA
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spinner gerando */}
            <AnimatePresence>
              {generating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 justify-center py-4 mb-4"
                  style={{ color: '#2f9c85' }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Analisando ficha clínica...</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Itens do orçamento */}
            {visibleItems > 0 && (
              <div className="space-y-2 mb-4">
                {ITEMS.slice(0, visibleItems).map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
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
            )}

            {/* Total */}
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

            {/* Badge + botão enviar */}
            <AnimatePresence>
              {showBadge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="space-y-2"
                >
                  <div
                    className="flex items-center gap-2 justify-center py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(47,156,133,0.10)', color: '#2f9c85' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Orçamento gerado — pronto para enviar ao paciente
                  </div>
                  {showSend && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 justify-center py-2.5 rounded-xl font-bold text-sm text-white"
                      style={{
                        background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)',
                        boxShadow: '0 6px 20px -4px rgba(47,156,133,0.5)',
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar pelo WhatsApp
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
