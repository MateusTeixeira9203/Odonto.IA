'use client';

import { useState, Fragment } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── FDI tooth layout ────────────────────────────────────────────────────────
export const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const TEETH_UPPER_DEC = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const TEETH_LOWER_DEC = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export const TOOTH_NAMES: Record<number, string> = {
  11: 'Incisivo Central', 21: 'Incisivo Central', 31: 'Incisivo Central', 41: 'Incisivo Central',
  12: 'Incisivo Lateral', 22: 'Incisivo Lateral', 32: 'Incisivo Lateral', 42: 'Incisivo Lateral',
  13: 'Canino',           23: 'Canino',           33: 'Canino',           43: 'Canino',
  14: '1º Pré-molar',    24: '1º Pré-molar',    34: '1º Pré-molar',    44: '1º Pré-molar',
  15: '2º Pré-molar',    25: '2º Pré-molar',    35: '2º Pré-molar',    45: '2º Pré-molar',
  16: '1º Molar',        26: '1º Molar',        36: '1º Molar',        46: '1º Molar',
  17: '2º Molar',        27: '2º Molar',        37: '2º Molar',        47: '2º Molar',
  18: 'Siso',            28: 'Siso',            38: 'Siso',            48: 'Siso',
  51: 'Inc. Central',    61: 'Inc. Central',    71: 'Inc. Central',    81: 'Inc. Central',
  52: 'Inc. Lateral',    62: 'Inc. Lateral',    72: 'Inc. Lateral',    82: 'Inc. Lateral',
  53: 'Canino',          63: 'Canino',          73: 'Canino',          83: 'Canino',
  54: '1º Molar',        64: '1º Molar',        74: '1º Molar',        84: '1º Molar',
  55: '2º Molar',        65: '2º Molar',        75: '2º Molar',        85: '2º Molar',
};

export function getQuadrantLabel(tooth: number): string {
  if (tooth >= 11 && tooth <= 18) return 'Q1 · Sup. Direito';
  if (tooth >= 21 && tooth <= 28) return 'Q2 · Sup. Esquerdo';
  if (tooth >= 31 && tooth <= 38) return 'Q3 · Inf. Esquerdo';
  if (tooth >= 41 && tooth <= 48) return 'Q4 · Inf. Direito';
  if (tooth >= 51 && tooth <= 55) return 'Dec. · Sup. Direito';
  if (tooth >= 61 && tooth <= 65) return 'Dec. · Sup. Esquerdo';
  if (tooth >= 71 && tooth <= 75) return 'Dec. · Inf. Esquerdo';
  return 'Dec. · Inf. Direito';
}

// ─── Tooth class ──────────────────────────────────────────────────────────────
type ToothClass =
  | 'central' | 'lateral' | 'canine' | 'premolar'
  | 'molar1' | 'molar2' | 'molar3'
  | 'dec_incisor' | 'dec_canine' | 'dec_molar';

interface Dim { w: number; crownH: number; rootH: number; isMolar: boolean }

const TOOTH_CLASS: Record<number, ToothClass> = {
  11: 'central',  21: 'central',  31: 'central',  41: 'central',
  12: 'lateral',  22: 'lateral',  32: 'lateral',  42: 'lateral',
  13: 'canine',   23: 'canine',   33: 'canine',   43: 'canine',
  14: 'premolar', 24: 'premolar', 34: 'premolar', 44: 'premolar',
  15: 'premolar', 25: 'premolar', 35: 'premolar', 45: 'premolar',
  16: 'molar1',   26: 'molar1',   36: 'molar1',   46: 'molar1',
  17: 'molar2',   27: 'molar2',   37: 'molar2',   47: 'molar2',
  18: 'molar3',   28: 'molar3',   38: 'molar3',   48: 'molar3',
  51: 'dec_incisor', 52: 'dec_incisor', 61: 'dec_incisor', 62: 'dec_incisor',
  71: 'dec_incisor', 72: 'dec_incisor', 81: 'dec_incisor', 82: 'dec_incisor',
  53: 'dec_canine',  63: 'dec_canine',  73: 'dec_canine',  83: 'dec_canine',
  54: 'dec_molar',   55: 'dec_molar',   64: 'dec_molar',   65: 'dec_molar',
  74: 'dec_molar',   75: 'dec_molar',   84: 'dec_molar',   85: 'dec_molar',
};

