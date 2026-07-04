'use client';

import { ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA } from '@/lib/arcadas';

const ARCH_OPTIONS: { id: number; label: string }[] = [
  { id: ARCH_SUPERIOR, label: 'Arcada Sup.' },
  { id: ARCH_INFERIOR, label: 'Arcada Inf.' },
  { id: ARCH_COMPLETA, label: 'Boca Toda' },
];

interface ArchChipsProps {
  /** Sentinelas de arcada confirmados (97/98/99). */
  selected: number[];
  /** Sentinelas detectados pela IA, pendentes de confirmação. */
  detected: number[];
  onToggle: (sentinel: number) => void;
}

/**
 * Chips de arcada / boca inteira — procedimentos sem dente FDI individual
 * (sentinelas 97/98/99). Espelha os estados do odontograma: teal = confirmado,
 * amber = detectado pela IA aguardando confirmação.
 */
export function ArchChips({ selected, detected, onToggle }: ArchChipsProps) {
  return (
    <div className="flex gap-1.5 pt-3">
      {ARCH_OPTIONS.map(({ id, label }) => {
        const isSelected = selected.includes(id);
        const isDetected = !isSelected && detected.includes(id);
        const cls = isSelected
          ? 'bg-teal border-teal text-white shadow-[0_2px_6px_rgba(47,156,133,0.35)]'
          : isDetected
            ? 'bg-amber-500/10 border-amber-500 border-2 text-amber-600 dark:text-amber-400'
            : 'bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5';
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            title={isDetected ? `${label} — detectada pela IA (clique para confirmar)` : label}
            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all active:scale-95 ${cls}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
