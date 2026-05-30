export const PROC_STATUS = {
  pendente: {
    label: 'Planejado',
    className: 'bg-surface-alt text-text-secondary border-border/60',
    dotClassName: 'bg-text-secondary/40',
    ringClassName: '',
  },
  agendado: {
    label: 'Agendado',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/25',
    dotClassName: 'bg-blue-500',
    ringClassName: 'ring-1 ring-blue-500/30',
  },
  concluido: {
    label: 'Concluído',
    className: 'bg-teal/10 text-teal border-teal/25',
    dotClassName: 'bg-teal',
    ringClassName: 'ring-1 ring-teal/30',
  },
} as const;

export type ProcStatusKey = keyof typeof PROC_STATUS;

export function getProcStatus(key: string) {
  return PROC_STATUS[key as ProcStatusKey] ?? PROC_STATUS.pendente;
}

export const SECTION_STATUS = {
  pendente: { label: 'Pendente', className: 'bg-surface-alt text-text-secondary border-border/60' },
  em_andamento: { label: 'Em Andamento', className: 'bg-teal/5 text-teal-lt border-teal/10' },
  concluido: { label: 'Concluído', className: 'bg-teal/10 text-teal border-teal/20' },
} as const;

export type SectionStatusKey = keyof typeof SECTION_STATUS;

export function getSectionStatus(key: string) {
  return SECTION_STATUS[key as SectionStatusKey] ?? SECTION_STATUS.pendente;
}
