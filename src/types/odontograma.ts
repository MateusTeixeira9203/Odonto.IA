// src/types/odontograma.ts
//
// Tipos do Odontograma v3 (event-log). Fonte da verdade:
// plans/specs/spec-modo-consulta-v3-odontograma.md — Parte 1.
//
// Regra central: cada evento guarda dois eixos ORTOGONAIS (status + origem);
// a cor é DERIVADA (corDoRegistro), nunca persistida. O estado atual da boca
// é um reduce por query sobre o log (OdontogramaEstadoAtual), não uma tabela
// materializada.

// ── Âncora hierárquica (§1.1) ────────────────────────────────────────────

/** Nível da âncora. 'boca' não é emitido por eventos novos (sentinela 99 legado em fichas.dentes_afetados). */
export type NivelAncora = 'arcada' | 'quadrante' | 'dente' | 'face';

export type Arcada = 'superior' | 'inferior';

/** Quadrante FDI: 1-4 permanente, 5-8 decíduo. */
export type QuadranteFDI = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Face dental — 5 canônicas. Palatina é 'L' com rótulo contextual (ver faceLabel). */
export type FaceDental = 'O' | 'M' | 'D' | 'V' | 'L';

export interface AncoraClinica {
  nivel: NivelAncora;
  arcada?: Arcada;
  quadrante?: QuadranteFDI;
  dente?: number;
  faces?: FaceDental[];
}

/**
 * Rótulo de face contextual ao dente (superior → Palatina, inferior → Lingual;
 * anteriores → Incisal em vez de Oclusal — revisado 16/07, checklist de especialidades).
 * Mesma zona geométrica, rótulo contextual — não é estado novo.
 */
export function faceLabel(face: FaceDental, dente: number): string {
  const labels: Record<FaceDental, string> = { O: 'Oclusal', M: 'Mesial', D: 'Distal', V: 'Vestibular', L: 'Lingual' };
  if (face === 'L') {
    const superior = (dente >= 11 && dente <= 28) || (dente >= 51 && dente <= 65);
    return superior ? 'Palatina' : 'Lingual';
  }
  if (face === 'O') {
    const anterior = dente % 10 >= 1 && dente % 10 <= 3; // incisivos e caninos
    return anterior ? 'Incisal' : 'Oclusal';
  }
  return labels[face];
}

// ── Eixos ortogonais + cor derivada (§1.2) ───────────────────────────────

/** O que aconteceu com a intervenção. */
export type StatusRegistro = 'indicado' | 'realizado';

/** Quem/quando: feito aqui vs. já estava assim quando o paciente chegou. */
export type OrigemRegistro = 'clinica' | 'preexistente';

/**
 * Cor semântica — função pura de status+origem. 'indicado' é SEMPRE coral, não importa
 * quem achou o problema (não existe 4ª cor "pendência pré-existente"). 'realizado' vira
 * teal (fizemos aqui) ou slate (já estava pronto quando o paciente chegou).
 */
export function corDoRegistro(status: StatusRegistro, origem: OrigemRegistro): 'coral' | 'teal' | 'slate' {
  if (status === 'indicado') return 'coral';
  return origem === 'preexistente' ? 'slate' : 'teal';
}

// ── Tipo de registro (decide o símbolo, §1.3) ────────────────────────────

export type TipoRegistroOdontograma =
  | 'carie_restauracao' // achado cárie (indicado) → restauração (realizado). Ancora em face.
  | 'exodontia'         // indicado = "a extrair"; realizado = some da renderização normal.
  | 'endodontia'        // indicado = "a tratar"; realizado = canal tratado. Ancora em dente (raiz).
  | 'lesao_periapical'  // achado radiográfico — quase sempre 'indicado'. Ancora em dente (ápice).
  | 'implante'          // quase sempre 'realizado'; 'indicado' = implante planejado.
  | 'coroa'             // coroa total protética. Ancora em dente.
  | 'ponte'             // MULTI-DENTE — grupo_id/papel_no_grupo. Fatia B liga o render.
  | 'selante'           // preventivo, quase sempre 'realizado'. Ancora em face (sempre 'O').
  | 'inclusao'          // achado estrutural (dente incluso/impactado). Ancora em dente.
  | 'esfoliacao'        // decíduo caiu — Fatia B. Ancora em dente (51-85).
  | 'fratura'           // trauma dentário (achado, como lesao_periapical). Ancora em dente.
  | 'pino_nucleo';      // pino intrarradicular/núcleo. Ancora em dente (raiz).

