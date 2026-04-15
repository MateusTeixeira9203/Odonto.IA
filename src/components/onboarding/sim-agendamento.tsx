'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, User, Stethoscope } from 'lucide-react';

function useTypingText(text: string, startDelay: number, speed = 70): string {
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

interface SimAgendamentoProps { onComplete?: () => void }

export function SimAgendamento({ onComplete }: SimAgendamentoProps) {
  const [visible,   setVisible]   = useState(true);
  const [showSave,  setShowSave]  = useState(false);

  const paciente = useTypingText('Ana Souza',          400,  90);
  const data     = useTypingText('15/05/2025',          2200, 80);
  const horario  = useTypingText('14:30',               4200, 110);
  const proc     = useTypingText('Limpeza + Avaliação', 6000, 75);

  useEffect(() => {
    const t1 = setTimeout(() => setShowSave(true),                     8500);
    const t2 = setTimeout(() => { setVisible(false); onComplete?.(); }, 10000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
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
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Novo Agendamento</h3>
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Paciente */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Paciente
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 min-h-5">
                  {paciente}<span className="animate-pulse opacity-60">|</span>
                </span>
              </div>
            </div>

            {/* Data + Horário */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Data
                </label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-800 min-h-5">{data}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Horário
                </label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-800 min-h-5">{horario}</span>
                </div>
              </div>
            </div>

            {/* Procedimento */}
            <div className="mb-6">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Procedimento
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 min-h-5">{proc}</span>
              </div>
            </div>

            {/* Botão salvar */}
            <AnimatePresence>
              {showSave && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)',
                    boxShadow: '0 8px 24px -4px rgba(47,156,133,0.5)',
                  }}
                >
                  Salvar Agendamento ✓
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
