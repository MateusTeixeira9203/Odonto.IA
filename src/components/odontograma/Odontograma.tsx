'use client';

import { useMemo, useState, Fragment } from 'react';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TOOTH_CLASS, TOOTH_FAMILY, DIMS,
  crownPathOcclusalTop, crownPathOcclusalBottom, rootPathDown, rootPathUp, canalPaths,
} from './tooth-geometry';
import { corDoRegistro, type OdontogramaEventoDraft } from '@/types/odontograma';
import { eventoPrincipalPorDente } from '@/lib/odontograma/evento-principal';

// ─── FDI tooth layout ────────────────────────────────────────────────────────
export const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// R-46b — exportadas pra o grid FDI leve do "+ dente" (meu-dia) reusar a mesma
// numeração, sem duplicar a lista à mão em outro arquivo.
export const TEETH_UPPER_DEC = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const TEETH_LOWER_DEC = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

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
export type ToothState = 'default' | 'historical' | 'shared' | 'selected';

/**
 * R-30 Parte 7 (contrato 3) — mesma regra que `Odontograma` usa pra pintar a arcada,
 * exportada pra quem precisa do estado de UM dente fora do grid (ex. `ToothDetailPanel`
 * ampliado). Existia só como função interna `getState`; duplicar a lógica em vez de
 * reusar foi o que deixou o dente ampliado sempre 'default', divergindo da arcada.
 */
export function computeToothState(
  tooth: number,
  args: { clinico: boolean; sharedTeeth: number[]; selectedTeeth: number[]; historicalTeeth: Set<number> },
): ToothState {
  if (args.clinico) return 'default'; // o visual clínico vem do resumo, não do state
  if (args.sharedTeeth.includes(tooth)) return 'shared';
  if (args.selectedTeeth.includes(tooth)) return 'selected';
  if (args.historicalTeeth.has(tooth)) return 'historical';
  return 'default';
}

/** Status de acompanhamento de tratamento (ficha unificada, #16 D3). */
export type ToothStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

// ─── v3: resumo clínico por dente (reduce dos eventos propostos/salvos) ──────
type CorClinica = 'coral' | 'teal' | 'slate' | 'warning';

const COR_TOKEN: Record<CorClinica, string> = {
  coral:   'var(--color-coral)',
  teal:    'var(--color-clinical-done)',
  slate:   'var(--color-slate)',
  warning: 'var(--color-warning)',
};

// Cor-de-texto calibrada AA (a cor cheia acima reprova mesmo sobre fundo neutro
// em light mode — teal 3.38:1, coral 2.99:1; achado auditoria UX 19/07).
const COR_TOKEN_INK: Record<CorClinica, string> = {
  coral:   'var(--color-coral-ink)',
  teal:    'var(--color-clinical-done-ink)',
  slate:   'var(--color-slate-ink)',
  warning: 'var(--color-warning-ink)',
};

/** Versão clara — tinge a RAIZ (canal/implante). Artefato usa o token -pale direto. */
const COR_PALE: Record<CorClinica, string> = {
  coral:   'var(--color-coral-pale)',
  teal:    'var(--color-clinical-done-pale)',
  slate:   'var(--color-slate-pale)',
  warning: 'var(--color-warning-pale)',
};

/**
 * Preenchimento da COROA por estado — valores do artefato (catálogo R-01): cárie usa o
 * token `-pale` e restauração feita usa mix 24% (antes era um mix 30% uniforme).
 *
 * DIVERGÊNCIA DELIBERADA no slate: o artefato pinta o pré-existente com slate SÓLIDO.
 * Medido no dark, isso dá 7,36:1 de contraste contra o fundo — contra 1,27:1 do coral
 * (pendência). Na arcada cheia o "já estava assim" viraria o elemento mais chamativo da
 * tela, invertendo a hierarquia que o próprio componente declara (coral > teal > slate:
 * "a pendência é o que não pode sumir da vista"). O catálogo não expõe isso porque cada
 * símbolo vive sozinho num card. Fica no `-pale`; quem identifica "antigo" é a TEXTURA
 * pontilhada + o contorno slate, que são fiéis ao artefato.
 */
const CROWN_FILL: Record<CorClinica, string> = {
  coral:   'var(--color-coral-pale)',
  teal:    'color-mix(in srgb, var(--color-clinical-done) 24%, var(--color-surface-alt))',
  slate:   'var(--color-slate-pale)',
  warning: 'var(--color-warning-pale)',
};

/** Status falado — cor sozinha não comunica estado clínico (achado auditoria
 * UX 19/07, HIGH #5: aria-label/aria-pressed nunca refletiam a cor da boca). */
const STATUS_CLINICO_LABEL: Record<CorClinica, string> = {
  coral:   'a fazer',
  teal:    'feito aqui',
  slate:   'pré-existente',
  warning: 'próxima sessão',
};

/**
 * GEOMETRIA DOS SÍMBOLOS — portada do artefato canônico (27/07).
 * Fonte: `plans/_arquivo/artefatos/R-01-ficha-registro.html` (catálogo) e
 * `R-02-simbolos-odontograma.html`, lidos por HTTP + extração JS (skill artefato-visual).
 *
 * O artefato desenha em viewBox 96×152 — coroa y=8→64 (crownH 56), raiz y=64→150
 * (rootH 86), cx=48. Nossos dentes têm dimensão por classe (w 24–51), então o que se
 * porta são as FRAÇÕES, nunca as coordenadas absolutas (aprendizado 22/07: portar o
 * algoritmo, não aproximar no olho). Cada número abaixo tem a medida-fonte ao lado.
 */
