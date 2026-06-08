'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, X, AlertTriangle, Info, AlertCircle,
  ChevronRight, RefreshCw, UserCheck, Stethoscope,
  CalendarPlus, CalendarX, CircleDollarSign, FileText,
  Send, Clock, Building,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DexAlert } from '@/app/api/dex/alerts/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const TIPO_ICON: Record<string, LucideIcon> = {
  checkin_paciente:    UserCheck,
  consulta_finalizada: Stethoscope,
  agendamento_criado:  CalendarPlus,
  agendamento_cancelado: CalendarX,
  pagamento_confirmado: CircleDollarSign,
  orcamento_enviado:   FileText,
  follow_up:           Clock,
  briefing:            Send,
  sistema:             Info,
  convite_clinica:     Building,
};

// ── Componente ────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  isExpanded: boolean;
}

export function NotificationBell({ isExpanded }: NotificationBellProps) {
  const router = useRouter();
  const [alerts, setAlerts]         = useState<DexAlert[]>([]);
  const [open, setOpen]             = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const panelRef                    = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const res  = await fetch('/api/dex/alerts');
      const data = (await res.json()) as { alerts: DexAlert[] };
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoaded(true);
      if (showSpin) setRefreshing(false);
    }
  }, []);

  // ── Polling (fallback) + Realtime ─────────────────────────────────────────

  useEffect(() => {
    void fetchAlerts();
    // Polling como fallback — reduzido de 90s para 5min
    const interval = setInterval(() => { void fetchAlerts(); }, 300_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notificacoes',
          // Sem filtro: qualquer INSERT dispara re-fetch.
          // A API /dex/alerts filtra corretamente por role/dentista via RLS.
          // Necessário para cobrir notificações por role (para_role='secretaria')
          // que não possuem para_dentista_id.
        },
        () => {
          void fetchAlerts();
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  // ── Click fora fecha painel ───────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Marcar como lida ──────────────────────────────────────────────────────

  const markRead = useCallback(async (alertId: string) => {
    if (!alertId.startsWith('notif_')) return;
    try {
      await fetch('/api/dex/alerts', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: alertId }),
      });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch { /* best-effort */ }
  }, []);

  const markAllNotifsRead = useCallback(() => {
    alerts.filter(a => a.isNotif).forEach(a => { void markRead(a.id); });
  }, [alerts, markRead]);

  const handleBellClick = useCallback(() => {
    const opening = !open;
    setOpen(opening);
    if (opening) markAllNotifsRead();
  }, [open, markAllNotifsRead]);

  const handleAlertClick = useCallback(async (alert: DexAlert) => {
    if (alert.isNotif) await markRead(alert.id);
    setOpen(false);
    if (alert.href) router.push(alert.href);
  }, [markRead, router]);

  // ── Agrupamento ───────────────────────────────────────────────────────────

  /** Agrupa alertas com mesmo tipoBD quando há 3+, retorna lista final */
  const groupedAlerts = useCallback((): (DexAlert & { count?: number })[] => {
    const grupos: Record<string, DexAlert[]> = {};
    const singles: DexAlert[] = [];

    for (const a of alerts) {
      if (a.isNotif && a.tipoBD) {
        if (!grupos[a.tipoBD]) grupos[a.tipoBD] = [];
        grupos[a.tipoBD].push(a);
      } else {
        singles.push(a);
      }
    }

    const resultado: (DexAlert & { count?: number })[] = [...singles];

    for (const [, grupo] of Object.entries(grupos)) {
      if (grupo.length >= 3) {
        // Representante: o mais recente
        resultado.push({ ...grupo[0], count: grupo.length });
      } else {
        resultado.push(...grupo);
      }
    }

    return resultado;
  }, [alerts]);

  // ── Contagens ─────────────────────────────────────────────────────────────

  const unreadNotifCount = alerts.filter(a => a.isNotif).length;
  const totalCount       = alerts.length;

  // ── Helpers visuais ───────────────────────────────────────────────────────

  const iconColor = (type: DexAlert['type']) =>
    type === 'danger'  ? 'var(--color-coral)'
    : type === 'warning' ? 'var(--color-warning)'
    : 'var(--color-teal)';

  const bgColor = (type: DexAlert['type']) =>
    type === 'danger'
      ? 'color-mix(in srgb, var(--color-coral) 8%, transparent)'
      : type === 'warning'
        ? 'color-mix(in srgb, var(--color-warning) 8%, transparent)'
        : 'color-mix(in srgb, var(--color-teal) 8%, transparent)';

  const borderColor = (type: DexAlert['type']) =>
    type === 'danger'
      ? 'color-mix(in srgb, var(--color-coral) 25%, transparent)'
      : type === 'warning'
        ? 'color-mix(in srgb, var(--color-warning) 25%, transparent)'
        : 'color-mix(in srgb, var(--color-teal) 25%, transparent)';

  const badgeBg = alerts.some(a => a.type === 'danger')
    ? 'var(--color-coral)'
    : alerts.some(a => a.type === 'warning')
      ? 'var(--color-warning)'
      : 'var(--color-teal)';

  const AlertIcon = ({ alert }: { alert: DexAlert }) => {
    // Ícone contextual por tipo quando for notificação do BD
    if (alert.isNotif && alert.tipoBD) {
      const Icon = TIPO_ICON[alert.tipoBD] ?? Info;
      return <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(alert.type) }} />;
    }
    // Ícone genérico por severidade para alertas computados
    if (alert.type === 'danger')  return <AlertCircle   className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(alert.type) }} />;
    if (alert.type === 'warning') return <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(alert.type) }} />;
    return <Info className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(alert.type) }} />;
  };

  const displayed = groupedAlerts();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={handleBellClick}
        title={!isExpanded ? 'Notificações' : undefined}
        className={`flex items-center gap-3 py-2 rounded-xl transition-all group w-full hover:bg-white/[0.05] ${
          !isExpanded ? 'justify-center px-1' : 'px-2'
        }`}
        aria-label="Notificações"
      >
        {/* Icon box com badge */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center group-hover:bg-white/[0.11] transition-colors">
            <Bell style={{ width: 20, height: 20 }} className="text-white/55 group-hover:text-white/85 transition-colors" />
          </div>

          {loaded && totalCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
              style={{ background: badgeBg, boxShadow: `0 0 6px ${badgeBg}66` }}
            >
              {totalCount}
            </motion.span>
          )}
        </div>

        {/* Label (apenas expandido) */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden flex-1 text-[15px] font-medium text-white/70 group-hover:text-white/92 transition-colors"
            >
              Notificações
            </motion.span>
          )}
        </AnimatePresence>

        {/* Badge inline + chevron (apenas expandido) */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 shrink-0"
            >
              {loaded && totalCount > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white min-w-[18px] text-center"
                  style={{ background: badgeBg }}
                >
                  {totalCount}
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-white/25 group-hover:text-white/50 transition-colors" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* ── Painel ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="absolute left-full ml-3 bottom-0 w-72 rounded-xl shadow-2xl overflow-hidden"
            style={{
              background: 'color-mix(in srgb, var(--color-brand-charcoal) 98%, transparent)',
              border:     '1px solid color-mix(in srgb, var(--color-teal) 20%, transparent)',
              boxShadow:  '0 20px 60px -10px rgba(0,0,0,0.8)',
              zIndex:     200,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" style={{ color: 'var(--color-teal)' }} />
                <span className="text-xs font-bold text-white">Notificações</span>
                {unreadNotifCount > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white"
                    style={{ background: 'var(--color-teal)' }}
                  >
                    {unreadNotifCount} novas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void fetchAlerts(true)}
                  className="p-1 rounded transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  title="Atualizar"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-0.5 rounded transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto">
              {!loaded ? (
                <div className="px-4 py-6 text-center">
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                    style={{ borderColor: 'var(--color-teal)', borderTopColor: 'transparent' }} />
                </div>
              ) : totalCount === 0 ? (
                /* Estado vazio melhorado */
                <div className="px-4 py-10 flex flex-col items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--color-teal) 10%, transparent)' }}
                  >
                    <Bell className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                  </div>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Tudo em dia
                  </p>
                  <p className="text-[11px] text-center max-w-[160px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Nenhum alerta ou pendência no momento
                  </p>
                </div>
              ) : (
                <div className="p-2 flex flex-col gap-1.5">
                  {displayed.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => void handleAlertClick(alert)}
                      className="w-full text-left rounded-lg px-3 py-3 transition-all hover:brightness-110 flex items-start gap-2.5 group"
                      style={{
                        background:   bgColor(alert.type),
                        border:       `1px solid ${borderColor(alert.type)}`,
                      }}
                    >
                      <AlertIcon alert={alert} />
                      <div className="flex-1 min-w-0">
                        {/* Título + timestamp + badge novo */}
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="text-xs font-semibold text-white leading-snug truncate">
                            {alert.title}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {'count' in alert && alert.count && alert.count > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white/60"
                                style={{ background: 'rgba(255,255,255,0.08)' }}>
                                {alert.count}×
                              </span>
                            )}
                            {alert.createdAt && (
                              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {tempoRelativo(alert.createdAt)}
                              </span>
                            )}
                            {alert.isNotif && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: 'var(--color-teal)' }} />
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] leading-relaxed mt-0.5 line-clamp-2"
                          style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {alert.description}
                        </p>
                      </div>
                      {alert.href && (
                        <ChevronRight
                          className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
                          style={{ color: iconColor(alert.type) }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: marcar todas como lidas */}
            {unreadNotifCount > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={markAllNotifsRead}
                  className="w-full text-[11px] py-2.5 px-4 text-left transition-colors hover:bg-white/[0.04]"
                  style={{ color: 'color-mix(in srgb, var(--color-teal) 70%, transparent)' }}
                >
                  Marcar todas como lidas
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
