'use client';

import { STATUS_CONFIG } from './status-config';
import type { AgendamentoStatus } from '@/types/database';

interface StatusBadgeProps {
  status: AgendamentoStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
    >
      {cfg.dotPulse ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
        </span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      )}
      {cfg.label}
    </span>
  );
}
