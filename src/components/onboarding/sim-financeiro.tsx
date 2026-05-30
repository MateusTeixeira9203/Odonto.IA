'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

function useCounter(target: number, active: boolean, duration = 950): number {
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
  return `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const TRANSACTIONS = [
  { nome: 'Ana Souza',    desc: 'Restauração + Limpeza',  valor:  550,  tipo: 'entrada' as const },
  { nome: 'Carlos Lima',  desc: 'Implante Dente 36',      valor:  3200, tipo: 'entrada' as const },
  { nome: 'Aluguel',      desc: 'Despesa fixa mensal',    valor: -1800, tipo: 'saida'   as const },
];

interface SimFinanceiroProps { onComplete?: () => void }

export function SimFinanceiro({ onComplete }: SimFinanceiroProps) {
  const [showReceita,  setShowReceita]  = useState(false);
  const [showDespesas, setShowDespesas] = useState(false);
  const [showLucro,    setShowLucro]    = useState(false);
  const [visibleTx,    setVisibleTx]    = useState(0);
  const [showChart,    setShowChart]    = useState(false);

  const receita  = useCounter(8400, showReceita);
  const despesas = useCounter(3200, showDespesas);
  const lucro    = useCounter(5200, showLucro);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowReceita(true),  400),
      setTimeout(() => setShowDespesas(true), 1300),
      setTimeout(() => setShowLucro(true),    2200),
      setTimeout(() => setShowChart(true),    3000),
      setTimeout(() => setVisibleTx(1),       3600),
      setTimeout(() => setVisibleTx(2),       4500),
      setTimeout(() => setVisibleTx(3),       5300),
      setTimeout(() => { onComplete?.(); },   8200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const BAR_DATA = [62, 78, 55, 90, 71, 88];
  const BAR_LABELS = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'];

  return (
    <motion.div
      className="w-full max-w-[480px] mx-auto px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 180 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(47,156,133,0.2)' }}>
          <Wallet className="w-4 h-4 text-[#2f9c85]" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">Financeiro</p>
          <p className="text-white/40 text-[10px]">Maio 2025 · atualizado agora</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
          style={{ background: 'rgba(47,156,133,0.15)', color: '#2f9c85', border: '1px solid rgba(47,156,133,0.25)' }}>
          <TrendingUp className="w-2.5 h-2.5" />
          +12% vs abril
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Receita',  value: receita,  active: showReceita,  color: '#2f9c85', trend: 'up',   highlight: false },
          { label: 'Despesas', value: despesas, active: showDespesas, color: '#f87171', trend: 'down', highlight: false },
          { label: 'Lucro',    value: lucro,    active: showLucro,    color: '#34d399', trend: 'up',   highlight: true  },
        ].map(({ label, value, active, color, trend, highlight }) => (
          <AnimatePresence key={label}>
            {active && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.88 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                transition={{ type: 'spring', damping: 20, stiffness: 240 }}
                className="rounded-2xl p-3"
                style={{
                  background: highlight ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${highlight ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {label}
                </p>
                <p className="font-mono font-bold text-sm leading-none" style={{ color }}>
                  R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-0.5 mt-1.5">
                  {trend === 'up'
                    ? <ArrowUpRight className="w-2.5 h-2.5" style={{ color }} />
                    : <ArrowDownRight className="w-2.5 h-2.5" style={{ color }} />
                  }
                  <span className="text-[8px] font-semibold" style={{ color: color + '99' }}>
                    {trend === 'up' ? '+12%' : '+8%'} vs mês ant.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      {/* Mini bar chart */}
      <AnimatePresence>
        {showChart && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-3 mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Lucro líquido — últimos 6 meses
            </p>
            <div className="flex items-end gap-1.5 h-10">
              {BAR_DATA.map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ background: i === BAR_DATA.length - 1 ? '#2f9c85' : 'rgba(47,156,133,0.3)' }}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.08, type: 'spring', damping: 18, stiffness: 200 }}
                />
              ))}
            </div>
            <div className="flex gap-1.5 mt-1">
              {BAR_LABELS.map((l, i) => (
                <p key={i} className="flex-1 text-center text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{l}</p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent transactions */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Lançamentos Recentes
          </p>
        </div>
        <AnimatePresence>
          {TRANSACTIONS.slice(0, visibleTx).map((tx, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 240 }}
              className="flex items-center justify-between px-3 py-2.5"
              style={{ borderBottom: i < visibleTx - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
            >
              <div>
                <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{tx.nome}</p>
                <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{tx.desc}</p>
              </div>
              <span className="font-mono text-sm font-bold"
                style={{ color: tx.tipo === 'entrada' ? '#34d399' : '#f87171' }}>
                {tx.tipo === 'entrada' ? '+' : '-'}{fmt(tx.valor)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