// ─── Dimensions (1.6× scaled) ─────────────────────────────────────────────────
const DIMS: Record<ToothClass, Dim> = {
  central:     { w: 35, crownH: 48, rootH: 35, isMolar: false },
  lateral:     { w: 29, crownH: 43, rootH: 32, isMolar: false },
  canine:      { w: 32, crownH: 51, rootH: 42, isMolar: false },
  premolar:    { w: 37, crownH: 45, rootH: 34, isMolar: false },
  molar1:      { w: 51, crownH: 45, rootH: 29, isMolar: true  },
  molar2:      { w: 48, crownH: 42, rootH: 27, isMolar: true  },
  molar3:      { w: 43, crownH: 38, rootH: 24, isMolar: true  },
  dec_incisor: { w: 24, crownH: 32, rootH: 24, isMolar: false },
  dec_canine:  { w: 26, crownH: 35, rootH: 27, isMolar: false },
  dec_molar:   { w: 35, crownH: 34, rootH: 22, isMolar: true  },
};

// ─── Tooth family ─────────────────────────────────────────────────────────────
type ToothFamily = 'anterior' | 'canine' | 'premolar' | 'molar';

const TOOTH_FAMILY: Record<ToothClass, ToothFamily> = {
  central:     'anterior',
  lateral:     'anterior',
  canine:      'canine',
  premolar:    'premolar',
  molar1:      'molar',
  molar2:      'molar',
  molar3:      'molar',
  dec_incisor: 'anterior',
  dec_canine:  'canine',
  dec_molar:   'molar',
};

// ─── SVG path generators (anatomical) ────────────────────────────────────────
const CERVICAL = 0.78;
const q = (n: number) => n.toFixed(1);

// Upper crown: incisal/occlusal at top (y=0), cervical at bottom (y=h)
function upperCrownPath(w: number, h: number, family: ToothFamily): string {
  const neck = w * CERVICAL;
  const nL   = (w - neck) / 2;
  const nR   = nL + neck;
  const bul  = w * 0.045;

  if (family === 'canine') {
    const cx = w / 2;
    return (
      `M ${q(nL)} ${h} ` +
      `C ${q(nL - bul)} ${q(h * 0.58)} ${q(nL * 0.12)} ${q(h * 0.28)} ${q(cx)} 0 ` +
      `C ${q(w - nL * 0.12)} ${q(h * 0.28)} ${q(nR + bul)} ${q(h * 0.58)} ${q(nR)} ${h} Z`
    );
  }

  if (family === 'molar') {
    const cH  = h * 0.16;
    const tip = cH * 0.42;
    const val = cH;
    const lx  = w * 0.25;
    const rx2 = w * 0.75;
    const tw  = w * 0.055;
    return (
      `M ${q(nL)} ${h} ` +
      `C ${q(nL - bul)} ${q(h * 0.62)} ${q(nL * 0.1)} ${q(h * 0.35)} ${q(w * 0.07)} ${q(val)} ` +
      `C ${q(w * 0.07)} ${q(val - cH * 0.42)} ${q(lx - tw)} ${q(tip)} ${q(lx)} ${q(tip)} ` +
      `C ${q(lx + tw)} ${q(tip)} ${q(w / 2)} ${q(val - cH * 0.42)} ${q(w / 2)} ${q(val)} ` +
      `C ${q(w / 2)} ${q(val - cH * 0.42)} ${q(rx2 - tw)} ${q(tip)} ${q(rx2)} ${q(tip)} ` +
      `C ${q(rx2 + tw)} ${q(tip)} ${q(w * 0.93)} ${q(val - cH * 0.42)} ${q(w * 0.93)} ${q(val)} ` +
      `C ${q(w - nL * 0.1)} ${q(h * 0.35)} ${q(nR + bul)} ${q(h * 0.62)} ${q(nR)} ${h} Z`
    );
  }

  if (family === 'premolar') {
    const cH  = h * 0.10;
    const tip = cH * 0.38;
    const val = cH;
    const cx  = w / 2;
    const tw  = w * 0.06;
    return (
      `M ${q(nL)} ${h} ` +
      `C ${q(nL - bul)} ${q(h * 0.60)} 0 ${q(h * 0.30)} ${q(w * 0.07)} ${q(val)} ` +
      `C ${q(w * 0.07)} ${q(val - cH * 0.5)} ${q(cx - tw)} ${q(tip)} ${q(cx)} ${q(tip)} ` +
      `C ${q(cx + tw)} ${q(tip)} ${q(w * 0.93)} ${q(val - cH * 0.5)} ${q(w * 0.93)} ${q(val)} ` +
      `C ${q(w)} ${q(h * 0.30)} ${q(nR + bul)} ${q(h * 0.60)} ${q(nR)} ${h} Z`
    );
  }

  // anterior: straight incisal, convex sides
  const ir = w * 0.06;
  return (
    `M ${q(nL)} ${h} ` +
    `C ${q(nL - bul)} ${q(h * 0.60)} 0 ${q(h * 0.28)} ${q(ir)} ${q(ir)} ` +
    `L ${q(w - ir)} ${q(ir)} ` +
    `C ${q(w)} ${q(h * 0.28)} ${q(nR + bul)} ${q(h * 0.60)} ${q(nR)} ${h} Z`
  );
}

