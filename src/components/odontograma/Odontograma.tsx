'use client';

import { useMemo, useState, Fragment } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
} from '@/lib/arcadas';
import {
  TOOTH_CLASS, TOOTH_FAMILY, DIMS,
  crownPathOcclusalTop, crownPathOcclusalBottom, rootPathDown, rootPathUp, canalPaths,
} from './tooth-geometry';
import { corDoRegistro, type OdontogramaEventoDraft } from '@/types/odontograma';

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

// ─── State types ──────────────────────────────────────────────────────────────
type ToothState = 'default' | 'historical' | 'shared' | 'selected' | 'detected';

/** Status de acompanhamento de tratamento (ficha unificada, #16 D3). */
export type ToothStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

// ─── v3: resumo clínico por dente (reduce dos eventos propostos/salvos) ──────
type CorClinica = 'coral' | 'teal' | 'slate';

const COR_TOKEN: Record<CorClinica, string> = {
  coral: 'var(--color-coral)',
  teal:  'var(--color-teal)',
  slate: 'var(--color-slate)',
};

export interface ResumoDente {
  cor: CorClinica | null;       // dominante: coral (a fazer) > teal (feito aqui) > slate (pré-existente)
  ausente: boolean;             // exodontia realizada / esfoliação
  exodontiaIndicada: boolean;
  incluso: boolean;
  canal: CorClinica | null;
  lesao: boolean;
  implante: CorClinica | null;
  coroa: CorClinica | null;
  pino: CorClinica | null;
  selante: CorClinica | null;
  fratura: boolean;
}

const RESUMO_VAZIO: ResumoDente = {
  cor: null, ausente: false, exodontiaIndicada: false, incluso: false,
  canal: null, lesao: false, implante: null, coroa: null, pino: null,
  selante: null, fratura: false,
};

/** coral vence teal, que vence slate (a pendência é o que não pode sumir da vista). */
function corDominante(a: CorClinica | null, b: CorClinica): CorClinica {
  if (a === 'coral' || b === 'coral') return 'coral';
  if (a === 'teal' || b === 'teal') return 'teal';
  return 'slate';
}

export function buildResumos(eventos: OdontogramaEventoDraft[]): Map<number, ResumoDente> {
  const map = new Map<number, ResumoDente>();
  for (const ev of eventos) {
    const dente = ev.ancora.dente;
    if (dente == null) continue; // âncoras de arcada/quadrante não pintam dente individual
    const r = map.get(dente) ?? { ...RESUMO_VAZIO };
    const cor = corDoRegistro(ev.status, ev.origem);
    r.cor = corDominante(r.cor, cor);
    switch (ev.tipo) {
      case 'exodontia':
        if (ev.status === 'realizado') r.ausente = true;
        else r.exodontiaIndicada = true;
        break;
      case 'esfoliacao':
        if (ev.status === 'realizado') r.ausente = true;
        break;
      case 'inclusao':          r.incluso = true; break;
      case 'endodontia':        r.canal = corDominante(r.canal, cor); break;
      case 'lesao_periapical':  r.lesao = true; break;
      case 'implante':          r.implante = corDominante(r.implante, cor); break;
      case 'coroa':             r.coroa = corDominante(r.coroa, cor); break;
      case 'pino_nucleo':       r.pino = corDominante(r.pino, cor); break;
      case 'selante':           r.selante = corDominante(r.selante, cor); break;
      case 'fratura':           r.fratura = true; break;
      case 'carie_restauracao':
      case 'ponte':
        break; // contribuem só pra cor dominante (ponte ganha bracket na Fatia B)
    }
    map.set(dente, r);
  }
  return map;
}

