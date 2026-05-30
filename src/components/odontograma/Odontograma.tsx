'use client';

import { useState, Fragment } from 'react';
import { cn } from '@/lib/utils';

// ─── FDI tooth layout ────────────────────────────────────────────────────────
export const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export const TOOTH_NAMES: Record<number, string> = {
  11: 'Incisivo Central', 21: 'Incisivo Central', 31: 'Incisivo Central', 41: 'Incisivo Central',
  12: 'Incisivo Lateral', 22: 'Incisivo Lateral', 32: 'Incisivo Lateral', 42: 'Incisivo Lateral',
  13: 'Canino',           23: 'Canino',           33: 'Canino',           43: 'Canino',
  14: '1º Pré-molar',    24: '1º Pré-molar',    34: '1º Pré-molar',    44: '1º Pré-molar',
  15: '2º Pré-molar',    25: '2º Pré-molar',    35: '2º Pré-molar',    45: '2º Pré-molar',
  16: '1º Molar',        26: '1º Molar',        36: '1º Molar',        46: '1º Molar',
  17: '2º Molar',        27: '2º Molar',        37: '2º Molar',        47: '2º Molar',
  18: 'Siso',            28: 'Siso',            38: 'Siso',            48: 'Siso',
};

export function getQuadrantLabel(tooth: number): string {
  if (tooth >= 11 && tooth <= 18) return 'Q1 · Sup. Direito';
  if (tooth >= 21 && tooth <= 28) return 'Q2 · Sup. Esquerdo';
  if (tooth >= 31 && tooth <= 38) return 'Q3 · Inf. Esquerdo';
  return 'Q4 · Inf. Direito';
}

// ─── Tooth class + dimensions ─────────────────────────────────────────────────
type ToothClass = 'central' | 'lateral' | 'canine' | 'premolar' | 'molar1' | 'molar2' | 'molar3';

interface Dim { w: number; crownH: number; rootH: number; rx: number; isMolar: boolean }

const TOOTH_CLASS: Record<number, ToothClass> = {
  11: 'central',  21: 'central',  31: 'central',  41: 'central',
  12: 'lateral',  22: 'lateral',  32: 'lateral',  42: 'lateral',
  13: 'canine',   23: 'canine',   33: 'canine',   43: 'canine',
  14: 'premolar', 24: 'premolar', 34: 'premolar', 44: 'premolar',
  15: 'premolar', 25: 'premolar', 35: 'premolar', 45: 'premolar',
  16: 'molar1',   26: 'molar1',   36: 'molar1',   46: 'molar1',
  17: 'molar2',   27: 'molar2',   37: 'molar2',   47: 'molar2',
  18: 'molar3',   28: 'molar3',   38: 'molar3',   48: 'molar3',
};

const DIMS: Record<ToothClass, Dim> = {
  central:  { w: 22, crownH: 30, rootH: 22, rx: 4,  isMolar: false },
  lateral:  { w: 18, crownH: 27, rootH: 20, rx: 4,  isMolar: false },
  canine:   { w: 20, crownH: 32, rootH: 26, rx: 3,  isMolar: false },
  premolar: { w: 23, crownH: 28, rootH: 21, rx: 3,  isMolar: false },
  molar1:   { w: 32, crownH: 28, rootH: 18, rx: 3,  isMolar: true  },
  molar2:   { w: 30, crownH: 26, rootH: 17, rx: 3,  isMolar: true  },
  molar3:   { w: 27, crownH: 24, rootH: 15, rx: 3,  isMolar: true  },
};

// ─── SVG path generators ─────────────────────────────────────────────────────

function upperCrown(w: number, h: number, rx: number): string {
  return `M ${rx} 0 L ${w - rx} 0 Q ${w} 0 ${w} ${rx} L ${w} ${h} L 0 ${h} L 0 ${rx} Q 0 0 ${rx} 0 Z`;
}

function lowerCrown(w: number, crownH: number, rootH: number, rx: number): string {
  const y1 = rootH + crownH;
  return `M 0 ${rootH} L ${w} ${rootH} L ${w} ${y1 - rx} Q ${w} ${y1} ${w - rx} ${y1} L ${rx} ${y1} Q 0 ${y1} 0 ${y1 - rx} Z`;
}

function upperRoot(w: number, crownH: number, rootH: number): string {
  const rw = w * 0.42;
  const lx = (w - rw) / 2;
  const rx = (w + rw) / 2;
  const totalH = crownH + rootH;
  const tx = w / 2;
  const f = (n: number) => n.toFixed(1);
  return (
    `M ${f(lx)} ${crownH} ` +
    `C ${f(lx + 1.5)} ${f(crownH + rootH * 0.42)} ${f(tx - 1.5)} ${f(totalH - 3)} ${f(tx)} ${totalH} ` +
    `C ${f(tx)} ${totalH} ${f(tx + 1.5)} ${f(totalH - 3)} ${f(rx - 1.5)} ${f(crownH + rootH * 0.42)} ` +
    `L ${f(rx)} ${crownH} Z`
  );
}