// Lower crown: incisal/occlusal at bottom (y = rootH + crownH), cervical at top (y = rootH)
function lowerCrownPath(w: number, crownH: number, rootH: number, family: ToothFamily): string {
  const neck = w * CERVICAL;
  const nL   = (w - neck) / 2;
  const nR   = nL + neck;
  const y0   = rootH;
  const y1   = rootH + crownH;
  const bul  = w * 0.045;

  if (family === 'canine') {
    const cx = w / 2;
    return (
      `M ${q(nL)} ${y0} ` +
      `C ${q(nL - bul)} ${q(y0 + crownH * 0.42)} ${q(nL * 0.12)} ${q(y0 + crownH * 0.72)} ${q(cx)} ${y1} ` +
      `C ${q(w - nL * 0.12)} ${q(y0 + crownH * 0.72)} ${q(nR + bul)} ${q(y0 + crownH * 0.42)} ${q(nR)} ${y0} Z`
    );
  }

  if (family === 'molar') {
    const cH  = crownH * 0.16;
    const tip = y1 - cH * 0.42;
    const val = y1 - cH;
    const lx  = w * 0.25;
    const rx2 = w * 0.75;
    const tw  = w * 0.055;
    return (
      `M ${q(nL)} ${y0} ` +
      `C ${q(nL - bul)} ${q(y0 + crownH * 0.38)} ${q(nL * 0.1)} ${q(y0 + crownH * 0.65)} ${q(w * 0.07)} ${q(val)} ` +
      `C ${q(w * 0.07)} ${q(val + cH * 0.42)} ${q(lx - tw)} ${q(tip)} ${q(lx)} ${q(tip)} ` +
      `C ${q(lx + tw)} ${q(tip)} ${q(w / 2)} ${q(val + cH * 0.42)} ${q(w / 2)} ${q(val)} ` +
      `C ${q(w / 2)} ${q(val + cH * 0.42)} ${q(rx2 - tw)} ${q(tip)} ${q(rx2)} ${q(tip)} ` +
      `C ${q(rx2 + tw)} ${q(tip)} ${q(w * 0.93)} ${q(val + cH * 0.42)} ${q(w * 0.93)} ${q(val)} ` +
      `C ${q(w - nL * 0.1)} ${q(y0 + crownH * 0.65)} ${q(nR + bul)} ${q(y0 + crownH * 0.38)} ${q(nR)} ${y0} Z`
    );
  }

  if (family === 'premolar') {
    const cH  = crownH * 0.10;
    const tip = y1 - cH * 0.38;
    const val = y1 - cH;
    const cx  = w / 2;
    const tw  = w * 0.06;
    return (
      `M ${q(nL)} ${y0} ` +
      `C ${q(nL - bul)} ${q(y0 + crownH * 0.40)} 0 ${q(y0 + crownH * 0.70)} ${q(w * 0.07)} ${q(val)} ` +
      `C ${q(w * 0.07)} ${q(val + cH * 0.5)} ${q(cx - tw)} ${q(tip)} ${q(cx)} ${q(tip)} ` +
      `C ${q(cx + tw)} ${q(tip)} ${q(w * 0.93)} ${q(val + cH * 0.5)} ${q(w * 0.93)} ${q(val)} ` +
      `C ${q(w)} ${q(y0 + crownH * 0.70)} ${q(nR + bul)} ${q(y0 + crownH * 0.40)} ${q(nR)} ${y0} Z`
    );
  }

  // anterior
  const ir = w * 0.06;
  return (
    `M ${q(nL)} ${y0} ` +
    `C ${q(nL - bul)} ${q(y0 + crownH * 0.40)} 0 ${q(y0 + crownH * 0.72)} ${q(ir)} ${q(y1 - ir)} ` +
    `L ${q(w - ir)} ${q(y1 - ir)} ` +
    `C ${q(w)} ${q(y0 + crownH * 0.72)} ${q(nR + bul)} ${q(y0 + crownH * 0.40)} ${q(nR)} ${y0} Z`
  );
}

