'use client';

// Lista agrupada por dente/região (Odontograma v3 — Fatia A, confirmação remodelada).
// Substitui a lista plana: 1 card por dente, cada linha um evento com pílula de
// estado. Tocar o card abre o ToothDetailPanel do dente (a tela-mãe decide onde).

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  corDoRegistro,
  TIPO_LABEL,
  type OdontogramaEventoDraft,
} from '@/types/odontograma';
import { TOOTH_NAMES } from '@/components/odontograma/Odontograma';

const COR_TOKEN = {
  coral: 'var(--color-coral)',
  teal:  'var(--color-teal)',
  slate: 'var(--color-slate)',
} as const;

const ROTULO_ESTADO = { coral: 'A fazer', teal: 'Feito', slate: 'Pré-exist.' } as const;

export interface ToothGroupListProps {
  eventos: OdontogramaEventoDraft[];
  onDenteClick?: (dente: number) => void;
  className?: string;
}

export function ToothGroupList({ eventos, onDenteClick, className }: ToothGroupListProps) {
  const grupos = useMemo(() => {
    const porDente = new Map<number, OdontogramaEventoDraft[]>();
    const semDente: OdontogramaEventoDraft[] = [];
    for (const ev of eventos) {
      if (ev.ancora.dente != null) {
        const list = porDente.get(ev.ancora.dente) ?? [];
        list.push(ev);
        porDente.set(ev.ancora.dente, list);
      } else {
        semDente.push(ev); // âncora de arcada/quadrante
      }
    }
    return {
      dentes: Array.from(porDente.entries()).sort(([a], [b]) => a - b),
      semDente,
    };
  }, [eventos]);

  if (eventos.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {grupos.dentes.map(([dente, evs]) => (
        <button
          key={dente}
          type="button"
          onClick={() => onDenteClick?.(dente)}
          className="text-left rounded-xl border px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal hover:border-teal"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          aria-label={`Editar registros do dente ${dente}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-[13.5px]" style={{ color: 'var(--color-text-primary)' }}>
              {dente}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              {TOOTH_NAMES[dente] ?? ''}
            </span>
            <div className="flex-1" />
            <span className="flex gap-1">
              {evs.map((ev, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: COR_TOKEN[corDoRegistro(ev.status, ev.origem)] }}
                  aria-hidden="true"
                />
              ))}
            </span>
          </div>
          <div className="flex flex-col">
            {evs.map((ev, i) => {
              const cor = corDoRegistro(ev.status, ev.origem);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1 text-[12px]"
                  style={i > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}
                >
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {TIPO_LABEL[ev.tipo]}
                  </span>
                  {(ev.ancora.faces ?? []).length > 0 && (
                    <span className="font-mono text-[10.5px]" style={{ color: 'var(--color-text-muted)' }}>
                      · {(ev.ancora.faces ?? []).join(' ')}
                    </span>
                  )}
                  {ev.observacao && (
                    <span className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {ev.observacao}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${COR_TOKEN[cor]} 15%, var(--color-surface-alt))`,
                      color: COR_TOKEN[cor],
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: COR_TOKEN[cor] }} aria-hidden="true" />
                    {ROTULO_ESTADO[cor]}
                  </span>
                </div>
              );
            })}
          </div>
        </button>
      ))}

      {grupos.semDente.length > 0 && (
        <div
          className="rounded-xl border px-3.5 py-2.5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Arcada / região
          </div>
          {grupos.semDente.map((ev, i) => {
            const cor = corDoRegistro(ev.status, ev.origem);
            return (
              <div key={i} className="flex items-center gap-2 py-1 text-[12px]">
                <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {TIPO_LABEL[ev.tipo]}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {ev.ancora.nivel === 'arcada' ? `arcada ${ev.ancora.arcada}` : `quadrante ${ev.ancora.quadrante}`}
                </span>
                <div className="flex-1" />
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${COR_TOKEN[cor]} 15%, var(--color-surface-alt))`,
                    color: COR_TOKEN[cor],
                  }}
                >
                  {ROTULO_ESTADO[cor]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
