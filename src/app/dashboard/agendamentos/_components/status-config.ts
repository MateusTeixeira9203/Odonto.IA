import type { AgendamentoStatus } from '@/types/database';

export interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  dotPulse: boolean;
  label: string;
  // CSS values for inline style={} use in timeline (day/week) views
  timeline: { bg: string; border: string; text: string };
}

export const STATUS_CONFIG: Record<AgendamentoStatus, StatusConfig> = {
  scheduled: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    dot: 'bg-amber-400',
    dotPulse: false,
    label: 'Agendado',
    timeline: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', text: '#d97706' },
  },
  confirmed: {
    bg: 'bg-teal-pale',
    text: 'text-teal',
    border: 'border-teal/20',
    dot: 'bg-teal',
    dotPulse: false,
    label: 'Confirmado',
    timeline: { bg: 'var(--color-teal-pale)', border: 'rgba(47,156,133,0.25)', text: 'var(--color-teal)' },
  },
  checked_in: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/40',
    dot: 'bg-blue-500',
    dotPulse: false,
    label: 'Na Recepção',
    timeline: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.28)', text: '#3b82f6' },
  },
  in_progress: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/40',
    dot: 'bg-purple-500',
    dotPulse: true,
    label: 'Em Atendimento',
    timeline: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.32)', text: '#a855f7' },
  },
  completed: {
    bg: 'bg-surface-alt',
    text: 'text-text-secondary',
    border: 'border-border',
    dot: 'bg-border',
    dotPulse: false,
    label: 'Realizado',
    timeline: { bg: 'var(--color-surface-alt)', border: 'var(--color-border)', text: 'var(--color-text-secondary)' },
  },
  cancelled: {
    bg: 'bg-surface-alt',
    text: 'text-text-secondary',
    border: 'border-border',
    dot: 'bg-border',
    dotPulse: false,
    label: 'Cancelado',
    timeline: { bg: 'var(--color-surface-alt)', border: 'var(--color-border)', text: 'var(--color-text-secondary)' },
  },
  no_show: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800/40',
    dot: 'bg-red-500',
    dotPulse: false,
    label: 'Faltou',
    timeline: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.28)', text: '#ef4444' },
  },
};
