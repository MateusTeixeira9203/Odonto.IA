'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, MessageCircle, CreditCard, CheckCircle2 } from 'lucide-react';

const ORCAMENTOS = [
  { nome: 'Carlos Lima',  desc: 'Implante Dente 36',     valor: 3200, baseStatus: 'aprovado' as const },
  { nome: 'Ana Souza',    desc: 'Restauração + Limpeza', valor:  550, baseStatus: 'enviado'  as const },
  { nome: 'Pedro Alves',  desc: 'Avaliação Clínica',     valor:   80, baseStatus: 'rascunho' as const },
];

type Status = 'rascunho' | 'enviado' | 'aprovado';

const STATUS_CFG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  rascunho: { label: 'Rascunho', color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' },
  enviado:  { label: 'Enviado',  color: '#f59e0b',               bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'   },
  aprovado: { label: 'Aprovado', color: '#34d399',               bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'   },
};

function fmt(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

interface SimOrcamentoProps { onComplete?: () => void }

export function SimOrcamento({ onComplete }: SimOrcamentoProps) {
  const [visibleCount, setVisibleCount]   = useState(0);
  const [card1Status,  setCard1Status]    = useState<Status>('enviado');
  const [showPayBtn,   setShowPayBtn]     = useState(false);
  const [showWhatsApp, setShowWhatsApp]   = useState(false);
  const [showPaid,     setShowPaid]       = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleCount(1),          500),
      setTimeout(() => setVisibleCount(2),          1400),
      setTimeout(() => setVisibleCount(3),          2300),
      setTimeout(() => setCard1Status('aprovado'),  3400),
      setTimeout(() => setShowPayBtn(true),         4400),
      setTimeout(() => setShowWhatsApp(true),       5200),
      setTimeout(() => setShowPaid(true),           6200),
      setTimeout(() => { onComplete?.(); },         8500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const statuses: Status[] = ['aprovado', card1Status, 'rascunho'];

  return (
    <motion.div
      className="w-full max-w-[460px] mx-auto px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 180 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(47,156,133,0.2)' }}>
          <FileText className="w-4 h-4 text-[#2f9c85]" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">Orçamentos</p>
          <p className="text-white/40 text-[10px]">3 ativos · maio 2025</p>
        </div>
        <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: 'rgba(47,156,133,0.15)', color: '#2f9c85', border: '1px solid rgba(47,156,133,0.25)' }}>
          <CheckCircle2 className="w-2.5 h-2.5" />
          2 aprovados
        </div>
      </div>

      {/* Budget cards */}
      <div className="flex flex-col gap-2.5">
        {ORCAMENTOS.slice(0, visibleCount).map((orc, i) => {
          const status = statuses[i];
          const cfg    = STATUS_CFG[status];
          const isAna  = i === 1;
          const isPedro = i === 2;

          return (
            <motion.div key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 240 }}
              className="rounded-2xl p-3.5"
              style={{
                background: status === 'aprovado' ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${status === 'aprovado' ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'background 0.4s, border-color 0.4s',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white/85 text-[12px] font-semibold leading-none mb-0.5">{orc.nome}</p>
                  <p className="text-white/35 text-[10px]">{orc.desc}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="font-mono font-bold text-sm" style={{ color: '#2f9c85' }}>{fmt(orc.valor)}</p>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={status}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: 'spring', damping: 18, stiffness: 280 }}
                      className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      {cfg.label}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              {/* Registrar Pagamento — Ana Souza, após aprovação */}
              <AnimatePresence>
                {isAna && showPayBtn && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 pt-2.5 flex gap-2"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <motion.button
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 18 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
                      >
                        <CreditCard className="w-3 h-3" />
                        {showPaid ? 'Pago — R$ 550,00 ✓' : 'Registrar Pagamento'}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Enviar WhatsApp — Pedro Alves, rascunho */}
              <AnimatePresence>
                {isPedro && showWhatsApp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2.5 pt-2.5"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <motion.button
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 18 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold"
                        style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366', border: '1px solid rgba(37,211,102,0.3)' }}
                      >
                        <MessageCircle className="w-3 h-3" />
                        Enviar Orçamento pelo WhatsApp
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
