'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Sparkles } from 'lucide-react';

function useTypingText(text: string, startDelay: number, speed = 38): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
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

const EVOLUCAO =
  'Paciente relata dor ao mastigar no lado direito. Verificado desgaste em dente 46 com necessidade de restauração. Solicitado raio-x periapical.';

// 38ms × 145 chars ≈ 5510ms + 500ms delay = ~6s para o texto terminar
const TYPING_DURATION = 500 + EVOLUCAO.length * 38;

interface SimFichaProps { onComplete?: () => void }

export function SimFicha({ onComplete }: SimFichaProps) {
  const [visible,   setVisible]   = useState(true);
  const [showTooth, setShowTooth] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  const evolucao = useTypingText(EVOLUCAO, 500, 38);

  useEffect(() => {
    const t1 = setTimeout(() => setShowTooth(true),                     TYPING_DURATION);
    const t2 = setTimeout(() => setShowBadge(true),                     TYPING_DURATION + 900);
    const t3 = setTimeout(() => { setVisible(false); onComplete?.(); }, TYPING_DURATION + 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
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
            className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(47,156,133,0.1)' }}
              >
                <Mic className="w-4 h-4" style={{ color: '#2f9c85' }} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Evolução Clínica</h3>
                <p className="text-xs text-gray-400">Ana Souza · hoje</p>
              </div>
            </div>

            {/* Área de texto */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4 min-h-[100px]">
              <p className="text-sm text-gray-800 leading-relaxed">
                {evolucao}
                <span className="animate-pulse opacity-50">|</span>
              </p>
            </div>

            {/* Dente destacado */}
            <AnimatePresence>
              {showTooth && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                  style={{
                    background: 'rgba(47,156,133,0.07)',
                    border: '1px solid rgba(47,156,133,0.2)',
                  }}
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(47,156,133,0.5)',
                        '0 0 0 10px rgba(47,156,133,0)',
                        '0 0 0 0 rgba(47,156,133,0)',
                      ],
                    }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-white shrink-0"
                    style={{ background: '#2f9c85' }}
                  >
                    46
                  </motion.div>
                  <span className="text-sm font-medium" style={{ color: '#2f9c85' }}>
                    Dente 46 identificado — restauração necessária
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge IA */}
            <AnimatePresence>
              {showBadge && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 py-3 px-4 rounded-xl w-full justify-center font-bold text-sm text-white"
                  style={{
                    background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)',
                    boxShadow: '0 8px 24px -4px rgba(47,156,133,0.5)',
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  IA pronta para gerar orçamento
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
