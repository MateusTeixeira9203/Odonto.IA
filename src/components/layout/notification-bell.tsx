'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, AlertTriangle, Info, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import type { DexAlert } from '@/app/api/dex/alerts/route';

interface NotificationBellProps {
  isExpanded: boolean;
}

export function NotificationBell({ isExpanded }: NotificationBellProps) {
  const router = useRouter();
  const [alerts, setAlerts]   = useState<DexAlert[]>([]);
  const [open, setOpen]       = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const panelRef              = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const res = await fetch('/api/dex/alerts');
      const data = (await res.json()) as { alerts: DexAlert[] };
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoaded(true);
      if (showSpin) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
    const interval = setInterval(() => { void fetchAlerts(); }, 90_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (alertId: string) => {
    if (!alertId.startsWith('notif_')) return;
    try {
      await fetch('/api/dex/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId }),
      });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch { /* best-effort */ }
  }, []);

  const handleAlertClick = useCallback(async (alert: DexAlert) => {
    if (alert.isNotif) await markRead(alert.id);
    setOpen(false);
    if (alert.href) router.push(alert.href);
  }, [markRead, router]);

  const unreadNotifCount = alerts.filter(a => a.isNotif).length;
  const totalCount = alerts.length;

  const iconColor = (type: DexAlert['type']) =>
    type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#2f9c85';

  const bgColor = (type: DexAlert['type']) =>
    type === 'danger' ? 'rgba(239,68,68,0.08)' : type === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(47,156,133,0.08)';

  const borderColor = (type: DexAlert['type']) =>
    type === 'danger' ? 'rgba(239,68,68,0.25)' : type === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(47,156,133,0.25)';

  const AlertIcon = ({ type }: { type: DexAlert['type'] }) =>
    type === 'danger'
      ? <AlertCircle  className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(type) }} />
      : type === 'warning'
        ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(type) }} />
        : <Info className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor(type) }} />;

  const badgeBg = alerts.some(a => a.type === 'danger')
    ? '#ef4444' : alerts.some(a => a.type === 'warning') ? '#f59e0b' : '#2f9c85';

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group w-full text-zinc-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent ${!isExpanded && 'justify-center'}`}
        aria-label="Notificações"
      >
        <Bell className="w-4 h-4 shrink-0 text-zinc-400 group-hover:text-white" />

        {loaded && totalCount > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute top-1.5 left-5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
            style={{ background: badgeBg, boxShadow: `0 0 6px ${badgeBg}66` }}
          >
            {totalCount}
          </motion.span>
        )}

        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden flex items-center gap-1.5 flex-1"
            >
              Notificações
              {loaded && totalCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: badgeBg }}>
                  {totalCount}
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="absolute left-full ml-3 bottom-0 w-72 rounded-xl shadow-2xl overflow-hidden"
            style={{
              background: 'rgba(9,9,11,0.98)',
              border: '1px solid rgba(47,156,133,0.2)',
              boxShadow: '0 20px 60px -10px rgba(0,0,0,0.8)',
              zIndex: 200,
            }}
          >
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" style={{ color: '#2f9c85' }} />
                <span className="text-xs font-bold text-white">Notificações</span>
                {unreadNotifCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white"
                    style={{ background: '#2f9c85' }}>
                    {unreadNotifCount} novas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => void fetchAlerts(true)}
                  className="p-1 rounded transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  title="Atualizar">
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setOpen(false)}
                  className="p-0.5 rounded transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {!loaded ? (
                <div className="px-4 py-6 text-center">
                  <div className="w-4 h-4 rounded-full border-2 border-teal border-t-transparent animate-spin mx-auto" />
                </div>
              ) : totalCount === 0 ? (
                <div className="px-4 py-8 text-center flex flex-col items-center gap-2">
                  <Bell className="w-6 h-6 opacity-20" style={{ color: '#2f9c85' }} />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum alerta no momento</p>
                </div>
              ) : (
                <div className="p-2 flex flex-col gap-1.5">
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => void handleAlertClick(alert)}
                      className="w-full text-left rounded-lg px-3 py-3 transition-all hover:brightness-110 flex items-start gap-2.5 group"
                      style={{ background: bgColor(alert.type), border: `1px solid ${borderColor(alert.type)}` }}
                    >
                      <AlertIcon type={alert.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-white leading-snug">{alert.title}</p>
                          {alert.isNotif && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#2f9c85' }} />
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {alert.description}
                        </p>
                      </div>
                      {alert.href && (
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
                          style={{ color: iconColor(alert.type) }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