export type PapelNoGrupo = 'pilar' | 'pontico';

/** Rótulos de exibição por tipo (painel de detalhe, lista agrupada, PDF). */
export const TIPO_LABEL: Record<TipoRegistroOdontograma, string> = {
  carie_restauracao: 'Restauração',
  exodontia:         'Extração',
  endodontia:        'Canal',
  lesao_periapical:  'Lesão periapical',
  implante:          'Implante',
  coroa:             'Coroa total',
  ponte:             'Ponte',
  selante:           'Selante',
  inclusao:          'Incluso',
  esfoliacao:        'Esfoliado',
  fratura:           'Fratura',
  pino_nucleo:       'Pino/núcleo',
};

// ── Evento (event-log) e estado reduzido (§1.4) ──────────────────────────

export interface OdontogramaEvento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  ficha_id: string | null;
  grupo_id: string | null;
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  papel_no_grupo: PapelNoGrupo | null;
  observacao: string | null;
  /**
   * Dado clínico da especialidade (migration 106) — odontometria de endo, marca/medidas
   * de implante. Validado por Zod na LEITURA (safeParse, nunca `as`): dado corrompido
   * degrada pra "sem tabela", nunca quebra a ficha (§5 da spec-106). null = sem dado
   * estruturado (a maioria dos tipos: cárie, exodontia, coroa...).
   */
  detalhe: unknown | null;
  /**
   * Data CLÍNICA em que o procedimento foi realizado (fiscalização CRO/judicial).
   * status='realizado' + origem='clinica' → obrigatória (default = data da consulta,
   * editável na confirmação); origem='preexistente' → null permitido ou data aproximada;
   * status='indicado' → sempre null. NUNCA inferida pela IA (§1.10, invariante #13).
   */
  realizado_em: string | null;
  /** Data em que o evento entrou no prontuário (ordena o reduce do acumulado). */
  registrado_em: string;
  created_at: string;
}

/** Estado atual reduzido — 1 linha por (dente, tipo, face|null). Saída do endpoint de acumulado (§3.4). */
export interface OdontogramaEstadoAtual {
  dente: number;
  tipo: TipoRegistroOdontograma;
  face: FaceDental | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  realizado_em: string | null;
  registrado_em: string;
}

// ── Ortodontia — manutenção não pinta odontograma (§1.5) ─────────────────

export interface OrtoManutencaoInfo {
  arcada: 'superior' | 'inferior' | 'ambas';
  fio: string | null;
  /** Inclui a troca de ligadura ("borrachinhas") — rotina que acompanha a ativação. */
  ativacao: string | null;
  /** Cadeia elastomérica na arcada (ex: "corrente de 13 a 23"). */
  elastico_corrente: string | null;
  /** Entre arcadas, uso domiciliar (ex: "3/16 Classe II, 13→46"). */
  elastico_intermaxilar: string | null;
}

// ── Entrada da IA para o client (§3.1) ───────────────────────────────────

/** Evento proposto pelo Motor A — grupo_id já resolvido pra uuid real pela rota. */
export interface OdontogramaEventoInput {
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  observacao: string;
  /** Dado clínico da especialidade (migration 106) — ver comentário em OdontogramaEvento. */
  detalhe?: unknown | null;
}

/**
 * Rascunho de evento na UI (confirmação/painel) — o que a IA propôs + o que só o
 * dentista preenche. `realizado_em` NUNCA vem da IA (invariante #13): default = data
 * da consulta, editável na confirmação; null em indicado/pré-existente sem data.
 */
export interface OdontogramaEventoDraft extends OdontogramaEventoInput {
  realizado_em: string | null;
}