const G = {
  // Implante — parafuso: M39,63 L57,63 L51.8,131 Q48,145 44.2,131 Z
  // Revisão 10/08 (R-99) — era 9/96: no 1º molar (dente mais comum) o corpo ficava só
  // 10% mais largo que o pino, quase indistinguível (medido, plans/specs/R-99 §7).
  // Taper/roscas/plataforma não mudam — a plataforma já escala via Math.max(hwC*1.45,…)
  // logo abaixo, então o corpo mais largo puxa ela junto sem tocar impPlacaHw.
  impHwColo:    12.5 / 96,     // meia-largura no colo
  impHwRatio:   3.8 / 9,       // afunilamento: meia-largura no fim do corpo / no colo
  impCorpo:     (131 - 64) / 86, // corpo termina a esta fração da raiz
  impPonta:     (145 - 64) / 86, // vértice do Q (ponta apical)
  impRoscas:    [0.206, 0.412, 0.618, 0.824], // t ao longo do CORPO (y=77,91,105,119)
  impPlacaHw:   13 / 96,       // rect x=35 w=26 → meia-largura da plataforma
  impPlacaH:    8 / 96,        // altura da plataforma (fração de w)
  impPlacaGap:  3 / 56,        // folga entre a plataforma (y=61) e o colo (y=64)
  // Pino/núcleo — haste M48,64 L48,128 + núcleo M42,50 L54,50 L48,66 Z
  pinoHaste:    (128 - 64) / 86,
  pinoHb:       6 / 96,        // meia-base do triângulo
  pinoBase:     14 / 56,       // base do triângulo acima do colo (fração da coroa)
  // Lesão periapical — circle cy=141 r=7 stroke 2.2
  lesaoCy:      (141 - 64) / 86,
  lesaoR:       7 / 96,
  // As frações de coroa abaixo são medidas da BORDA OCLUSAL (0) até o colo (1):
  // (y_artefato − 8) / 56, já que a coroa vive entre y=8 e y=64 no viewBox de origem.
  // Extração indicada — M24,96 L72,140 dentro do g invertido → cobre a coroa; stroke 3.4
  xoX1:         24 / 96,
  xoX2:         72 / 96,
  xoY1:         (12 - 8) / 56,
  xoY2:         (56 - 8) / 56,
  // Selante — circle cy=30 r=6 (DENTRO da coroa, não colado na borda)
  selR:         6 / 96,
  selY:         (30 - 8) / 56,
  // Coroa protética — 3 diagonais no clip da coroa. O ÂNGULO é portado (não as frações
  // de x/y separadas): o dente do artefato tem proporção 1,71 (larg/coroa) e os nossos
  // 0,73–1,13, então fração independente entortaria a hachura pra ~70° (medido). Início
  // das linhas no colo, espaçadas 16,5/96 da largura; o clip corta o excedente.
  coroaHachAng:  55.7 * Math.PI / 180,  // (16,60)→(46,16)
  coroaHachX0:   16 / 96,
  coroaHachGap:  16.5 / 96,
  // Fratura — M32,14 L46,28 L36,38 L52,52 stroke 2.6
  fratura: [
    [32 / 96, (14 - 8) / 56], [46 / 96, (28 - 8) / 56],
    [36 / 96, (38 - 8) / 56], [52 / 96, (52 - 8) / 56],
  ],
} as const;

export interface ResumoDente {
  cor: CorClinica | null;       // dominante: coral (a fazer) > teal (feito aqui) > slate (pré-existente)
  ausente: boolean;             // exodontia realizada / esfoliação
  /** R-06: ausência por esfoliação (decíduo caiu) — render distinto da extração (D4). */
  esfoliado: boolean;
  exodontiaIndicada: boolean;
  incluso: boolean;
  canal: CorClinica | null;
  lesao: boolean;
  implante: CorClinica | null;
  coroa: CorClinica | null;
  pino: CorClinica | null;
  selante: CorClinica | null;
  fratura: boolean;
  /** R-06: dente faz parte de ponte — cor + papel + grupo (a linha MINSA deriva daqui, D3/I1). */
  ponte: CorClinica | null;
  pontePapel: 'pilar' | 'pontico' | null;
  ponteGrupo: string | null;
  /** R-61 — este dente tem evento no rascunho DESTA sessão (`eventos`, não
   *  `eventosPersistidos`). Marca aditiva (ponto), independente da cor dominante. */
  mexido: boolean;
}

const RESUMO_VAZIO: ResumoDente = {
  cor: null, ausente: false, esfoliado: false, exodontiaIndicada: false, incluso: false,
  canal: null, lesao: false, implante: null, coroa: null, pino: null,
  selante: null, fratura: false, ponte: null, pontePapel: null, ponteGrupo: null, mexido: false,
};

/** coral vence warning, que vence teal, que vence slate (a pendência é o que não pode
 * sumir da vista — R-101: "próxima seção" ainda é pendência, só menos urgente que "agora"). */
function corDominante(a: CorClinica | null, b: CorClinica): CorClinica {
  if (a === 'coral' || b === 'coral') return 'coral';
  if (a === 'warning' || b === 'warning') return 'warning';
  if (a === 'teal' || b === 'teal') return 'teal';
  return 'slate';
}

/**
 * R-61 — `eventos` (rascunho editável) + `eventosPersistidos` (leitura, estado real da
 * boca) pintam JUNTOS. Dedup por `id`: rascunho vence (§4.3 da spec) — "fazer hoje →" reusa
 * o id real do evento persistido, então sem isso o dente pintaria 2× e a cor dominante
 * mentiria (coral do persistido venceria o teal do rascunho, já que `corDominante` prioriza
 * coral). `mexido` é calculado à parte, por DENTE (não por id): um dente pode ganhar um
 * evento novo (id nunca visto) enquanto ainda carrega um evento persistido antigo — os dois
 * contribuem pra cor, só o novo acende o ponto.
 */
