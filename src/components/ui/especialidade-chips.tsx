'use client';

import { ESPECIALIDADES, type Especialidade } from '@/lib/especialidades';

export interface EspecialidadeChipsProps {
  selected: Especialidade[];
  onChange: (next: Especialidade[]) => void;
  disabled?: boolean;
}

/** Grade de chips toggle pra multi-especialidade — mesmo padrão visual do ArchChips/quadrante. */
export function EspecialidadeChips({ selected, onChange, disabled = false }: EspecialidadeChipsProps) {
  const toggle = (esp: Especialidade) => {
    onChange(
      selected.includes(esp) ? selected.filter((e) => e !== esp) : [...selected, esp]
    );
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {ESPECIALIDADES.map((esp) => {
        const isSelected = selected.includes(esp);
        return (
          <button
            key={esp}
            type="button"
            disabled={disabled}
            onClick={() => toggle(esp)}
            aria-pressed={isSelected}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-teal border-teal text-white shadow-[0_2px_6px_rgba(47,156,133,0.35)]'
                : 'bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5'
            }`}
          >
            {esp}
          </button>
        );
      })}
    </div>
  );
}