// Upper root: points down from cervical
function upperRootPath(w: number, crownH: number, rootH: number, family: ToothFamily): string {
  const neck   = w * CERVICAL;
  const nL     = (w - neck) / 2;
  const nR     = nL + neck;
  const totalH = crownH + rootH;

  if (family === 'molar') {
    const furcY  = crownH + rootH * 0.36;
    const notchY = crownH + rootH * 0.22;
    const rW     = neck * 0.42;
    const lL = nL;          const lR = nL + rW;
    const rL = nR - rW;     const rR = nR;
    const lCx = (lL + lR) / 2;
    const rCx = (rL + rR) / 2;
    return (
      `M ${q(nL)} ${crownH} ` +
      `C ${q(nL + neck * 0.04)} ${q(crownH + rootH * 0.16)} ${q(lL + neck * 0.02)} ${q(furcY - rootH * 0.08)} ${q(lL)} ${q(furcY)} ` +
      `C ${q(lL - 0.5)} ${q(furcY + rootH * 0.32)} ${q(lCx - 2)} ${q(totalH - 5)} ${q(lCx)} ${totalH} ` +
      `C ${q(lCx + 2)} ${q(totalH - 5)} ${q(lR + 0.5)} ${q(furcY + rootH * 0.32)} ${q(lR)} ${q(furcY)} ` +
      `C ${q(lR)} ${q(notchY)} ${q(rL)} ${q(notchY)} ${q(rL)} ${q(furcY)} ` +
      `C ${q(rL - 0.5)} ${q(furcY + rootH * 0.32)} ${q(rCx - 2)} ${q(totalH - 5)} ${q(rCx)} ${totalH} ` +
      `C ${q(rCx + 2)} ${q(totalH - 5)} ${q(rR + 0.5)} ${q(furcY + rootH * 0.32)} ${q(rR)} ${q(furcY)} ` +
      `C ${q(nR - neck * 0.02)} ${q(furcY - rootH * 0.08)} ${q(nR - neck * 0.04)} ${q(crownH + rootH * 0.16)} ${q(nR)} ${crownH} Z`
    );
  }

  // single root
  const rW = neck * 0.54;
  const rL = (w - rW) / 2;
  const rR = rL + rW;
  const cx = w / 2;
  return (
    `M ${q(nL)} ${crownH} ` +
    `C ${q(nL)} ${q(crownH + rootH * 0.22)} ${q(rL)} ${q(crownH + rootH * 0.40)} ${q(rL)} ${q(crownH + rootH * 0.44)} ` +
    `C ${q(rL - 0.5)} ${q(crownH + rootH * 0.74)} ${q(cx - 2)} ${q(totalH - 5)} ${q(cx)} ${totalH} ` +
    `C ${q(cx + 2)} ${q(totalH - 5)} ${q(rR + 0.5)} ${q(crownH + rootH * 0.74)} ${q(rR)} ${q(crownH + rootH * 0.44)} ` +
    `C ${q(rR)} ${q(crownH + rootH * 0.40)} ${q(nR)} ${q(crownH + rootH * 0.22)} ${q(nR)} ${crownH} Z`
  );
}

