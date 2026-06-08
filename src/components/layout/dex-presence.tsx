'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, DollarSign, CalendarDays, TrendingUp, UserCheck } from 'lucide-react';
import Link from 'next/link';
import type { DexAlert } from '@/app/api/dex/alerts/route';
import type { DexContextData } from '@/app/api/dex/context/route';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DexMetric {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function getAlertColors(type: DexAlert['type']): {
  bg: string;
  border: string;
  iconColor: string;
} {
  switch (type) {
    case 'danger':
      return {
        bg: 'bg-red-500/5 dark:bg-red-500/10',
        border: 'border-red-500/20',
        iconColor: 'text-red-500',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/5 dark:bg-amber-500/10',
        border: 'border-amber-500/20',
        iconColor: 'text-amber-500',
      };
    case 'info':
    default:
      return {
        bg: 'bg-teal/5 dark:bg-teal/10',
        border: 'border-teal/20',
        iconColor: 'text-teal',
      };
  }
}

function AlertIcon({ type, className }: { type: DexAlert['type']; className?: string }) {
  switch (type) {
    case 'danger':
      return <AlertCircle className={className} />;
    case 'warning':
      return <AlertTriangle className={className} />;
    case 'info':
    default:
      return <Info className={className} />;
  }
}

// ── Loading dots ──────────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-12">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-teal"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: DexAlert }) {
  const colors = getAlertColors(alert.type);

  const inner = (
    <div
      className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 border transition-opacity ${colors.bg} ${colors.border} ${alert.href ? 'hover:opacity-80 cursor-pointer' : ''}`}
    >
      <AlertIcon
        type={alert.type}
        className={`w-4 h-4 mt-0.5 shrink-0 ${colors.iconColor}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary leading-snug">{alert.title}</p>
        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{alert.description}</p>
      </div>
    </div>
  );

  if (alert.href) {
    return <Link href={alert.href}>{inner}</Link>;
  }

  return inner;
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: DexMetric }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface border border-border px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-text-secondary">
        {metric.icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{metric.label}</span>
      </div>
      <p
        className={`text-xl font-bold font-mono leading-none ${metric.highlight ? 'text-red-500' : 'text-text-primary'}`}
      >
        {metric.value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DexPresencePanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<DexAlert[]>([]);
  const [ctx, setCtx] = useState<DexContextData | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // Mount guard for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for toggle event
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    window.addEventListener('dex-toggle', handler);
    return () => window.removeEventListener('dex-toggle', handler);
  }, []);

  // Lazy-load data when panel opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setFetchError(false);

    Promise.all([
      fetch('/api/dex/alerts').then((r) => r.json() as Promise<{ alerts: DexAlert[] }>),
      fetch('/api/dex/context').then((r) => r.json() as Promise<DexContextData>),
    ])
      .then(([alertsData, ctxData]) => {
        setAlerts(alertsData.alerts ?? []);
        setCtx(ctxData);
      })
      .catch(() => {
        setFetchError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  const handleClose = () => setOpen(false);

  // ── Derived metrics ────────────────────────────────────────────────────────

  const metrics: DexMetric[] = ctx
    ? [
        {
          label: 'Receita hoje',
          value: formatCurrency(ctx.receitaProjetadaHoje),
          icon: <DollarSign className="w-3.5 h-3.5" />,
        },
        {
          label: 'Consultas hoje',
          value: String(ctx.agendamentosHoje),
          icon: <CalendarDays className="w-3.5 h-3.5" />,
        },
        {
          label: 'Orçamentos semana',
          value: String(ctx.orcamentosAprovadosSemana),
          icon: <TrendingUp className="w-3.5 h-3.5" />,
        },
        {
          label: 'Follow-up pendente',
          value: String(ctx.followUpPendentes),
          icon: <UserCheck className="w-3.5 h-3.5" />,
          highlight: ctx.followUpPendentes > 0,
        },
      ]
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[380px] flex flex-col bg-background border-l border-border shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-teal font-bold" style={{ fontSize: '1rem', letterSpacing: '0.01em' }}>
                    ◆ Dex
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                  Copiloto
                </span>
              </div>

              <button
                onClick={handleClose}
                className="p-2 rounded-xl text-text-secondary hover:bg-surface transition-colors"
                aria-label="Fechar Dex"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {loading && <LoadingDots />}

              {!loading && fetchError && (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <AlertCircle className="w-8 h-8 text-text-secondary opacity-40" />
                  <p className="text-sm text-text-secondary opacity-60">
                    Não foi possível carregar os dados agora.
                  </p>
                </div>
              )}

              {!loading && !fetchError && (
                <>
                  {/* ── Seção Atenção ──────────────────────────────────────── */}
                  <section className="space-y-3">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-0.5">
                      Atenção
                    </h2>

                    {alerts.length > 0 ? (
                      <div className="space-y-2">
                        {alerts.map((alert) => (
                          <AlertCard key={alert.id} alert={alert} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-text-secondary py-1 px-0.5">
                        <CheckCircle className="w-3.5 h-3.5 text-teal shrink-0 opacity-70" />
                        <span className="text-xs opacity-60">
                          Nenhuma atenção necessária hoje
                        </span>
                      </div>
                    )}
                  </section>

                  {/* ── Seção Hoje ─────────────────────────────────────────── */}
                  {ctx && (
                    <section className="space-y-3">
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-0.5">
                        Hoje
                      </h2>

                      <div className="grid grid-cols-2 gap-2.5">
                        {metrics.map((metric) => (
                          <MetricCard key={metric.label} metric={metric} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-border shrink-0">
              <p
                className="text-[10px] font-mono text-text-secondary"
                style={{ opacity: 0.35 }}
              >
                ◆ Dex — {formatDate(new Date())}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
