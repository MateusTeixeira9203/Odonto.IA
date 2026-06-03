'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Pill, Stethoscope, ArrowRight, X } from 'lucide-react';

export interface AlertaClinico {
  tipo: 'alergia' | 'condicao' | 'medicamento';
  texto: string;
}

interface ModoConsultaLoaderProps {
  agendamentoId: string;
  pacienteNome: string;
  hora: string;
  ultimoProcedimento: string | null;
  alertas: AlertaClinico[];
  onClose: () => void;
}

const ICON_MAP = {
  alergia:    { Icon: AlertTriangle, color: 'text-coral' },
  condicao:   { Icon: Stethoscope,  color: 'text-amber-400' },
  medicamento:{ Icon: Pill,         color: 'text-blue-400' },
} as const;

export function ModoConsultaLoader({
  agendamentoId,
  pacienteNome,
  hora,
  ultimoProcedimento,
  alertas,
  onClose,
}: ModoConsultaLoaderProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const firstName = pacienteNome.split(' ')[0];

  useEffect(() => {
    const t = setTimeout(() => setPhase('ready'), 1600);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = () => {
    onClose();
    router.push(`/consulta/${agendamentoId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-surface border border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Dex */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #2f9c85, #1d7a68)' }}
            animate={phase === 'loading' ? {
              boxShadow: [
                '0 0 0 0 rgba(47,156,133,0)',
                '0 0 0 14px rgba(47,156,133,0.18)',
                '0 0 0 0 rgba(47,156,133,0)',
              ],
            } : { boxShadow: '0 8px 32px rgba(47,156,133,0.35)' }}
            transition={{ duration: 1.8, repeat: phase === 'loading' ? Infinity : 0 }}
          >
            D
          </motion.div>
        </div>

        {/* Cabeçalho */}
        <div className="text-center mb-5">
          <AnimatePresence mode="wait">
            {phase === 'loading' ? (
              <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-text-secondary mb-1">Preparando consulta de</p>
                <p className="font-heading text-2xl text-text-primary">{firstName}</p>
                <p className="text-xs text-text-secondary mt-1 font-mono">{hora}</p>
              </motion.div>
            ) : (
              <motion.div key="b" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-sm text-teal font-semibold mb-1">Contexto clínico pronto</p>
                <p className="font-heading text-2xl text-text-primary">{firstName}</p>
                <p className="text-xs text-text-secondary mt-1 font-mono">{hora}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="bg-surface-alt rounded-2xl p-4 mb-4 space-y-2">
            {alertas.map((alerta, i) => {
              const { Icon, color } = ICON_MAP[alerta.tipo];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className={`flex items-start gap-2 text-xs ${color}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{alerta.texto}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Último procedimento */}
        {ultimoProcedimento && (
          <div className="flex items-center gap-2 mb-4 text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            Último: {ultimoProcedimento}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 mb-6 text-xs min-h-[20px]">
          <AnimatePresence mode="wait">
            {phase === 'loading' ? (
              <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-text-secondary">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-teal"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
                Dex preparando contexto clínico...
              </motion.span>
            ) : (
              <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-teal font-semibold">
                ✓ Pronto para atender
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleEnter}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white"
              style={{ background: '#2f9c85', boxShadow: '0 4px 20px rgba(47,156,133,0.38)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Entrar agora
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <button onClick={handleEnter} className="w-full mt-3 text-xs text-text-secondary hover:text-text-primary transition-colors py-1">
          Pular transição
        </button>
      </motion.div>
    </motion.div>
  );
}