export function buildResumos(
  eventos: OdontogramaEventoDraft[],
  eventosPersistidos: OdontogramaEventoDraft[] = [],
): Map<number, ResumoDente> {
  const porId = new Map<string, OdontogramaEventoDraft>();
  for (const ev of eventosPersistidos) porId.set(ev.id, ev);
  for (const ev of eventos) porId.set(ev.id, ev);

  const mexidos = new Set(
    eventos.map((ev) => ev.ancora.dente).filter((d): d is number => d != null),
  );
  const principais = eventoPrincipalPorDente(eventos, eventosPersistidos);

  const map = new Map<number, ResumoDente>();
  for (const ev of porId.values()) {
    const dente = ev.ancora.dente;
    if (dente == null) continue; // âncoras de arcada/quadrante não pintam dente individual
    const r = map.get(dente) ?? { ...RESUMO_VAZIO };
    const cor = corDoRegistro(ev.status, ev.origem, ev.momento_planejado);
    r.cor = corDominante(r.cor, cor);
    switch (ev.tipo) {
      case 'exodontia':
        if (ev.status === 'realizado') r.ausente = true;
        else r.exodontiaIndicada = true;
        break;
      case 'esfoliacao':
        if (ev.status === 'realizado') { r.ausente = true; r.esfoliado = true; }
        break;
      case 'inclusao':          r.incluso = true; break;
      case 'endodontia':        r.canal = corDominante(r.canal, cor); break;
      case 'lesao_periapical':  r.lesao = true; break;
      case 'implante':          r.implante = corDominante(r.implante, cor); break;
      case 'coroa':             r.coroa = corDominante(r.coroa, cor); break;
      case 'pino_nucleo':       r.pino = corDominante(r.pino, cor); break;
      case 'selante':           r.selante = corDominante(r.selante, cor); break;
      case 'fratura':           r.fratura = true; break;
      case 'ponte':
        // R-06: a linha MINSA deriva do grupo em render-time (D3/I1) — aqui só o resumo.
        r.ponte = corDominante(r.ponte, cor);
        r.pontePapel = ev.papel_no_grupo;
        r.ponteGrupo = ev.grupo_id;
        break;
      case 'carie_restauracao':
        break; // contribui só pra cor dominante
      default:
        break; // rotina (boca/quadrante) nunca chega aqui — sem dente âncora (D5)
    }
    map.set(dente, r);
  }
  // R-127 — ausência é um estado estrutural exclusivo. Só uma intervenção JÁ realizada
  // posterior pode devolver o desenho normal do dente. Uma indicação de implante ainda
  // depende justamente de o dente permanecer ausente; não pode apagar esse estado visual.
  for (const [dente, principal] of principais) {
    const r = map.get(dente);
    if (!r) continue;
    if (principal.status !== 'realizado') continue;

    const confirmaAusencia = principal.tipo === 'exodontia' || principal.tipo === 'esfoliacao';
    r.ausente = confirmaAusencia;
    r.esfoliado = confirmaAusencia && principal.tipo === 'esfoliacao';
  }
  for (const dente of mexidos) {
    const r = map.get(dente);
    if (r) r.mexido = true;
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
  /** v3: resumo clínico do dente — quando presente, dirige o visual (cores/marcas do catálogo). */
  resumo?: ResumoDente | null;
  /** R-06: continuidade da linha da ponte com os vizinhos DO MESMO grupo + altura comum da
   *  linha (menor totalH do grupo, da borda oclusal). Calculado pelo renderArch, que conhece
   *  a ordem e as classes do arco — o ToothSVG só desenha o seu segmento. */
  ponteLinks?: { left: boolean; right: boolean; altura: number } | null;
  /** C5 (P13) — anel de seleção, INDEPENDENTE de `state`/`clinico`. Antes, dente com resumo
   *  clínico (`clinico = resumo != null`) sempre caía em `computeToothState → 'default'` e
   *  nunca mostrava contorno de seleção — `selectedTeeth` era ignorado nesse caso. Correção
   *  aditiva: desenhado por fora, em camada própria, sem tocar crownFill/crownStroke/strokeW. */
  selecionado?: boolean;
}

/** R-06 (D3, norma MINSA RM-559-2022): segmento da ponte na altura dos ápices + traço
 *  vertical no pilar. Duas sutilezas de geometria (vistas no harness 27/07):
 *  1. O y é ancorado na borda OCLUSAL (a borda alinhada do arco) via `links.altura` — o
 *     menor totalH do grupo. Ancorar no topo de cada svg (apexY) quebrava a linha em
 *     degraus, porque cada classe de dente tem altura própria (62–93px).
 *  2. Segmento estende ±6px quando o vizinho é do mesmo grupo (overflow visible cobre o
 *     gap do arco; sobreposição de mesma cor sólida é invisível). Pilar de extremo para
 *     dentro do dente. */
function PonteMarks({ resumo, links, w, totalH, isUpper }: {
  resumo: ResumoDente;
  links: { left: boolean; right: boolean; altura: number } | null;
  w: number; totalH: number; isUpper: boolean;
}) {
  if (!resumo.ponte) return null;
  const c = COR_TOKEN[resumo.ponte];
  const x1 = links?.left ? -6 : w * 0.18;
  const x2 = links?.right ? w + 6 : w * 0.82;
  // Sem links (dente isolado, ex. painel de detalhe): ápice do próprio dente.
  const y = links ? (isUpper ? totalH - links.altura : links.altura) : (isUpper ? 5 : totalH - 5);
  const tickDir = isUpper ? 1 : -1; // da linha em direção à coroa
  return (
    <g style={{ stroke: c, strokeWidth: 2, strokeLinecap: 'round' }} aria-hidden="true">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      {resumo.pontePapel === 'pilar' && (
        <line x1={w / 2} y1={y} x2={w / 2} y2={y + tickDir * 7} />
      )}
    </g>
  );
}

/** C5 — anel aditivo, desenhado por fora da geometria do dente (o `<svg>` já tem
 *  `overflow:visible`). Independente de `clinico`/`state` de propósito: é a única forma de
 *  mostrar seleção num dente com resumo clínico, que sempre computa `state === 'default'`. */
function SelecaoRing({ w, totalH }: { w: number; totalH: number }) {
  return (
    <rect
      x={-2.5} y={-2.5} width={w + 5} height={totalH + 5} rx={4}
      style={{ fill: 'none', stroke: 'var(--color-teal)', strokeWidth: 2, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}

export function ToothSVG({ num, isUpper, state, hovered, showCheckbox, resumo = null, ponteLinks = null, selecionado = false }: ToothSVGProps) {
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

  // Geometria das marcas do catálogo v3 — orientação-agnóstica. As antigas âncoras de
  // offset fixo (crownTop/crownBot/apexY/occluY, margens de 5–8px) saíram na portagem do
  // artefato 27/07: tudo ancora por FRAÇÃO da coroa/raiz, que é o que escala entre as
  // classes de dente (w 24–51) sem deformar o símbolo.
  const cx       = w / 2;
  const coloY    = isUpper ? rootH : crownH;   // junção coroa-raiz (cervical) — base do implante/pino
  const dir      = isUpper ? -1 : 1;           // sentido colo → ápice (== sentido oclusal → colo)
  // Âncora das marcas de COROA: borda oclusal (f=0) → colo (f=1), pelas frações de G.
  const oclEdge  = isUpper ? totalH : 0;
  const naCoroa  = (f: number) => oclEdge + dir * f * crownH;

  const isActive = state === 'selected' || state === 'shared';

  // ── v3: dente AUSENTE — só o contorno tracejado ("vaga" na arcada) ──
  if (resumo?.ausente) {
    // R-06: seta da erupção do permanente (esfoliação) — aponta pra oclusal.
    const setaY1 = isUpper ? totalH * 0.30 : totalH * 0.70;
    const setaY2 = isUpper ? totalH * 0.62 : totalH * 0.38;
    const ah = isUpper ? -4 : 4; // recuo da ponta da seta
    return (
      <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{ display: 'block', overflow: 'visible' }}>
        {/* Contorno tracejado unico (1 token so) — fiel ao artefato (R-01-ficha-registro.html,
            catalogo "Extraido": silhueta unica, nao duas com cores diferentes). */}
        <path d={rootPath} style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.2, strokeDasharray: '3 3', opacity: 0.8 }} />
        <path d={crownPath} style={{ fill: 'none', stroke: 'var(--color-text-muted)', strokeWidth: 1.2, strokeDasharray: '3 3', opacity: 0.8 }} />
        {/* R-06 (D4): esfoliado ≠ extraído — seta do permanente irrompendo (convenção EX) */}
        {resumo.esfoliado && (
          <g style={{ stroke: 'var(--color-text-muted)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }} aria-hidden="true">
            <line x1={w / 2} y1={setaY1} x2={w / 2} y2={setaY2} />
            <polyline points={`${w / 2 - 3.2},${setaY2 + ah} ${w / 2},${setaY2} ${w / 2 + 3.2},${setaY2 + ah}`} />
          </g>
        )}
        {/* R-06: pôntico costuma viver sobre dente ausente — a linha da ponte continua aqui */}
        <PonteMarks resumo={resumo} links={ponteLinks} w={w} totalH={totalH} isUpper={isUpper} />
        {selecionado && <SelecaoRing w={w} totalH={totalH} />}
      </svg>
    );
  }

  const clinico = resumo != null;
  // Pino NÃO entra aqui (revisao 25/07): o artefato R-02-simbolos-odontograma.html mostra a raiz
  // NEUTRA no pino — a marca é só a haste+núcleo, não um preenchimento da raiz (era o "pega o
  // dente inteiro" que o Mateus apontou). Implante e canal tingem a raiz de propósito.
  const rootTint = resumo?.implante ?? resumo?.canal ?? null;

  // R-30 Parte 7 — cor de PREENCHIMENTO é exclusiva do estado clínico derivado de evento
  // (resumo.cor). 'selected'/'historical' nunca pintam com a paleta teal — um dente "citado
  // nesta ficha" ou "com registro em outra ficha" não é a mesma coisa que "procedimento
  // realizado", e pintar os dois iguais foi o bug relatado ("dente já azul ao editar", sem
  // nada marcado). Selecionado ganha CONTORNO sólido (sem preencher); histórico, contorno
  // tracejado neutro. 'shared' (grupo de notas compartilhadas na ficha) segue como estava —
  // fora do relato original, não mexido aqui.
  const crownFill = clinico
    ? (resumo.implante
        // Artefato: no implante a coroa é VAZADA (só contorno) e a raiz some — é isso que
        // deixa o parafuso e a plataforma legíveis, e diz "o dente não está aqui".
        ? 'transparent'
        : resumo.cor
        ? CROWN_FILL[resumo.cor]
        : 'var(--color-surface-alt)')
    : state === 'shared' ? 'color-mix(in srgb, var(--color-teal) 25%, var(--color-surface-alt))'
    : 'var(--color-surface-alt)';

  const crownStroke = clinico
    ? (hovered ? 'var(--color-teal)' : resumo.implante ? COR_TOKEN[resumo.implante] : resumo.incluso ? 'var(--color-text-secondary)' : resumo.cor ? COR_TOKEN[resumo.cor] : 'var(--color-border)')
    : hovered                  ? 'var(--color-teal)'
    : state === 'selected'   ? 'var(--color-teal)'
    : state === 'shared'     ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-border))'
    : state === 'historical' ? 'var(--color-text-secondary)'
    : 'var(--color-border)';

  const strokeW = state === 'selected' && !clinico ? 2 : (state === 'shared' || hovered) ? 1.5 : clinico && resumo.cor ? 1.4 : 1;

  const rootFill = clinico
    ? (rootTint ? COR_PALE[rootTint] : 'var(--color-surface-alt)')
    : hovered
    ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
    : 'var(--color-surface-alt)';

  const rootStroke = clinico && rootTint
    ? COR_TOKEN[rootTint]   // artefato usa a cor CHEIA no contorno da raiz tingida
    : hovered
    ? 'color-mix(in srgb, var(--color-teal) 35%, var(--color-border))'
    : 'var(--color-border)';

  const rootOpacity = clinico ? 0.8
    : state === 'selected' ? 0.40
    : state === 'shared' ? 0.58
    : 0.72;

  const cbX = w - 9;
  const cbY = 4;
  const isChecked = isActive;

  const needsDots = clinico && (resumo.cor === 'slate' || resumo.coroa === 'slate');
  const dotsId = `odx-dots-${num}`;
  const dash = (clinico && resumo.incluso) || (!clinico && state === 'historical') ? '4 3' : undefined;

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

      {/* v3: canal — vazio (contorno) = a tratar · preenchido = tratado. Mora na RAIZ, então
          entra logo depois dela e antes da coroa. Os canais são paths independentes (um por
          raiz) que NÃO se tocam, então o contorno não tem emenda a esconder. */}
      {clinico && resumo.canal && !resumo.implante &&
        canalPaths(num, isUpper).map((d, i) => (
          <path
            key={i}
            d={d}
            style={
              resumo.canal === 'coral'
                ? { fill: 'none', stroke: COR_TOKEN.coral, strokeWidth: 1.7, strokeLinejoin: 'round' }
                : { fill: COR_TOKEN[resumo.canal!], stroke: 'none' }
            }
          />
        ))}

      {/* v3: implante — PARAFUSO na raiz (corpo afunilado + roscas horizontais + plataforma).
          Revisao 24/07 (R-02): era capsula+curva e colidia com o pino; o parafuso e o simbolo
          clinico reconhecivel do implante (Open Dental: "implant = screw only"). Alargado p/
          leitura. Ref: plans/artefatos/R-02-simbolos-odontograma.html. */}
      {clinico && resumo.implante && (() => {
        const c = COR_TOKEN[resumo.implante];
        // Proporções exatas do artefato (G.imp*): corpo estreito que afunila, 4 roscas
        // no terço superior e plataforma no colo. Antes o corpo era ~1,7× mais largo
        // ("alargado p/ leitura", 24/07) e as roscas desciam até o ápice.
        // Piso de legibilidade: o catálogo desenha um dente de 96px, o odontograma
        // desenha 24–51px — a fração pura vira fio de cabelo num incisivo. Piso subiu
        // de 4 pra 5,6 junto com a fração (10/08, R-99) — mesma razão, mesmo lugar.
        const hwC = Math.max(5.6, w * G.impHwColo);
        const hwA = hwC * G.impHwRatio;
        const yAt  = (f: number) => coloY + dir * f * rootH;      // f = fração da raiz
        const yCorpo = yAt(G.impCorpo);
        const hwAt = (t: number) => hwC - (hwC - hwA) * t;        // t = fração do corpo
        // Revisão 27/07 — rosca com PERFIL EM V (dente de serra) no contorno do corpo, em
        // vez de linhas horizontais atravessando: é assim que a rosca aparece num implante
        // real e no raio-x. O corpo é traçado seguindo o serrilhado dos dois lados.
        const nR = G.impRoscas.length;
        const ladoDireito: string[] = [];
        const ladoEsquerdo: string[] = [];
        for (let i = 0; i <= nR; i++) {
          const t0 = i / (nR + 1);
          const t1 = (i + 0.5) / (nR + 1);
          const y0 = coloY + dir * t0 * G.impCorpo * rootH;
          const y1 = coloY + dir * t1 * G.impCorpo * rootH;
          ladoDireito.push(`L ${cx + hwAt(t0)},${y0} L ${cx + hwAt(t1) * 0.62},${y1}`);
          ladoEsquerdo.unshift(`L ${cx - hwAt(t1) * 0.62},${y1} L ${cx - hwAt(t0)},${y0}`);
        }
        return (
          <g style={{ fill: 'none', stroke: c, strokeWidth: 1.7, strokeLinejoin: 'round', strokeLinecap: 'round' }}>
            <path
              d={
                `M ${cx - hwC},${coloY} L ${cx + hwC},${coloY} ` +
                ladoDireito.join(' ') +
                ` L ${cx + hwA},${yCorpo} Q ${cx},${yAt(G.impPonta)} ${cx - hwA},${yCorpo} ` +
                ladoEsquerdo.join(' ') +
                ' Z'
              }
            />
            {(() => {
              // Plataforma dentro da coroa, adjacente ao colo (artefato: y 53→61, colo 64).
              const h = Math.max(3.4, w * G.impPlacaH);
              const hw = Math.max(hwC * 1.45, w * G.impPlacaHw);
              const gap = crownH * G.impPlacaGap;
              return (
                <rect
                  x={cx - hw}
                  y={isUpper ? coloY + gap : coloY - gap - h}
                  width={hw * 2}
                  height={h}
                  rx={2}
                  style={{ fill: c, stroke: 'none' }}
                />
              );
            })()}
          </g>
        );
      })()}

      {/* v3: lesão periapical — radiolucência no ápice. Revisão 27/07: elipse levemente
          irregular (como a lesão aparece no periapical) em vez de círculo geométrico
          perfeito; mantém posição/raio/stroke do artefato. */}
      {clinico && resumo.lesao && (() => {
        // Piso de 4.6: o artefato desenha num dente 2–3× maior; com r=3 e stroke 2.2 o
        // miolo fecha e a lesão vira um ponto (visto no harness 27/07).
        const r  = Math.max(5.2, w * G.lesaoR);
        const cyL = coloY + dir * G.lesaoCy * rootH;
        return (
          <path
            d={
              `M ${cx},${cyL - r * 1.04} ` +
              `C ${cx + r * 0.98},${cyL - r * 0.92} ${cx + r * 1.06},${cyL + r * 0.62} ${cx + r * 0.12},${cyL + r * 1.02} ` +
              `C ${cx - r * 0.78},${cyL + r * 1.06} ${cx - r * 1.08},${cyL + r * 0.18} ${cx - r * 0.86},${cyL - r * 0.52} ` +
              `C ${cx - r * 0.7},${cyL - r * 0.95} ${cx - r * 0.3},${cyL - r * 1.06} ${cx},${cyL - r * 1.04} Z`
            }
            style={{ fill: 'none', stroke: 'var(--color-coral)', strokeWidth: 2.2, strokeLinejoin: 'round' }}
          />
        );
      })()}

      {/* Crown */}
      <path
        d={crownPath}
        style={{
          fill: crownFill,
          stroke: crownStroke,
          strokeWidth: strokeW,
          strokeDasharray: dash,
          transition: 'fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease',
        }}
      />

      {/* v3: textura pontilhada do pré-existente (reforço não-só-cor) */}
      {needsDots && (
        <path d={crownPath} style={{ fill: `url(#${dotsId})`, opacity: 0.5, pointerEvents: 'none' }} />
      )}


      {/* v3: pino/núcleo — HASTE no canal + NÚCLEO triangular no colo. Desenhado DEPOIS da coroa
          (revisao 25/07): o núcleo fica no colo/coroa e era COBERTO pelo fill do crownPath (pintado
          acima) — por isso "sumia". Proporções portadas do artefato R-02-simbolos-odontograma.html
          (base ~0.17·largura no terço cervical, haste ~0.78·raiz). "Nunca rosca horizontal — isso
          vira implante." */}
      {clinico && resumo.pino && !resumo.implante && (() => {
        const c = COR_TOKEN[resumo.pino];
        // Revisão 27/07 — peça protética real no lugar de "haste + triângulo": o NÚCLEO é
        // a porção coronária que reconstrói o dente (trapézio com ombro cervical, mais
        // largo na base e afunilando pra oclusal), e o PINO é o corpo cônico cimentado
        // dentro do canal, com ponta arredondada. Uma peça só, contínua.
        const hbBase = Math.max(2.8, w * 0.085);        // meia-largura no colo (ombro)
        const hbTopo = hbBase * 0.52;                    // meia-largura no topo do núcleo
        const yTopo  = coloY - dir * crownH * G.pinoBase;
        const yPonta = coloY + dir * rootH * G.pinoHaste;
        const hbPino = Math.max(1.5, hbBase * 0.42);     // meia-largura do pino no colo
        return (
          <path
            d={
              `M ${cx - hbTopo},${yTopo} L ${cx + hbTopo},${yTopo} ` +          // topo do núcleo
              `L ${cx + hbBase},${coloY - dir * crownH * 0.06} ` +               // ombro cervical
              `L ${cx + hbPino},${coloY + dir * rootH * 0.06} ` +                // entrada do canal
              `C ${cx + hbPino * 0.9},${yPonta - dir * rootH * 0.22} ${cx + hbPino * 0.7},${yPonta - dir * rootH * 0.06} ${cx},${yPonta} ` +
              `C ${cx - hbPino * 0.7},${yPonta - dir * rootH * 0.06} ${cx - hbPino * 0.9},${yPonta - dir * rootH * 0.22} ${cx - hbPino},${coloY + dir * rootH * 0.06} ` +
              `L ${cx - hbBase},${coloY - dir * crownH * 0.06} Z`
            }
            style={{ fill: c, stroke: 'none' }}
          />
        );
      })()}

      {/* v3: coroa total — CAPA com hachura diagonal sobre a coroa (raiz intocada). Revisao
          24/07 (R-02): era so contorno duplo, sem identidade; a hachura e a convencao de coroa
          (DALE/Bird&Robinson). Ref: R-02-simbolos-odontograma.html. */}
      {clinico && resumo.coroa && (
        <>
          <defs>
            <clipPath id={`odx-crown-${num}`}><path d={crownPath} /></clipPath>
          </defs>
          <path d={crownPath} style={{ fill: 'none', stroke: COR_TOKEN[resumo.coroa], strokeWidth: 2.4 }} />
          {/* Hachura: 3 diagonais nas posições do artefato (a 3ª ia até 1.04·w — fora do dente). */}
          <g clipPath={`url(#odx-crown-${num})`} style={{ stroke: COR_TOKEN[resumo.coroa], strokeWidth: 2, strokeLinecap: 'round' }}>
            {[0, 1, 2].map((i) => {
              const x1 = w * (G.coroaHachX0 + i * G.coroaHachGap);
              const L  = crownH * 1.5; // generoso: o clipPath da coroa corta o excedente
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={naCoroa(1)}
                  x2={x1 + L * Math.cos(G.coroaHachAng)}
                  y2={naCoroa(1) - dir * L * Math.sin(G.coroaHachAng)}
                />
              );
            })}
            {/* Margem cervical — o término da capa protética sobre o preparo. É o traço
                que faz a coroa ler como PEÇA cimentada, não como dente pintado (27/07). */}
            <line
              x1={0} y1={naCoroa(0.93)} x2={w} y2={naCoroa(0.93)}
              style={{ strokeWidth: 2.6 }}
            />
          </g>
        </>
      )}

      {/* v3: selante — revisão 27/07: o selante veda os SULCOS oclusais, então segue o
          sulco (molar: sulco central + ramos = Y deitado; demais: sulco único), em vez
          de um ponto solto no meio da coroa. */}
      {clinico && resumo.selante && (() => {
        const c  = COR_TOKEN[resumo.selante];
        const y  = naCoroa(G.selY);
        const sw = Math.max(2.2, w * G.selR * 0.78);
        const hx = w * (family === 'molar' ? 0.20 : 0.15);
        return (
          <g style={{ fill: 'none', stroke: c, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d={`M ${cx - hx},${y} L ${cx + hx},${y}`} />
            {family === 'molar' && (
              <path d={`M ${cx},${y} L ${cx},${y - dir * crownH * 0.13} M ${cx},${y} L ${cx},${y + dir * crownH * 0.10}`} />
            )}
          </g>
        );
      })()}

      {/* v3: fratura — revisão 27/07: traço com ramificação e ponta fina (a trinca se
          espalha e afina), no lugar do zigue-zague uniforme. Traçado-base do artefato. */}
      {clinico && resumo.fratura && (() => {
        const pts = G.fratura.map(([fx, fy]) => [w * fx, naCoroa(fy)] as const);
        const principal = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
        const [rx, ry] = pts[2];
        return (
          <g style={{ fill: 'none', stroke: 'var(--color-coral)', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d={principal} style={{ strokeWidth: 2.6 }} />
            <path d={`M ${rx},${ry} L ${rx - w * 0.14},${ry + dir * crownH * 0.16}`} style={{ strokeWidth: 1.5 }} />
          </g>
        );
      })()}

      {/* v3: extração indicada — X sobre a coroa (artefato: 0.25→0.75·w, stroke 3.4) */}
      {clinico && resumo.exodontiaIndicada && (
        <g style={{ stroke: 'var(--color-coral)', strokeWidth: 3.4, strokeLinecap: 'round' }}>
          <line x1={w * G.xoX1} y1={naCoroa(G.xoY1)} x2={w * G.xoX2} y2={naCoroa(G.xoY2)} />
          <line x1={w * G.xoX2} y1={naCoroa(G.xoY1)} x2={w * G.xoX1} y2={naCoroa(G.xoY2)} />
        </g>
      )}

      {/* R-06: segmento da ponte (linha nos ápices + traço do pilar) — deriva do grupo (D3/I1) */}
      {clinico && <PonteMarks resumo={resumo} links={ponteLinks} w={w} totalH={totalH} isUpper={isUpper} />}

      {selecionado && <SelecaoRing w={w} totalH={totalH} />}

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
  /** Grade responsiva usada apenas pelo Meu Dia. */
  layout?: 'colunas';
  /** R-78 F0 — sobrescreve o zoom implícito de `compact` (0.85). O espelho (~555px, achado
   *  A1 da spec) precisa de 0.68: a arcada real (739px em largura de conteúdo) transborda o
   *  card a 0.85 (628px) — 0.68 é conta, não escolha estética. Sem isto, `compact` sozinho
   *  continua valendo 0.85 (piso de toque do R-63 F3/G17), comportamento intacto. */
  zoom?: number;
  hideFilters?: boolean;
  /**
   * v3 — camada clínica: eventos de odontograma (propostos ou salvos). Quando presente,
   * o componente vira o "mapa pintado": cor dominante por dente + marcas do catálogo
   * (canal, implante, coroa, X, ausente…). Ignora selection.
   */
  eventos?: OdontogramaEventoDraft[];
  /**
   * R-61 — camada de LEITURA: estado persistido da boca (banco), pinta JUNTO com `eventos`
   * mas nunca chega ao `ToothDetailPanel` — não é editável a partir daqui. Dente com evento
   * só aqui é lido (clique abre o painel sem oferecer edição daquele evento); dente com
   * evento em `eventos` (mesmo id ou não) ganha o ponto de "mexido nesta sessão" (§2.4/§4.2
   * da spec R-61).
   */
  eventosPersistidos?: OdontogramaEventoDraft[];
  /**
   * R-98a — modo apresentação (paciente vendo a tela). Esconde chrome de EDIÇÃO que não
   * pode aparecer pro paciente: abas Permanentes/Decíduos, botão Legenda, a linha "Toque
   * um dente para ver e editar o detalhe". NUNCA esconde numeração FDI nem rótulos
   * SUP./INF. — orientação anatômica não é chrome de edição. Default false.
   */
  presentationMode?: boolean;
}

export function Odontograma({
  selectedTeeth,
  sharedTeeth = [],
  historicalTeeth = new Set(),
  onToothToggle,
  showCheckbox = false,
  className,
  compact = false,
  layout,
  zoom,
  hideFilters = false,
  eventos,
  eventosPersistidos,
  presentationMode = false,
}: OdontogramaProps) {
  const [hoveredTooth, setHoveredTooth]   = useState<number | null>(null);
  const [tab, setTab]                     = useState<'permanent' | 'deciduous'>('permanent');
  const [viewFilter, setViewFilter]       = useState<ViewFilter>('all');
  const [activeFilterId, setActiveFilterId] = useState<string>('arcadas');
  const [legendOpen, setLegendOpen]       = useState(false);

  const colunas = layout === 'colunas';
  const clinico = eventos != null || eventosPersistidos != null;
  const resumos = useMemo(
    () => buildResumos(eventos ?? [], eventosPersistidos ?? []),
    [eventos, eventosPersistidos],
  );

  const upperTeeth = tab === 'permanent' ? TEETH_UPPER : TEETH_UPPER_DEC;
  const lowerTeeth = tab === 'permanent' ? TEETH_LOWER : TEETH_LOWER_DEC;

  // Contagem de dentes ativos por dentição — indicador nas abas (torna decíduo detectado descobrível)
  const activeTeeth = clinico
    ? Array.from(resumos.keys())
    : selectedTeeth;
  const tabCounts: Record<'permanent' | 'deciduous', number> = {
    permanent: activeTeeth.filter(t => TEETH_UPPER.includes(t) || TEETH_LOWER.includes(t)).length,
    deciduous: activeTeeth.filter(t => TEETH_UPPER_DEC.includes(t) || TEETH_LOWER_DEC.includes(t)).length,
  };

  function getState(tooth: number): ToothState {
    return computeToothState(tooth, { clinico, sharedTeeth, selectedTeeth, historicalTeeth });
  }

  function renderArch(teeth: number[], isUpper: boolean) {
    return teeth.map((num) => {
      const isMidlineStart = num === 21 || num === 31 || num === 61 || num === 71;
      const state  = getState(num);
      const resumo = clinico ? resumos.get(num) ?? null : null;
      const isHov  = hoveredTooth === num;
      const isActive = state === 'selected' || state === 'shared';
      const numWeight = (state === 'selected' || state === 'shared' || resumo?.cor) ? 800 : 700;

      const numColor = resumo?.cor
        ? COR_TOKEN[resumo.cor]
        : state === 'selected'    ? 'var(--color-teal)'
        : state === 'shared'    ? 'var(--color-teal)'
        : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-text-secondary))'
        : isHov                 ? 'var(--color-text-primary)'
        : 'var(--color-text-secondary)';

      // R-06: continuidade da linha da ponte — vizinho do arco no MESMO grupo estende o
      // segmento pra cobrir o gap, e `altura` (menor totalH do grupo, medido da borda
      // oclusal alinhada) mantém a linha RETA entre classes de dente de alturas diferentes.
      const ponteLinks = clinico && resumo?.ponte && resumo.ponteGrupo != null
        ? (() => {
            const idx = teeth.indexOf(num);
            const mesmoGrupo = (n: number | undefined) =>
              n != null && resumos.get(n)?.ponteGrupo === resumo.ponteGrupo;
            const doGrupo = teeth.filter((t) => resumos.get(t)?.ponteGrupo === resumo.ponteGrupo);
            const altura = Math.min(
              ...doGrupo.map((t) => {
                const d = DIMS[TOOTH_CLASS[t] ?? 'premolar'];
                return d.crownH + d.rootH;
              }),
            ) - 2;
            return { left: mesmoGrupo(teeth[idx - 1]), right: mesmoGrupo(teeth[idx + 1]), altura };
          })()
        : null;

      return (
        <Fragment key={num}>
          {colunas && (num === teeth[0] || isMidlineStart) && (
            <span className="col-span-full hidden text-[11px] text-text-secondary max-[600px]:block">
              {isMidlineStart ? 'Esquerdo' : 'Direito'}
            </span>
          )}
          {!colunas && isMidlineStart && (
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
            onFocus={() => setHoveredTooth(num)}
            onBlur={() => setHoveredTooth(null)}
            className={cn(
              'relative flex flex-col items-center outline-none focus-visible:ring-1 focus-visible:ring-teal',
              colunas
                ? 'min-w-0 w-full rounded-[4px] py-[3px] [&>svg]:h-[38px] [&>svg]:w-[22px] [&>svg]:max-w-full'
                : 'rounded-sm',
              colunas && selectedTeeth.includes(num) && 'bg-teal-pale text-teal-ink',
              isUpper ? 'justify-end' : 'justify-start',
              isActive || isHov ? 'z-10' : 'z-0',
            )}
            style={{
              transform: colunas ? undefined : isHov ? 'scale(1.10)' : isActive ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.13s ease',
              gap: colunas ? 3 : 5,
            }}
            aria-label={`Dente ${num} — ${TOOTH_NAMES[num] ?? ''}${resumo?.cor ? `, ${STATUS_CLINICO_LABEL[resumo.cor]}` : ''}${resumo?.mexido ? ', alterado nesta consulta' : ''}`}
            aria-pressed={colunas ? selectedTeeth.includes(num) : clinico ? undefined : isActive}
          >
            {/* R-61 — ponto no canto: dente tem evento no rascunho desta sessão (não
                confundir com o anel de seleção, que é stroke DENTRO do dente). Cor sozinha
                não comunica (auditoria UX 19/07) — por isso também entra no aria-label acima. */}
            {resumo?.mexido && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--color-teal)',
                  border: '1.5px solid var(--color-surface)',
                  zIndex: 1,
                }}
              />
            )}

            {isUpper && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: colunas ? 'inherit' : 'ui-monospace, SFMono-Regular, monospace',
                  fontWeight: colunas ? selectedTeeth.includes(num) ? 700 : 400 : numWeight,
                  color: colunas && selectedTeeth.includes(num) ? 'var(--color-teal-ink)' : numColor,
                  lineHeight: colunas ? 1.6 : 1,
                  letterSpacing: colunas ? undefined : '-0.3px',
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
              resumo={resumo}
              ponteLinks={ponteLinks}
              selecionado={selectedTeeth.includes(num)}
            />

            {!isUpper && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: colunas ? 'inherit' : 'ui-monospace, SFMono-Regular, monospace',
                  fontWeight: colunas ? selectedTeeth.includes(num) ? 700 : 400 : numWeight,
                  color: colunas && selectedTeeth.includes(num) ? 'var(--color-teal-ink)' : numColor,
                  lineHeight: colunas ? 1.6 : 1,
                  letterSpacing: colunas ? undefined : '-0.3px',
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
          // R-30 Parte 7 — sem preenchimento teal: histórico não é procedimento realizado.
          fill: 'var(--color-surface-alt)',
          stroke: 'var(--color-text-secondary)', strokeW: 1.2, filter: 'none',
          label: 'Histórico', desc: 'Citado em outro registro — contorno tracejado, não preenche',
        },
        {
          // R-30 Parte 7 — idem: selecionado é contorno, nunca preenchimento sólido (era
          // visualmente idêntico a "realizado", origem do relato "dente já azul ao editar").
          fill: 'var(--color-surface-alt)',
          stroke: 'var(--color-teal)', strokeW: 2, filter: 'none',
          label: 'Selecionado', desc: 'Selecionado nesta ficha — ainda não é procedimento confirmado',
        },
      ];

  return (
    <div
      className={cn(colunas ? 'flex min-w-0 flex-col select-none' : 'flex flex-col gap-3 select-none', className)}
      data-layout={layout}
      // 0.82 deixava o incisivo lateral com ~23.8px de alvo de toque, abaixo do
      // piso de 24px (achado auditoria UX 19/07, MEDIUM #6) — usado no Modo
      // Consulta chairside, onde errar o dente vizinho é um risco real. 0.85
      // garante >=24.6px no menor dente sem descaracterizar o modo compacto.
      style={compact ? { zoom: zoom ?? 0.85 } : undefined}
    >

      {/* ── Tab bar + Legenda — chrome de edição, some em presentationMode ── */}
      {!presentationMode && (
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
            // R-63 F3 (G17) — piso de 36px. Só o modo `compact` (cockpit do Meu dia) tem o
            // wrapper `zoom: 0.85` (linha ~996), e getBoundingClientRect() mede o valor JÁ
            // escalado: h-9 (36px de CSS) vira 30.6px de verdade na tela. h-11 (44px) vira
            // 37.4px, acima do piso — achado medindo ao vivo, não no papel. Sem `compact`
            // (FichasTab, /consulta, OdontogramaComPainel) não há zoom, h-9 já é 36px reais.
            className={`relative inline-flex items-center px-4 text-[11px] font-bold tracking-wide transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal ${compact ? 'h-11' : 'h-9'}`}
            style={{
              color: tab === id ? 'var(--color-teal-ink)' : 'var(--color-text-secondary)',
              background: 'transparent',
            }}
          >
            {label}
            {tabCounts[id] > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold align-middle"
                style={{ background: 'var(--color-teal-dark)', color: 'white' }}
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
          className={`flex items-center gap-1.5 px-3 text-[10px] font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal rounded-sm ${compact ? 'h-11' : 'h-9'}`}
          style={{ color: legendOpen ? 'var(--color-teal-ink)' : 'var(--color-text-secondary)' }}
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
                    style={{ fill, stroke, strokeWidth: sw, filter, strokeDasharray: (label === 'Ausente' || label === 'Histórico') ? '2 2' : undefined }}
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
      )}

      {/* ── Chart ── */}
      <div className="overflow-x-auto">
        <div className={colunas ? "flex w-full min-w-0 flex-col gap-0" : "flex flex-col items-center gap-0 min-w-max px-1"}>

          {/* Quadrant labels — upper */}
          {!colunas && viewFilter !== 'lower' && (
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

          {/* Upper arch — raízes pra cima, coroas pro plano oclusal */}
          {viewFilter !== 'lower' && (
            <div className={colunas ? "grid w-full grid-cols-[repeat(var(--cols),minmax(0,1fr))] items-end gap-[3px] max-[600px]:grid-cols-[repeat(var(--cols-sm),minmax(0,1fr))]" : "flex items-end gap-[3px]"}
              style={colunas ? { '--cols': upperTeeth.length, '--cols-sm': upperTeeth.length / 2 } as React.CSSProperties : undefined}>
              {renderArch(upperTeeth, true)}
            </div>
          )}

          {/* Midline separator — o plano oclusal */}
          {viewFilter === 'all' && (colunas ? (
            <div className="my-2 flex justify-between text-[12px] leading-[19.2px] text-text-secondary max-[600px]:hidden">
              <span>Direito</span><span>Esquerdo</span>
            </div>
          ) : (
            <div
              className="w-full my-[8px]"
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--color-border) 15%, var(--color-border) 85%, transparent)',
              }}
            />
          ))}

          {/* Lower arch — coroas pra cima, raízes pra baixo */}
          {viewFilter !== 'upper' && (
            <div className={colunas ? "grid w-full grid-cols-[repeat(var(--cols),minmax(0,1fr))] items-start gap-[3px] max-[600px]:grid-cols-[repeat(var(--cols-sm),minmax(0,1fr))]" : "flex items-start gap-[3px]"}
              style={colunas ? { '--cols': lowerTeeth.length, '--cols-sm': lowerTeeth.length / 2 } as React.CSSProperties : undefined}>
              {renderArch(lowerTeeth, false)}
            </div>
          )}

          {/* Quadrant labels — lower */}
          {!colunas && viewFilter !== 'upper' && (
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
      <div className={colunas ? "hidden" : "h-5 flex items-center px-1"}>
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
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.coral }}>
                · a fazer
              </span>
            )}
            {hoveredResumo?.cor === 'warning' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.warning }}>
                · próxima sessão
              </span>
            )}
            {hoveredResumo?.cor === 'teal' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.teal }}>
                · feito aqui
              </span>
            )}
            {hoveredResumo?.cor === 'slate' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.slate }}>
                · pré-existente
              </span>
            )}
            {!clinico && hoveredState === 'historical' && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.teal }}>
                · histórico
              </span>
            )}
            {!clinico && (hoveredState === 'selected' || hoveredState === 'shared') && (
              <span className="text-[10px] font-semibold ml-0.5" style={{ color: COR_TOKEN_INK.teal }}>
                · selecionado
              </span>
            )}
          </div>
        ) : !presentationMode ? (
          <span className="text-[10px] italic leading-none" style={{ color: 'var(--color-text-muted)' }}>
            {clinico ? 'Toque um dente para ver e editar o detalhe' : 'Clique para selecionar um dente'}
          </span>
        ) : null}
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