// ─── Individual tooth SVG ─────────────────────────────────────────────────────
interface ToothSVGProps {
  num: number;
  isUpper: boolean;
  state: ToothState;
  hovered: boolean;
  showCheckbox: boolean;
  /** Anel de destaque independente do preenchimento — usado pra indicar filtro ativo em colorMode='status'. */
  ringed?: boolean;
  /** v3: resumo clínico do dente — quando presente, dirige o visual (cores/marcas do catálogo). */
  resumo?: ResumoDente | null;
}

export function ToothSVG({ num, isUpper, state, hovered, showCheckbox, ringed = false, resumo = null }: ToothSVGProps) {
  const cls    = TOOTH_CLASS[num] ?? 'premolar';
  const family = TOOTH_FAMILY[cls];
  const { w, crownH, rootH } = DIMS[cls];
  const totalH = crownH + rootH;

  // Orientação de boca (decisão 18/07): superiores com a raiz pra CIMA e a coroa pra
  // baixo; inferiores o inverso — as oclusais se encontram no plano oclusal do meio.
  const crownPath = isUpper
    ? crownPathOcclusalBottom(w, crownH, rootH, family)
    : crownPathOcclusalTop(w, crownH, family);
  const rootPath = isUpper
    ? rootPathUp(w, crownH, rootH, family)
    : rootPathDown(w, crownH, rootH, family);

  // Regiões (dependem da orientação) — usadas pelas marcas do catálogo v3.
  const crownTop = isUpper ? rootH : 0;
  const crownBot = isUpper ? totalH : crownH;
  const apexY    = isUpper ? 5 : totalH - 5;
  const occluY   = isUpper ? totalH - 8 : 8;

  const isActive = state === 'selected' || state === 'shared';

  // ── v3: dente AUSENTE — só o contorno tracejado ("vaga" na arcada) ──
  if (resumo?.ausente) {
    return (
      <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block', overflow: 'visible' }}>
        <path d={rootPath} style={{ fill: 'none', stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.8 }} />
        <path d={crownPath} style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.2, strokeDasharray: '3 3' }} />
      </svg>
    );
  }

  const clinico = resumo != null;
  const rootTint = resumo?.implante ?? resumo?.canal ?? resumo?.pino ?? null;

  const crownFill = clinico
    ? (resumo.cor
        ? `color-mix(in srgb, ${COR_TOKEN[resumo.cor]} 30%, var(--color-surface-alt))`
        : 'var(--color-surface-alt)')
    : state === 'selected'    ? 'var(--color-teal)'
    : state === 'shared'    ? 'color-mix(in srgb, var(--color-teal) 25%, var(--color-surface-alt))'
    : state === 'detected'  ? 'color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-alt))'
    : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))'
    : 'var(--color-surface-alt)';

  const crownStroke = clinico
    ? (hovered ? 'var(--color-teal)' : resumo.incluso ? 'var(--color-text-secondary)' : resumo.cor ? COR_TOKEN[resumo.cor] : 'var(--color-border)')
    : ringed ? 'var(--color-teal)'
    : hovered                   ? 'var(--color-teal)'
    : state === 'selected'    ? 'var(--color-teal)'
    : state === 'shared'      ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-border))'
    : state === 'detected'    ? 'var(--color-warning)'
    : state === 'historical'  ? 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))'
    : 'var(--color-border)';

  const strokeW = ringed ? 2.5 : state === 'selected' && !clinico ? 2 : (state === 'shared' || state === 'detected' || hovered) ? 1.5 : clinico && resumo.cor ? 1.4 : 1;

  const crownFilter = !clinico && state === 'selected'
    ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-teal) 45%, transparent))'
    : !clinico && state === 'detected'
    ? 'drop-shadow(0 0 3px color-mix(in srgb, var(--color-warning) 40%, transparent))'
    : 'none';

  const rootFill = clinico
    ? (rootTint
        ? `color-mix(in srgb, ${COR_TOKEN[rootTint]} 16%, var(--color-surface-alt))`
        : 'var(--color-surface-alt)')
    : state === 'selected'
    ? 'color-mix(in srgb, var(--color-teal) 18%, var(--color-surface-alt))'
    : hovered
    ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
    : 'var(--color-surface-alt)';

  const rootStroke = clinico && rootTint
    ? `color-mix(in srgb, ${COR_TOKEN[rootTint]} 55%, var(--color-border))`
    : hovered
    ? 'color-mix(in srgb, var(--color-teal) 35%, var(--color-border))'
    : 'var(--color-border)';

  const rootOpacity = clinico ? 0.8
    : state === 'selected' ? 0.40
    : state === 'shared' ? 0.58
    : state === 'detected' ? 0.58
    : 0.72;

  const cbX = w - 9;
  const cbY = 4;
  const isChecked = isActive;

  const needsDots = clinico && (resumo.cor === 'slate' || resumo.coroa === 'slate');
  const dotsId = `odx-dots-${num}`;
  const dash = clinico && resumo.incluso ? '4 3' : undefined;

  return (
    <svg
      width={w}
      height={totalH}
      viewBox={`0 0 ${w} ${totalH}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {needsDots && (
        <defs>
          <pattern id={dotsId} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="var(--color-surface)" />
          </pattern>
        </defs>
      )}

      {/* Root — o implante substitui a raiz pelo parafuso */}
      {!(clinico && resumo.implante) && (
        <path
          d={rootPath}
          style={{
            fill: rootFill,
            stroke: rootStroke,
            strokeWidth: 0.6,
            strokeDasharray: dash,
            opacity: rootOpacity,
            transition: 'fill 0.15s, opacity 0.15s, stroke 0.15s',
          }}
        />
      )}

      {/* v3: silhueta do canal — vazia (contorno) = a tratar · preenchida = tratado */}
      {clinico && resumo.canal && !resumo.implante &&
        canalPaths(num, isUpper).map((d, i) => (
          <path
            key={i}
            d={d}
            style={
              resumo.canal === 'coral'
                ? { fill: 'none', stroke: COR_TOKEN.coral, strokeWidth: 1.4 }
                : { fill: COR_TOKEN[resumo.canal!], stroke: 'none' }
            }
          />
        ))}

      {/* v3: parafuso do implante no lugar da raiz */}
      {clinico && resumo.implante && (
        <g style={{ stroke: COR_TOKEN[resumo.implante], strokeWidth: 2, strokeLinecap: 'round' }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const t = i / 4;
            const y = isUpper ? rootH - 4 - t * (rootH - 12) : crownH + 4 + t * (rootH - 12);
            const half = w * 0.24 * (1 - t * 0.55);
            return <line key={i} x1={w / 2 - half} y1={y} x2={w / 2 + half} y2={y} />;
          })}
        </g>
      )}

      {/* v3: pino/núcleo no terço coronal da raiz */}
      {clinico && resumo.pino && !resumo.implante && (
        <rect
          x={w / 2 - 3.5}
          y={isUpper ? rootH - rootH * 0.36 - 2 : crownH + 2}
          width={7}
          height={rootH * 0.36}
          rx={2}
          style={{ fill: COR_TOKEN[resumo.pino] }}
        />
      )}

      {/* v3: lesão periapical — círculo vazado no ápice */}
      {clinico && resumo.lesao && (
        <circle cx={w / 2} cy={apexY} r={4.5} style={{ fill: 'none', stroke: 'var(--color-coral)', strokeWidth: 1.8 }} />
      )}

      {/* Crown */}
      <path
        d={crownPath}
        style={{
          fill: crownFill,
          stroke: crownStroke,
          strokeWidth: strokeW,
          strokeDasharray: dash,
          filter: crownFilter,
          transition: 'fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease, filter 0.15s ease',
        }}
      />

      {/* v3: textura pontilhada do pré-existente (reforço não-só-cor) */}
      {needsDots && (
        <path d={crownPath} style={{ fill: `url(#${dotsId})`, opacity: 0.5, pointerEvents: 'none' }} />
      )}

      {/* v3: coroa total — contorno duplo */}
      {clinico && resumo.coroa && (
        <path d={crownPath} style={{ fill: 'none', stroke: COR_TOKEN[resumo.coroa], strokeWidth: 2.4 }} />
      )}

      {/* v3: selante — ponto na oclusal */}
      {clinico && resumo.selante && (
        <circle cx={w / 2} cy={occluY} r={3} style={{ fill: COR_TOKEN[resumo.selante] }} />
      )}

      {/* v3: fratura — zigue-zague na coroa */}
      {clinico && resumo.fratura && (
        <path
          d={`M ${w * 0.30} ${crownTop + crownH * 0.12} L ${w * 0.56} ${crownTop + crownH * 0.38} L ${w * 0.40} ${crownTop + crownH * 0.60} L ${w * 0.66} ${crownTop + crownH * 0.88}`}
          style={{ fill: 'none', stroke: 'var(--color-coral)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}
        />
      )}

      {/* v3: extração indicada — X sobre a coroa */}
      {clinico && resumo.exodontiaIndicada && (
        <g style={{ stroke: 'var(--color-coral)', strokeWidth: 2.6, strokeLinecap: 'round' }}>
          <line x1={w * 0.18} y1={crownTop + 5} x2={w * 0.82} y2={crownBot - 5} />
          <line x1={w * 0.82} y1={crownTop + 5} x2={w * 0.18} y2={crownBot - 5} />
        </g>
      )}

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
  /** Dentes detectados pela IA, pendentes de confirmação (estado amber). Ex: modo consulta. */
  detectedTeeth?: number[];
  onToothToggle: (tooth: number) => void;
  showCheckbox?: boolean;
  className?: string;
  compact?: boolean;
  hideFilters?: boolean;
  /**
   * Significado da cor (#16 D7). 'selection' (padrão) = seletor de dentes (teal=selecionado,
   * amber=detectado). 'status' = mapa de progresso do tratamento (teal=concluído,
   * amber=em andamento, cinza=não iniciado) — vem de `statusTeeth`, não de `selectedTeeth`.
   */
  colorMode?: 'selection' | 'status';
  /** Status por dente/sentinela — só usado quando `colorMode='status'`. */
  statusTeeth?: Partial<Record<number, ToothStatus>>;
  /**
   * v3 — camada clínica: eventos de odontograma (propostos ou salvos). Quando presente,
   * o componente vira o "mapa pintado": cor dominante por dente + marcas do catálogo
   * (canal, implante, coroa, X, ausente…). Ignora selection/status.
   */
  eventos?: OdontogramaEventoDraft[];
}

export function Odontograma({
  selectedTeeth,
  sharedTeeth = [],
  historicalTeeth = new Set(),
  detectedTeeth = [],
  onToothToggle,
  showCheckbox = false,
  className,
  compact = false,
  hideFilters = false,
  colorMode = 'selection',
  statusTeeth = {},
  eventos,
}: OdontogramaProps) {
  const [hoveredTooth, setHoveredTooth]   = useState<number | null>(null);
  const [tab, setTab]                     = useState<'permanent' | 'deciduous'>('permanent');
  const [viewFilter, setViewFilter]       = useState<ViewFilter>('all');
  const [activeFilterId, setActiveFilterId] = useState<string>('arcadas');
  const [legendOpen, setLegendOpen]       = useState(false);

  const clinico = eventos != null;
  const resumos = useMemo(() => buildResumos(eventos ?? []), [eventos]);

  const upperTeeth = tab === 'permanent' ? TEETH_UPPER : TEETH_UPPER_DEC;
  const lowerTeeth = tab === 'permanent' ? TEETH_LOWER : TEETH_LOWER_DEC;

  // Contagem de dentes ativos por dentição — indicador nas abas (torna decíduo detectado descobrível)
  const activeTeeth = clinico
    ? Array.from(resumos.keys())
    : colorMode === 'status'
    ? Object.keys(statusTeeth).map(Number)
    : [...selectedTeeth, ...detectedTeeth];
  const tabCounts: Record<'permanent' | 'deciduous', number> = {
    permanent: activeTeeth.filter(t => TEETH_UPPER.includes(t) || TEETH_LOWER.includes(t)).length,
    deciduous: activeTeeth.filter(t => TEETH_UPPER_DEC.includes(t) || TEETH_LOWER_DEC.includes(t)).length,
  };

  function getState(tooth: number): ToothState {
    if (clinico) return 'default'; // o visual clínico vem do resumo, não do state
    if (colorMode === 'status') {
      const st = statusTeeth[tooth];
      if (st === 'concluido') return 'selected';
      if (st === 'em_andamento') return 'detected';
      return 'default';
    }
    if (sharedTeeth.includes(tooth)) return 'shared';
    if (selectedTeeth.includes(tooth)) return 'selected';
    if (detectedTeeth.includes(tooth)) return 'detected';
    if (historicalTeeth.has(tooth)) return 'historical';
    return 'default';
  }

  // #16 D6 — "destaque de região" pros rótulos de quadrante: agrega o status das
  // sentinelas que afetam aquele canto (quadrante + arcada + boca toda), mesma
  // regra de prioridade do computeToothStatusMap (concluído só se tudo concluído).
  function regionStatus(...sentinels: number[]): ToothStatus | undefined {
    const statuses = sentinels
      .map((s) => statusTeeth[s])
      .filter((s): s is ToothStatus => s != null);
    if (statuses.length === 0) return undefined;
    if (statuses.every((s) => s === 'concluido')) return 'concluido';
    if (statuses.some((s) => s === 'concluido' || s === 'em_andamento')) return 'em_andamento';
    return 'nao_iniciado';
  }

  function RegionDot({ status }: { status: ToothStatus | undefined }) {
    if (colorMode !== 'status' || !status) return null;
    const color =
      status === 'concluido'     ? 'var(--color-teal)'
      : status === 'em_andamento' ? 'var(--color-warning)'
      : 'var(--color-text-muted)';
    return <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle" style={{ background: color }} aria-hidden="true" />;
  }

  function renderArch(teeth: number[], isUpper: boolean) {
    return teeth.map((num) => {
      const isMidlineStart = num === 21 || num === 31 || num === 61 || num === 71;
      const state  = getState(num);
      const resumo = clinico ? resumos.get(num) ?? null : null;
      const isHov  = hoveredTooth === num;
      const isActive = state === 'selected' || state === 'shared';
      const numWeight = (state === 'selected' || state === 'shared' || state === 'detected' || resumo?.cor) ? 800 : 700;

      const numColor = resumo?.cor
        ? COR_TOKEN[resumo.cor]
        : state === 'selected'    ? 'var(--color-teal)'
        : state === 'shared'    ? 'var(--color-teal)'
        : state === 'detected'  ? 'var(--color-warning)'
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
              showCheckbox={showCheckbox && !clinico}
              ringed={colorMode === 'status' && !clinico && selectedTeeth.includes(num)}
              resumo={resumo}
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
  const hoveredResumo = clinico && hoveredTooth ? resumos.get(hoveredTooth) ?? null : null;

  const legendItems = clinico
    ? [
        {
          fill: 'color-mix(in srgb, var(--color-coral) 30%, var(--color-surface-alt))',
          stroke: 'var(--color-coral)', strokeW: 1.2, filter: 'none',
          label: 'A fazer', desc: 'Indicado/planejado — pendente',
        },
        {
          fill: 'color-mix(in srgb, var(--color-teal) 30%, var(--color-surface-alt))',
          stroke: 'var(--color-teal)', strokeW: 1.2, filter: 'none',
          label: 'Feito aqui', desc: 'Realizado nesta clínica',
        },
        {
          fill: 'color-mix(in srgb, var(--color-slate) 45%, var(--color-surface-alt))',
          stroke: 'var(--color-slate)', strokeW: 1.2, filter: 'none',
          label: 'Pré-existente', desc: 'O paciente já chegou assim',
        },
        {
          fill: 'transparent', stroke: 'var(--color-text-muted)', strokeW: 1.2, filter: 'none',
          label: 'Ausente', desc: 'Extraído/esfoliado — só o contorno',
        },
      ]
    : [
        {
          fill: 'var(--color-surface-alt)',
          stroke: 'var(--color-border)', strokeW: 1, filter: 'none',
          label: 'Sem registro', desc: 'Nenhum registro neste dente',
        },
        {
          fill: 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))',
          stroke: 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))', strokeW: 1, filter: 'none',
          label: 'Histórico', desc: 'Dente com registros anteriores',
        },
        {
          fill: 'var(--color-teal)',
          stroke: 'var(--color-teal)', strokeW: 2,
          filter: 'drop-shadow(0 0 3px color-mix(in srgb, var(--color-teal) 45%, transparent))',
          label: 'Selecionado', desc: 'Dente selecionado para esta consulta',
        },
      ];

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
            {tabCounts[id] > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold align-middle"
                style={{ background: 'var(--color-teal)', color: 'white' }}
              >
                {tabCounts[id]}
              </span>
            )}
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
            {legendItems.map(({ fill, stroke, strokeW: sw, filter, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5">
                <svg width={12} height={12} viewBox="0 0 12 12" className="mt-0.5 shrink-0" style={{ overflow: 'visible' }}>
                  <rect x={0.75} y={0.75} width={10.5} height={10.5} rx={2.5}
                    style={{ fill, stroke, strokeWidth: sw, filter, strokeDasharray: label === 'Ausente' ? '2 2' : undefined }}
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
                <RegionDot status={regionStatus(QUAD_SUP_DIREITO, ARCH_SUPERIOR, ARCH_COMPLETA)} />
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Sup. Esquerdo
                <RegionDot status={regionStatus(QUAD_SUP_ESQUERDO, ARCH_SUPERIOR, ARCH_COMPLETA)} />
              </span>
            </div>
          )}

          {/* Upper arch — raízes pra cima, coroas pro plano oclusal */}
          {viewFilter !== 'lower' && (
            <div className="flex items-end gap-[3px]">
              {renderArch(upperTeeth, true)}
            </div>
          )}

          {/* Midline separator — o plano oclusal */}
          {viewFilter === 'all' && (
            <div
              className="w-full my-[8px]"
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--color-border) 15%, var(--color-border) 85%, transparent)',
              }}
            />
          )}

          {/* Lower arch — coroas pra cima, raízes pra baixo */}
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
                <RegionDot status={regionStatus(QUAD_INF_DIREITO, ARCH_INFERIOR, ARCH_COMPLETA)} />
              </span>
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--color-text-muted)' }}>
                Inf. Esquerdo
                <RegionDot status={regionStatus(QUAD_INF_ESQUERDO, ARCH_INFERIOR, ARCH_COMPLETA)} />
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
            {hoveredResumo?.cor === 'coral' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-coral)' }}>
                · a fazer
              </span>
            )}
            {hoveredResumo?.cor === 'teal' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-teal)' }}>
                · feito aqui
              </span>
            )}
            {hoveredResumo?.cor === 'slate' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-slate)' }}>
                · pré-existente
              </span>
            )}
            {!clinico && hoveredState === 'historical' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-teal)' }}>
                · histórico
              </span>
            )}
            {!clinico && (hoveredState === 'selected' || hoveredState === 'shared') && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: 'var(--color-teal)' }}>
                · selecionado
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] italic leading-none" style={{ color: 'var(--color-text-muted)' }}>
            {clinico ? 'Toque um dente para ver e editar o detalhe' : 'Clique para selecionar um dente'}
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