// Lower root: points up from cervical (y0 = rootH, apex at y = 0)
function lowerRootPath(w: number, crownH: number, rootH: number, family: ToothFamily): string {
  const neck  = w * CERVICAL;
  const nL    = (w - neck) / 2;
  const nR    = nL + neck;
  const y0    = rootH;
  const furcY = rootH * 0.64;

  if (family === 'molar') {
    const notchY = rootH * 0.78;
    const rW     = neck * 0.42;
    const lL = nL;          const lR = nL + rW;
    const rL = nR - rW;     const rR = nR;
    const lCx = (lL + lR) / 2;
    const rCx = (rL + rR) / 2;
    return (
      `M ${q(nL)} ${y0} ` +
      `C ${q(nL + neck * 0.04)} ${q(y0 - rootH * 0.16)} ${q(lL + neck * 0.02)} ${q(furcY + rootH * 0.08)} ${q(lL)} ${q(furcY)} ` +
      `C ${q(lL - 0.5)} ${q(furcY - rootH * 0.32)} ${q(lCx - 2)} 5 ${q(lCx)} 0 ` +
      `C ${q(lCx + 2)} 5 ${q(lR + 0.5)} ${q(furcY - rootH * 0.32)} ${q(lR)} ${q(furcY)} ` +
      `C ${q(lR)} ${q(notchY)} ${q(rL)} ${q(notchY)} ${q(rL)} ${q(furcY)} ` +
      `C ${q(rL - 0.5)} ${q(furcY - rootH * 0.32)} ${q(rCx - 2)} 5 ${q(rCx)} 0 ` +
      `C ${q(rCx + 2)} 5 ${q(rR + 0.5)} ${q(furcY - rootH * 0.32)} ${q(rR)} ${q(furcY)} ` +
      `C ${q(nR - neck * 0.02)} ${q(furcY + rootH * 0.08)} ${q(nR - neck * 0.04)} ${q(y0 - rootH * 0.16)} ${q(nR)} ${y0} Z`
    );
  }

  // single root
  const rW = neck * 0.54;
  const rL = (w - rW) / 2;
  const rR = rL + rW;
  const cx = w / 2;
  return (
    `M ${q(nL)} ${y0} ` +
    `C ${q(nL)} ${q(y0 - rootH * 0.22)} ${q(rL)} ${q(y0 - rootH * 0.40)} ${q(rL)} ${q(y0 - rootH * 0.44)} ` +
    `C ${q(rL - 0.5)} ${q(y0 - rootH * 0.74)} ${q(cx - 2)} 5 ${q(cx)} 0 ` +
    `C ${q(cx + 2)} 5 ${q(rR + 0.5)} ${q(y0 - rootH * 0.74)} ${q(rR)} ${q(y0 - rootH * 0.44)} ` +
    `C ${q(rR)} ${q(y0 - rootH * 0.40)} ${q(nR)} ${q(y0 - rootH * 0.22)} ${q(nR)} ${y0} Z`
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
  const cls    = TOOTH_CLASS[num] ?? 'premolar';
  const family = TOOTH_FAMILY[cls];
  const { w, crownH, rootH } = DIMS[cls];
  const totalH = crownH + rootH;

  const isActive = state === 'selected' || state === 'shared';

  const crownFill =
    state === 'selected'    ? 'var(--color-teal)'
    : state === 'shared'    ? 'color-mix(in srgb, var(--color-teal) 25%, var(--color-surface-alt))'
    : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))'
    : 'var(--color-surface-alt)';

  const crownStroke =
    hovered                   ? 'var(--color-teal)'
    : state === 'selected'    ? 'var(--color-teal)'
    : state === 'shared'      ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-border))'
    : state === 'historical'  ? 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))'
    : 'var(--color-border)';

  const strokeW = state === 'selected' ? 2 : (state === 'shared' || hovered) ? 1.5 : 1;

  const crownFilter =
    state === 'selected'
      ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-teal) 45%, transparent))'
      : 'none';

  const rootFill =
    state === 'selected'
      ? 'color-mix(in srgb, var(--color-teal) 18%, var(--color-surface-alt))'
      : hovered
      ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
      : 'var(--color-surface-alt)';

  const rootStroke =
    hovered
      ? 'color-mix(in srgb, var(--color-teal) 35%, var(--color-border))'
      : 'var(--color-border)';

  const rootOpacity =
    state === 'selected' ? 0.40
    : state === 'shared' ? 0.58
    : 0.72;

  const cbX = w - 9;
  const cbY = isUpper ? 4 : rootH + 4;
  const isChecked = isActive;

  const crownPath = isUpper
    ? upperCrownPath(w, crownH, family)
    : lowerCrownPath(w, crownH, rootH, family);

  const rootPath = isUpper
    ? upperRootPath(w, crownH, rootH, family)
    : lowerRootPath(w, crownH, rootH, family);

  return (
    <svg
      width={w}
      height={totalH}
      viewBox={`0 0 ${w} ${totalH}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Root */}
      <path
        d={rootPath}
        style={{
          fill: rootFill,
          stroke: rootStroke,
          strokeWidth: 0.6,
          opacity: rootOpacity,
          transition: 'fill 0.15s, opacity 0.15s, stroke 0.15s',
        }}
      />

      {/* Crown */}
      <path
        d={crownPath}
        style={{
          fill: crownFill,
          stroke: crownStroke,
          strokeWidth: strokeW,
          filter: crownFilter,
          transition: 'fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease, filter 0.15s ease',
        }}
      />

      {/* Checkbox (multi-select mode) */}
      {showCheckbox && (
        <g>
          <rect
            x={cbX} y={cbY} width={7} height={7} rx={1.5}
            style={{
              fill: isChecked ? 'var(--color-teal)' : 'transparent',
              stroke: isChecked ? 'var(--color-teal)' : 'var(--color-border)',
              strokeWidth: 1,
              transition: 'fill 0.12s, stroke 0.12s',
            }}
          />
          {isChecked && (
            <polyline
              points={`${cbX + 1.5} ${cbY + 3.5} ${cbX + 3} ${cbY + 5} ${cbX + 5.5} ${cbY + 2}`}
              style={{ stroke: 'white', strokeWidth: 1.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}
            />
          )}
        </g>
      )}
    </svg>
  );
}

// ─── View filter ──────────────────────────────────────────────────────────────
type ViewFilter = 'all' | 'upper' | 'lower';

const FILTER_BUTTONS: { id: string; label: string; filter: ViewFilter }[] = [
  { id: 'maxila',     label: 'Maxila',          filter: 'upper' },
  { id: 'mandibula',  label: 'Mandíbula',       filter: 'lower' },
  { id: 'face',       label: 'Face',            filter: 'all'   },
  { id: 'arcada-sup', label: 'Arcada superior', filter: 'upper' },
  { id: 'arcada-inf', label: 'Arcada inferior', filter: 'lower' },
  { id: 'arcadas',    label: 'Arcadas',         filter: 'all'   },
];

// ─── Main component ───────────────────────────────────────────────────────────
export interface OdontogramaProps {
  selectedTeeth: number[];
  sharedTeeth?: number[];
  historicalTeeth?: Set<number>;
  onToothToggle: (tooth: number) => void;
  showCheckbox?: boolean;
  className?: string;
  compact?: boolean;
  hideFilters?: boolean;
}

export function Odontograma({
  selectedTeeth,
  sharedTeeth = [],
  historicalTeeth = new Set(),
  onToothToggle,
  showCheckbox = false,
  className,
  compact = false,
  hideFilters = false,
}: OdontogramaProps) {
  const [hoveredTooth, setHoveredTooth]   = useState<number | null>(null);
  const [tab, setTab]                     = useState<'permanent' | 'deciduous'>('permanent');
  const [viewFilter, setViewFilter]       = useState<ViewFilter>('all');
  const [activeFilterId, setActiveFilterId] = useState<string>('arcadas');
  const [legendOpen, setLegendOpen]       = useState(false);

  const upperTeeth = tab === 'permanent' ? TEETH_UPPER : TEETH_UPPER_DEC;
  const lowerTeeth = tab === 'permanent' ? TEETH_LOWER : TEETH_LOWER_DEC;

  function getState(tooth: number): ToothState {
    if (sharedTeeth.includes(tooth)) return 'shared';
    if (selectedTeeth.includes(tooth)) return 'selected';
    if (historicalTeeth.has(tooth)) return 'historical';
    return 'default';
  }

  function renderArch(teeth: number[], isUpper: boolean) {
    return teeth.map((num) => {
      const isMidlineStart = num === 21 || num === 31 || num === 61 || num === 71;
      const state  = getState(num);
      const isHov  = hoveredTooth === num;
      const isActive = state === 'selected' || state === 'shared';
      const numWeight = (state === 'selected' || state === 'shared') ? 800 : 700;

      const numColor =
        state === 'selected'    ? 'var(--color-teal)'
        : state === 'shared'    ? 'var(--color-teal)'
        : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-text-secondary))'
        : isHov                 ? 'var(--color-text-primary)'
        : 'var(--color-text-secondary)';

      return (
        <Fragment key={num}>
          {isMidlineStart && (
            <div
              className="self-stretch w-px mx-0.5 shrink-0"
              style={{ background: 'var(--color-border)', opacity: 0.6 }}
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={() => onToothToggle(num)}
            onMouseEnter={() => setHoveredTooth(num)}
            onMouseLeave={() => setHoveredTooth(null)}
            className={cn(
              'relative flex flex-col items-center outline-none focus-visible:ring-1 focus-visible:ring-teal rounded-sm',
              isUpper ? 'justify-end' : 'justify-start',
              isActive || isHov ? 'z-10' : 'z-0',
            )}
            style={{
              transform: isHov ? 'scale(1.10)' : isActive ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.13s ease',
              gap: 5,
            }}
            aria-label={`Dente ${num} — ${TOOTH_NAMES[num] ?? ''}`}
            aria-pressed={isActive}
          >
            {isUpper && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontWeight: numWeight,
                  color: numColor,
                  lineHeight: 1,
                  letterSpacing: '-0.3px',
                  transition: 'color 0.13s',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {num}
              </span>
            )}

            <ToothSVG
              num={num}
              isUpper={isUpper}
              state={state}
              hovered={isHov}
              showCheckbox={showCheckbox}
            />

            {!isUpper && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontWeight: numWeight,
                  color: numColor,
                  lineHeight: 1,
                  letterSpacing: '-0.3px',
                  transition: 'color 0.13s',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {num}
              </span>
            )}
          </button>
        </Fragment>
      );
    });
  }

  const hoveredState = hoveredTooth ? getState(hoveredTooth) : null;

  return (
    <div
      className={cn('flex flex-col gap-3 select-none', className)}
      style={compact ? { zoom: 0.82 } : undefined}
    >

      {/* ── Tab bar + Legenda ── */}
      <div
        className="relative flex items-center gap-0 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {([
          { id: 'permanent', label: 'Permanentes' },
          { id: 'deciduous', label: 'Decíduos' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="relative px-4 py-2 text-[11px] font-bold tracking-wide transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal"
            style={{
              color: tab === id ? 'var(--color-teal)' : 'var(--color-text-secondary)',
              background: 'transparent',
            }}
          >
            {label}
            {tab === id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: 'var(--color-teal)' }}
              />
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Legenda button */}
        <button
          type="button"
          onClick={() => setLegendOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal rounded-sm"
          style={{ color: legendOpen ? 'var(--color-teal)' : 'var(--color-text-secondary)' }}
          aria-expanded={legendOpen}
          aria-label="Legenda do odontograma"
        >
          <List size={11} strokeWidth={2.2} />
          Legenda
        </button>

        {/* Legend panel */}
        {legendOpen && (
          <div
            className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border p-3 flex flex-col gap-3 shadow-lg"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            {[
              {
                fill: 'var(--color-surface-alt)',
                stroke: 'var(--color-border)',
                strokeW: 1,
                filter: 'none',
                label: 'Sem registro',
                desc: 'Nenhum registro neste dente',
              },
              {
                fill: 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))',
                stroke: 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))',
                strokeW: 1,
                filter: 'none',
                label: 'Histórico',
                desc: 'Dente com registros anteriores',
              },
              {
                fill: 'var(--color-teal)',
                stroke: 'var(--color-teal)',
                strokeW: 2,
                filter: 'drop-shadow(0 0 3px color-mix(in srgb, var(--color-teal) 45%, transparent))',
                label: 'Selecionado',
                desc: 'Dente selecionado para esta consulta',
              },
            ].map(({ fill, stroke, strokeW: sw, filter, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5">
                <svg width={12} height={12} viewBox="0 0 12 12" className="mt-0.5 shrink-0" style={{ overflow: 'visible' }}>
                  <rect x={0.75} y={0.75} width={10.5} height={10.5} rx={2.5}
                    style={{ fill, stroke, strokeWidth: sw, filter }}
                  />
                </svg>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold leading-none" style={{ color: 'var(--color-text-primary)' }}>
                    {label}
                  </span>
                  <span className="text-[9px] leading-none" style={{ color: 'var(--color-text-secondary)' }}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <div className="overflow-x-auto">
        <div className="flex flex-col items-center gap-0 min-w-max px-1">

          {/* Quadrant labels — upper */}
          {viewFilter !== 'lower' && (
            <div className="flex w-full justify-between mb-2 px-1">
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Sup. Direito
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Sup. Esquerdo
              </span>
            </div>
          )}

          {/* Upper arch */}
          {viewFilter !== 'lower' && (
            <div className="flex items-end gap-[3px]">
              {renderArch(upperTeeth, true)}
            </div>
          )}

          {/* Midline separator */}
          {viewFilter === 'all' && (
            <div
              className="w-full my-[8px]"
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--color-border) 15%, var(--color-border) 85%, transparent)',
              }}
            />
          )}

          {/* Lower arch */}
          {viewFilter !== 'upper' && (
            <div className="flex items-start gap-[3px]">
              {renderArch(lowerTeeth, false)}
            </div>
          )}

          {/* Quadrant labels — lower */}
          {viewFilter !== 'upper' && (
            <div className="flex w-full justify-between mt-2 px-1">
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Inf. Direito
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Inf. Esquerdo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Info bar ── */}
      <div className="h-5 flex items-center px-1">
        {hoveredTooth ? (
          <div className="flex items-center gap-1.5 text-[11px] leading-none">
            <span className="font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
              {hoveredTooth}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{TOOTH_NAMES[hoveredTooth] ?? ''}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>·</span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {getQuadrantLabel(hoveredTooth)}
            </span>
            {hoveredState === 'historical' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-teal)' }}>
                · histórico
              </span>
            )}
            {(hoveredState === 'selected' || hoveredState === 'shared') && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-teal)' }}>
                · selecionado
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] italic leading-none" style={{ color: 'var(--color-text-muted)' }}>
            Clique para selecionar um dente
          </span>
        )}
      </div>

      {/* ── Filter buttons ── */}
      {!hideFilters && (
        <div className="flex items-center gap-1.5 flex-wrap px-0.5">
          {FILTER_BUTTONS.map(({ id, label, filter }) => {
            const isActive = activeFilterId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveFilterId(id);
                  setViewFilter(filter);
                }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all outline-none focus-visible:ring-1 focus-visible:ring-teal"
                style={{
                  background: isActive
                    ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
                    : 'var(--color-surface-alt)',
                  color: isActive ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                  border: `1px solid ${isActive
                    ? 'color-mix(in srgb, var(--color-teal) 40%, var(--color-border))'
                    : 'var(--color-border)'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
