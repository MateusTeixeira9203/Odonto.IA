'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type AtendimentoDia = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Agendado',   cls: 'bg-surface-alt text-text-secondary' },
  confirmed:   { label: 'Confirmado', cls: 'bg-teal/10 text-teal' },
  checked_in:  { label: 'Chegou',     cls: 'bg-teal/10 text-teal' },
  in_progress: { label: 'Em curso',   cls: 'bg-teal/10 text-teal' },
  completed:   { label: 'Concluído',  cls: 'bg-surface-alt text-text-secondary/50' },
  no_show:     { label: 'Faltou',     cls: 'bg-surface-alt text-text-secondary/50' },
  cancelled:   { label: 'Cancelado',  cls: 'bg-surface-alt text-text-secondary/50' },
};

interface DexDayButtonProps {
  atendimentos: AtendimentoDia[];
  dataHojeISO: string;
}

export function DexDayButton({ atendimentos, dataHojeISO }: DexDayButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (atendimentos.length === 0) return null;

  const dataFormatada = format(new Date(dataHojeISO), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group mt-3 inline-flex items-center gap-2 text-sm text-text-secondary hover:text-teal transition-colors"
      >
        <span className="text-teal font-bold text-[15px] leading-none">◆</span>
        <span>Ver procedimentos do dia</span>
        <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all" />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-teal font-bold text-sm leading-none">◆</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal">Dex</span>
                  </div>
                  <h2 className="font-heading font-bold text-2xl text-text-primary tracking-tight leading-tight">
                    Procedimentos de hoje
                  </h2>
                  <p className="text-xs text-text-secondary mt-1 capitalize">
                    {dataFormatada} &middot; {atendimentos.length} atendimento{atendimentos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 hover:bg-surface-alt rounded-xl transition-colors text-text-secondary hover:text-text-primary shrink-0 mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {atendimentos.map((apt, i) => {
                  const hora = format(parseISO(apt.data_hora), 'HH:mm');
                  const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
                  const isDone = ['completed', 'no_show', 'cancelled'].includes(apt.status);
                  const alertas = apt.paciente?.observacoes
                    ? apt.paciente.observacoes.split('\n').map((l) => l.trim()).filter(Boolean)
                    : [];

                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.22 }}
                      className={`p-4 rounded-2xl border border-border transition-colors ${
                        isDone
                          ? 'bg-surface opacity-45'
                          : 'bg-surface hover:bg-surface-alt'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="font-mono text-sm font-bold text-text-secondary shrink-0 pt-px">
                            {hora}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-text-primary leading-snug">
                                {apt.paciente?.nome ?? '—'}
                              </p>
                              {alertas.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15">
                                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                  {alertas[0]}
                                </span>
                              )}
                            </div>
                            {apt.observacoes && (
                              <p className="text-xs text-text-secondary mt-0.5 truncate">
                                {apt.observacoes}
                              </p>
                            )}
                            {!apt.observacoes && (
                              <p className="text-xs text-text-secondary/40 mt-0.5 italic">
                                Sem procedimento registrado
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ${cfg.cls}`}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border shrink-0">
                <p className="text-[11px] text-text-secondary/50 text-center">
                  Procedimentos baseados nas observações de cada agendamento
                </p>
              </div>
            </motion.div>
          </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
