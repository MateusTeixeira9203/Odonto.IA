export const STATUS_ORCAMENTO: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-surface-alt text-text-secondary' },
  enviado: { label: 'Enviado', cls: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  aprovado: { label: 'Aprovado', cls: 'bg-teal/10 text-teal' },
  recusado: { label: 'Recusado', cls: 'bg-red-500/10 text-red-500' },
};