function lowerRoot(w: number, rootH: number): string {
  const rw = w * 0.42;
  const lx = (w - rw) / 2;
  const rx = (w + rw) / 2;
  const tx = w / 2;
  const f = (n: number) => n.toFixed(1);
  return (
    `M ${f(lx)} ${rootH} ` +
    `C ${f(lx + 1.5)} ${f(rootH * 0.58)} ${f(tx - 1.5)} 3 ${f(tx)} 0 ` +
    `C ${f(tx)} 0 ${f(tx + 1.5)} 3 ${f(rx - 1.5)} ${f(rootH * 0.58)} ` +
    `L ${f(rx)} ${rootH} Z`
  );
}

// ─── State type ───────────────────────────────────────────────────────────────
type ToothState = 'default' | 'historical' | 'shared' | 'selected';

// ─── Individual tooth SVG ─────────────────────────────────────────────────────
interface ToothSVGProps {
  num: number;
  isUpper: boolean;
  state: ToothState;
  hovered: boolean;
  showCheckbox: boolean;
}

function ToothSVG({ num, isUpper, state, hovered, showCheckbox }: ToothSVGProps) {
  const cls = TOOTH_CLASS[num] ?? 'premolar';
  const { w, crownH, rootH, rx, isMolar } = DIMS[cls];
  const totalH = crownH + rootH;

  const crownFill =
    state === 'selected'    ? 'var(--color-teal)'
    : state === 'shared'    ? 'color-mix(in srgb, var(--color-teal) 22%, var(--color-surface-alt))'
    : state === 'historical' ? 'var(--color-teal-pale)'
    : 'var(--color-surface-alt)';

  const crownStroke =
    hovered                  ? 'var(--color-teal-lt)'
    : state === 'selected'   ? 'var(--color-teal)'
    : state === 'shared'     ? 'var(--color-teal)'
    : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 38%, var(--color-border))'
    : 'var(--color-border)';

  const strokeW = (state === 'selected' || state === 'shared' || hovered) ? 1.5 : 1;

  const textFill = state === 'selected' ? 'rgba(255,255,255,0.92)' : 'var(--color-text-secondary)';
  const numY = isUpper ? crownH * 0.55 : rootH + crownH * 0.55;
  const grooveY = isUpper ? crownH * 0.38 : rootH + crownH * 0.62;

  // Checkbox (top corner of crown)
  const cbX = w - 8;
  const cbY = isUpper ? 3 : rootH + 3;
  const isChecked = state === 'selected' || state === 'shared';

  return (
    <svg
      width={w}
      height={totalH}
      viewBox={`0 0 ${w} ${totalH}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Root */}
      <path
        d={isUpper ? upperRoot(w, crownH, rootH) : lowerRoot(w, rootH)}
        style={{
          fill: 'var(--color-surface-alt)',
          opacity: state === 'selected' ? 0.4 : 0.65,
          transition: 'opacity 0.18s',
        }}
      />

      {/* Crown */}
      <path
        d={isUpper ? upperCrown(w, crownH, rx) : lowerCrown(w, crownH, rootH, rx)}
        style={{
          fill: crownFill,
          stroke: crownStroke,
          strokeWidth: strokeW,
          transition: 'fill 0.18s ease, stroke 0.18s ease, stroke-width 0.18s ease',
        }}
      />

      {/* Molar occlusal groove */}
      {isMolar && (
        <line
          x1={5} y1={grooveY} x2={w - 5} y2={grooveY}
          strokeLinecap="round"
          style={{
            stroke: state === 'selected' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.07)',
            strokeWidth: 0.8,
          }}
        />
      )}

      {/* Tooth number */}
      <text
        x={w / 2}
        y={numY}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: '7.5px',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: '600',
          fill: textFill,
          transition: 'fill 0.18s ease',
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '-0.3px',
        }}
      >
        {num}
      </text>

      {/* Checkbox indicator (multiple selection mode) */}
      {showCheckbox && (
        <g>
          <rect
            x={cbX} y={cbY} width={6} height={6} rx={1}
            style={{
              fill: isChecked ? 'var(--color-teal)' : 'transparent',
              stroke: isChecked ? 'var(--color-teal)' : 'var(--color-border)',
              strokeWidth: 1,
              transition: 'fill 0.15s, stroke 0.15s',
            }}
          />
          {isChecked && (
            <polyline
              points={`${cbX + 1.5} ${cbY + 3.2} ${cbX + 2.5} ${cbY + 4.5} ${cbX + 4.5} ${cbY + 1.5}`}
              style={{ stroke: 'white', strokeWidth: 1, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}
            />
          )}
        </g>
      )}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export interface OdontogramaProps {
  selectedTeeth: number[];
  sharedTeeth?: number[];
  historicalTeeth?: Set<number>;
  onToothToggle: (tooth: number) => void;
  showCheckbox?: boolean;
  className?: string;
}

export function Odontograma({
  selectedTeeth,
  sharedTeeth = [],
  historicalTeeth = new Set(),
  onToothToggle,
  showCheckbox = false,
  className,
}: OdontogramaProps) {
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null);

  function getState(tooth: number): ToothState {
    if (sharedTeeth.includes(tooth)) return 'shared';
    if (selectedTeeth.includes(tooth)) return 'selected';
    if (historicalTeeth.has(tooth)) return 'historical';
    return 'default';
  }

  function renderArch(teeth: number[], isUpper: boolean) {
    return teeth.map((num) => {
      const isMidlineStart = num === 21 || num === 31;
      const state = getState(num);
      const isHov = hoveredTooth === num;
      const isActive = state === 'selected' || state === 'shared';

      return (
        <Fragment key={num}>
          {isMidlineStart && (
            <div
              className="self-stretch w-px bg-border/50 mx-0.5 shrink-0"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={() => onToothToggle(num)}
            onMouseEnter={() => setHoveredTooth(num)}
            onMouseLeave={() => setHoveredTooth(null)}
            className={cn(
              'relative outline-none focus-visible:ring-1 focus-visible:ring-teal rounded-sm',
              isActive || isHov ? 'z-10' : 'z-0',
            )}
            style={{
              transform: isHov ? 'scale(1.11)' : isActive ? 'scale(1.055)' : 'scale(1)',
              transition: 'transform 0.14s ease',
            }}
            aria-label={`Dente ${num} — ${TOOTH_NAMES[num]}`}
            aria-pressed={isActive}
          >
            <ToothSVG
              num={num}
              isUpper={isUpper}
              state={state}
              hovered={isHov}
              showCheckbox={showCheckbox}
            />
          </button>
        </Fragment>
      );
    });
  }

  const hoveredState = hoveredTooth ? getState(hoveredTooth) : null;

  return (
    <div className={cn('flex flex-col gap-2.5 select-none', className)}>
      {/* Chart */}
      <div className="overflow-x-auto pb-0.5">
        <div className="flex flex-col items-center gap-0 min-w-max">

          {/* Quadrant labels — upper */}
          <div className="flex w-full justify-between mb-1 px-0.5">
            <span className="text-[7.5px] uppercase tracking-widest text-text-muted font-medium">
              Sup. Direito
            </span>
            <span className="text-[7.5px] uppercase tracking-widest text-text-muted font-medium">
              Sup. Esquerdo
            </span>
          </div>

          {/* Upper arch — crowns aligned at top */}
          <div className="flex items-start gap-[1px]">
            {renderArch(TEETH_UPPER, true)}
          </div>

          {/* Horizontal midline */}
          <div className="w-full h-px bg-border/70 my-[4px]" />

          {/* Lower arch — crowns aligned at bottom */}
          <div className="flex items-end gap-[1px]">
            {renderArch(TEETH_LOWER, false)}
          </div>

          {/* Quadrant labels — lower */}
          <div className="flex w-full justify-between mt-1 px-0.5">
            <span className="text-[7.5px] uppercase tracking-widest text-text-muted font-medium">
              Inf. Direito
            </span>
            <span className="text-[7.5px] uppercase tracking-widest text-text-muted font-medium">
              Inf. Esquerdo
            </span>
          </div>

        </div>
      </div>

      {/* Info bar */}
      <div className="h-5 flex items-center px-0.5">
        {hoveredTooth ? (
          <div className="flex items-center gap-1.5 text-[10px] leading-none">
            <span className="font-bold text-text-primary font-mono">{hoveredTooth}</span>
            <span className="text-text-muted">—</span>
            <span className="text-text-secondary">{TOOTH_NAMES[hoveredTooth]}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted text-[8.5px]">{getQuadrantLabel(hoveredTooth)}</span>
            {hoveredState === 'historical' && (
              <span className="text-teal text-[8.5px] font-semibold ml-0.5">· histórico</span>
            )}
            {(hoveredState === 'selected' || hoveredState === 'shared') && (
              <span className="text-teal text-[8.5px] font-semibold ml-0.5">· selecionado</span>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-text-muted italic leading-none">
            Passe o mouse ou clique num dente
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-0.5 flex-wrap">
        {[
          {
            fill: 'var(--color-surface-alt)',
            stroke: 'var(--color-border)',
            label: 'Sem registro',
          },
          {
            fill: 'var(--color-teal-pale)',
            stroke: 'color-mix(in srgb, var(--color-teal) 38%, var(--color-border))',
            label: 'Com histórico',
          },
          {
            fill: 'var(--color-teal)',
            stroke: 'var(--color-teal)',
            label: 'Selecionado',
          },
        ].map(({ fill, stroke, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <svg width={10} height={10} viewBox="0 0 10 10">
              <rect x={0.5} y={0.5} width={9} height={9} rx={2}
                style={{ fill, stroke, strokeWidth: 1 }}
              />
            </svg>
            <span className="text-[8.5px] text-text-secondary leading-none">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
