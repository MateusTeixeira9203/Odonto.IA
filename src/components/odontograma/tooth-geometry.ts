// Geometria anatômica dos dentes — compartilhada entre Odontograma.tsx (visão geral)
// e ToothDetailPanel.tsx (painel de detalhe do v3).
//
// EXTRAÇÃO da geometria que vivia dentro de Odontograma.tsx (behavior-preserving) +
// helpers novos do v3: silhueta de canal (design aprovado 18/07 — canal desenhado por
// inteiro, não linha fina), contorno/zonas do mapa oclusal e orientação mesial.

import type { FaceDental } from '@/types/odontograma';

// ─── Tooth class ──────────────────────────────────────────────────────────────
export type ToothClass =
  | 'central' | 'lateral' | 'canine' | 'premolar'
  | 'molar1' | 'molar2' | 'molar3'
  | 'dec_incisor' | 'dec_canine' | 'dec_molar';

export interface Dim { w: number; crownH: number; rootH: number; isMolar: boolean }

export const TOOTH_CLASS: Record<number, ToothClass> = {
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
export const DIMS: Record<ToothClass, Dim> = {
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
export type ToothFamily = 'anterior' | 'canine' | 'premolar' | 'molar';

export const TOOTH_FAMILY: Record<ToothClass, ToothFamily> = {
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

// Crown com oclusal/incisal no TOPO (y=0), cervical embaixo (y=h).
export function crownPathOcclusalTop(w: number, h: number, family: ToothFamily): string {
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

// Crown com oclusal/incisal EMBAIXO (y = rootH + crownH), cervical no topo (y = rootH).
export function crownPathOcclusalBottom(w: number, crownH: number, rootH: number, family: ToothFamily): string {
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

// Raiz apontando pra BAIXO a partir da cervical (crown em cima).
export function rootPathDown(w: number, crownH: number, rootH: number, family: ToothFamily): string {
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

// Raiz apontando pra CIMA a partir da cervical (crown embaixo; y0 = rootH, ápice em y = 0).
export function rootPathUp(w: number, crownH: number, rootH: number, family: ToothFamily): string {
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

// ─── v3: silhueta de canal (design aprovado 18/07) ───────────────────────────
// O canal é desenhado POR INTEIRO dentro da raiz — vazio (contorno) = a tratar,
// preenchido = tratado. Nunca linha fina (reprovada por legibilidade).

function canalPath(cx: number, hw: number, yCerv: number, yApex: number): string {
  const yMid = (yCerv + yApex) / 2;
  const dir  = yApex > yCerv ? 1 : -1;
  return (
    `M ${q(cx - hw)} ${q(yCerv)} L ${q(cx + hw)} ${q(yCerv)} ` +
    `C ${q(cx + hw * 0.6)} ${q(yMid)} ${q(cx + 1.2)} ${q(yApex - 5 * dir)} ${q(cx)} ${q(yApex)} ` +
    `C ${q(cx - 1.2)} ${q(yApex - 5 * dir)} ${q(cx - hw * 0.6)} ${q(yMid)} ${q(cx - hw)} ${q(yCerv)} Z`
  );
}

/**
 * Silhuetas dos canais do dente. `rootAtTop` = raiz pra cima (dentes superiores na
 * orientação de boca). Molar → 2 canais; demais → 1.
 */
export function canalPaths(num: number, rootAtTop: boolean): string[] {
  const cls = TOOTH_CLASS[num] ?? 'premolar';
  const family = TOOTH_FAMILY[cls];
  const { w, crownH, rootH } = DIMS[cls];
  const neck = w * CERVICAL;
  const nL = (w - neck) / 2;
  const nR = nL + neck;

  // Cervical/ápice conforme orientação da raiz.
  const yCerv = rootAtTop ? rootH - 2 : crownH + 2;
  const yApex = rootAtTop ? 6 : crownH + rootH - 6;

  if (family === 'molar') {
    const rW  = neck * 0.42;
    const lCx = nL + rW / 2;
    const rCx = nR - rW / 2;
    const hw  = Math.max(2.6, rW * 0.28);
    return [canalPath(lCx, hw, yCerv, yApex), canalPath(rCx, hw, yCerv, yApex)];
  }
  const hw = Math.max(3, neck * 0.54 * 0.3);
  return [canalPath(w / 2, hw, yCerv, yApex)];
}

// ─── v3: mapa oclusal (painel de detalhe) ────────────────────────────────────
// Contorno anatômico por família + partição nas 5 faces, em caixa 0..100.

/** Contorno oclusal: molar = quadrado arredondado 4 lóbulos; demais = oval. */
export function occlusalContourPath(num: number): string {
  const cls = TOOTH_CLASS[num] ?? 'premolar';
  if (TOOTH_FAMILY[cls] === 'molar') {
    return 'M50,5 C67,5 78,3 87,13 C97,22 95,33 95,50 C95,67 97,78 87,87 C78,97 67,95 50,95 C33,95 22,97 13,87 C3,78 5,67 5,50 C5,33 3,22 13,13 C22,3 33,5 50,5 Z';
  }
  return 'M50,5 C68,5 84,20 84,50 C84,80 68,95 50,95 C32,95 16,80 16,50 C16,20 32,5 50,5 Z';
}

/**
 * Mesial fica à ESQUERDA da tela? No layout FDI (18…11 | 21…28), a mesial aponta
 * pra linha média: quadrantes 2/3 (e decíduos 6/7) têm mesial à esquerda.
 */
export function mesialEsquerda(num: number): boolean {
  const quad = Math.floor(num / 10);
  return quad === 2 || quad === 3 || quad === 6 || quad === 7;
}

/**
 * Polígono (points de <polygon>) de cada face no mapa oclusal 0..100.
 *
 * As zonas são recortadas pelo contorno (clipPath), então precisam EXTRAPOLAR a caixa —
 * senão a borda do polígono aparece como corte reto dentro do oval. Bug 21/07: nos
 * não-molares o contorno é oval (x de 16 a 84) e as bandas retas em x=0/100 cortavam
 * as faces M/D. Solução: sangria (-15/115) em todas as bordas externas; o clip resolve
 * a forma final, seja o quadrado do molar ou o oval do pré-molar/anterior.
 */
export function occlusalZonePoints(face: FaceDental, num: number): string {
  const B = -15, E = 115;                                  // sangria além da caixa
  const esq = `${B},${B} 33,33 33,67 ${B},${E}`;           // banda esquerda
  const dir = `${E},${B} 67,33 67,67 ${E},${E}`;           // banda direita
  const topo  = `${B},${B} ${E},${B} 67,33 33,33`;
  const base  = `${B},${E} ${E},${E} 67,67 33,67`;
  const superior = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
  switch (face) {
    case 'O': return '33,33 67,33 67,67 33,67';
    // V (vestibular) fica no lado EXTERNO da boca: em cima nos superiores, embaixo nos inferiores.
    case 'V': return superior ? topo : base;
    case 'L': return superior ? base : topo;
    case 'M': return mesialEsquerda(num) ? esq : dir;
    case 'D': return mesialEsquerda(num) ? dir : esq;
  }
}

/**
 * Posição da LETRA de cada face no mapa oclusal — respeita a largura real do contorno
 * (oval é mais estreito que o quadrado do molar), pra a letra não cair fora do desenho.
 */
export function occlusalLabelPos(face: FaceDental, num: number): { x: number; y: number } {
  const cls = TOOTH_CLASS[num] ?? 'premolar';
  const molar = TOOTH_FAMILY[cls] === 'molar';
  const lateral = molar ? 17 : 26;                          // M/D pra dentro nos ovais
  const vertical = molar ? 20 : 24;                         // V/L idem
  const superior = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
  const esquerda = mesialEsquerda(num);
  switch (face) {
    case 'O': return { x: 50, y: 53 };
    case 'V': return { x: 50, y: superior ? vertical : 100 - vertical + 4 };
    case 'L': return { x: 50, y: superior ? 100 - vertical + 4 : vertical };
    case 'M': return { x: esquerda ? lateral : 100 - lateral, y: 53 };
    case 'D': return { x: esquerda ? 100 - lateral : lateral, y: 53 };
  }
}
