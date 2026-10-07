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

/** Nível da âncora. 'boca' = procedimento de boca toda (R-07: profilaxia/clareamento/fluor) —
 *  sem dente/arcada/quadrante; NUNCA pinta o odontograma, vira card "Boca" (D5 da spec R-06-07). */
export type NivelAncora = 'geral' | 'boca' | 'arcada' | 'quadrante' | 'dente' | 'face';

export type Arcada = 'superior' | 'inferior';

/** Quadrante FDI: 1-4 permanente, 5-8 decíduo. */
export type QuadranteFDI = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Face dental — 5 canônicas. Palatina é 'L' com rótulo contextual (ver faceLabel). */
export type FaceDental = 'O' | 'M' | 'D' | 'V' | 'L';

/** Abreviação exibida. `I` só existe na interface; persistência e IA continuam usando `O`. */
export type FaceDentalVisual = 'O' | 'I' | 'M' | 'D' | 'V' | 'L';

/** Incisivos e caninos FDI são dentes anteriores, permanentes ou decíduos. */
export function ehDenteAnteriorFDI(dente: number): boolean {
  const quadrante = Math.trunc(dente / 10);
  const posicao = dente % 10;
  const maxPosicao = quadrante >= 1 && quadrante <= 4 ? 8 : quadrante >= 5 && quadrante <= 8 ? 5 : 0;
  return posicao >= 1 && posicao <= 3 && posicao <= maxPosicao;
}

/** `O` é a região central canônica; em anteriores sua leitura clínica abreviada é `I`. */
export function faceAbreviacao(face: FaceDental, dente: number): FaceDentalVisual {
  return face === 'O' && ehDenteAnteriorFDI(dente) ? 'I' : face;
}

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

/** R-106 — justificativa transitória da classificação feita pelo Dex. Não persiste no
 * odontograma: serve apenas para sinalizar revisão no rascunho da consulta atual. */
export type EvidenciaStatus =
  | 'execucao_explicita'
  | 'indicacao_explicita'
  | 'negacao'
  | 'historico'
  | 'ambiguo';

/** Quem/quando: feito aqui vs. já estava assim quando o paciente chegou. */
export type OrigemRegistro = 'clinica' | 'preexistente';

/** R-101 — dentro do que ainda está 'indicado': planejado pra AGORA (sessao_atual, default)
 *  ou deliberadamente empurrado pro dentista tratar numa sessão futura. Eixo ORTOGONAL a
 *  status/origem (mesmo padrão de corDoRegistro) — nunca redefine o que é pendência, só a
 *  cor/rótulo. Só o dentista seta; a IA nunca decide (mesma classe de invariante de
 *  realizado_em, §1.10). Só é significativo quando status='indicado' (constraint no banco). */
export type MomentoPlanejado = 'sessao_atual' | 'proxima_sessao';

/** R-125a — decisão manual, transitória, de como o lançamento nasce no prontuário.
 * Não é mais um status persistido: converte para os três eixos clínicos já existentes. */
export type ModoLancamento =
  | 'realizado_hoje'
  | 'a_fazer'
  | 'proxima_sessao'
  | 'preexistente';

/** R-125a — separa o que já veio planejado do que nasceu nesta captura. Nunca persiste. */
export type FonteFluxoDraft = 'planejado' | 'novo';

/**
 * Cor semântica — função pura de status+origem+momentoPlanejado. 'indicado' é coral, exceto
 * quando planejado pra próxima sessão (âmbar) — não existe 4ª cor "pendência pré-existente".
 * 'realizado' vira teal (fizemos aqui) ou slate (já estava pronto quando o paciente chegou).
 */
export function corDoRegistro(
  status: StatusRegistro,
  origem: OrigemRegistro,
  momentoPlanejado: MomentoPlanejado = 'sessao_atual',
): 'coral' | 'teal' | 'slate' | 'warning' {
  if (status === 'indicado') return momentoPlanejado === 'proxima_sessao' ? 'warning' : 'coral';
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
  | 'esfoliacao'        // decíduo caiu (R-06). Ancora em dente (51-85), só 'realizado'.
  | 'fratura'           // trauma dentário (achado, como lesao_periapical). Ancora em dente.
  | 'pino_nucleo'       // pino intrarradicular/núcleo. Ancora em dente (raiz).
  // R-07 — rotina (migration 106). Nível boca/quadrante: nunca pintam dente, viram card.
  | 'profilaxia'        // limpeza. Ancora em boca.
  | 'raspagem'          // raspagem/alisamento periodontal. Ancora em quadrante (ou boca).
  | 'clareamento'       // clareamento dental. Ancora em boca.
  | 'fluor'             // aplicação de flúor. Ancora em boca.
  // R-08a — o tipo já existia no CHECK do banco (migration 106) mas nunca chegou ao TS.
  | 'exame_periodontal'  // exame periodontal aconteceu. Ancora em boca. Números vêm no R-08b.
  // R-107b (migration 139) — procedimento digitado sem tipo estrutural correspondente (ex.:
  // faceta). Ancora em dente, nunca face. Pinta com a cor do status; sem símbolo próprio
  // (buildResumos não tem case pra 'outro' — cai fora do switch, só a cor dominante,
  // já setada antes do switch, se aplica). Nunca entra no array `CHIPS` fixo — só nasce
  // pela busca livre do painel do dente.
  | 'outro';

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
  profilaxia:        'Profilaxia',
  raspagem:          'Raspagem',
  clareamento:       'Clareamento',
  fluor:             'Flúor',
  exame_periodontal: 'Exame periodontal',
  outro:             'Outro procedimento',
};

/** Nome clínico estável de leitura. O snapshot vence; `observacao` só nomeia legado `outro`. */
export function rotuloProcedimento(evento: {
  tipo: TipoRegistroOdontograma;
  procedimentoNome?: string | null;
  observacao?: string | null;
}): string {
  return evento.procedimentoNome?.trim()
    || (evento.tipo === 'outro' ? evento.observacao?.trim() : null)
    || TIPO_LABEL[evento.tipo];
}

// ── Evento (event-log) e estado reduzido (§1.4) ──────────────────────────

export interface OdontogramaEvento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  /** Dentista a quem o procedimento PLANEJADO foi encaminhado (R-04). Nunca transfere
   *  autoria — dentista_id continua o autor. null = não encaminhado. */
  encaminhado_para: string | null;
  /** Assinatura que congelou este evento (R-03a). null = ainda editável — imposto por
   *  trigger no banco (trg_odontograma_evento_imutavel), não só por checagem em app. */
  assinatura_id: string | null;
  ficha_id: string | null;
  grupo_id: string | null;
  tipo: TipoRegistroOdontograma;
  /** Vínculo opcional com o catálogo da clínica. `null` em registro livre/legado. */
  procedimentoId: string | null;
  /** Nome congelado no atendimento; não muda se o catálogo for renomeado. */
  procedimentoNome: string | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momento_planejado: MomentoPlanejado;
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

// ── Assinatura por procedimento (R-03a) ──────────────────────────────────

/**
 * 1 ato de assinatura = 1 linha. Genérica: tipo='procedimentos' (R-03a, congela um lote de
 * odontograma_eventos via assinatura_id) | tipo='orcamento' (R-03c, aceite financeiro —
 * fichaId fica null, orcamentoId assume). Alvo é sempre XOR, imposto por constraint no banco.
 */
export interface Assinatura {
  id: string;
  clinicaId: string;
  pacienteId: string;
  tipo: 'procedimentos' | 'orcamento';
  /** Alvo clínico — set só quando tipo='procedimentos'. */
  fichaId: string | null;
  /** Alvo financeiro — set só quando tipo='orcamento' (R-03c). */
  orcamentoId: string | null;
  /** Autor/responsável no momento — não necessariamente quem coletou (pode ser a secretária). */
  dentistaId: string;
  /** Nome de quem assinou (paciente ou responsável legal) — editável na captura. */
  assinadoPor: string;
  /** CRO do responsável no ato — snapshot, nunca recalculado (invariante). */
  croNoAto: string | null;
  /** Storage path, bucket `fichas` (silo por clínica). */
  assinaturaRef: string;
  assinadoEm: string;
}

/** Estado atual reduzido — 1 linha por (dente, tipo, face|null). Saída do endpoint de acumulado (§3.4). */
export interface OdontogramaEstadoAtual {
  dente: number;
  tipo: TipoRegistroOdontograma;
  face: FaceDental | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momento_planejado: MomentoPlanejado;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  realizado_em: string | null;
  registrado_em: string;
}

// ── Ortodontia — manutenção não pinta odontograma (§1.5) ─────────────────

export interface OrtoManutencaoInfo {
  arcada: 'superior' | 'inferior' | 'ambas';
  /** R-60 — evolução livre digitada pelo dentista, organizada por arcada. */
  registro_superior?: string | null;
  /** R-60 — evolução livre digitada pelo dentista, organizada por arcada. */
  registro_inferior?: string | null;
  /** R-60 — contexto da manutenção que não pertence a uma arcada específica. */
  observacao_geral?: string | null;
  /** Quando `arcada` é só 1, descreve ela. Quando `arcada === 'ambas'`, descreve a SUPERIOR —
   *  os campos `_inferior` abaixo descrevem a inferior (04/08: são procedimentos diferentes
   *  por arcada, 1 campo só não bastava). */
  fio: string | null;
  /** Inclui a troca de ligadura ("borrachinhas") — rotina que acompanha a ativação. */
  ativacao: string | null;
  /** Cadeia elastomérica na arcada (ex: "corrente de 13 a 23"). */
  elastico_corrente: string | null;
  /** Entre arcadas, uso domiciliar (ex: "3/16 Classe II, 13→46"). */
  elastico_intermaxilar: string | null;
  /** 04/08 — só fazem sentido com `arcada === 'ambas'`. Opcionais: registro antigo não tem, e
   *  isso é válido — nunca `''`. 05/08 (R-50): a IA passou a preenchê-los também. */
  fio_inferior?: string | null;
  ativacao_inferior?: string | null;
  elastico_corrente_inferior?: string | null;
  elastico_intermaxilar_inferior?: string | null;
}

// ── Entrada da IA para o client (§3.1) ───────────────────────────────────

/** Evento proposto pelo Motor A — grupo_id já resolvido pra uuid real pela rota. */
export interface OdontogramaEventoInput {
  tipo: TipoRegistroOdontograma;
  /** R-140b — catálogo é opcional; nunca define sozinho a localização clínica. */
  procedimentoId?: string | null;
  /** R-140b — snapshot obrigatório nos novos eventos `outro`. */
  procedimentoNome?: string | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. Só o dentista seta; a IA nunca preenche. */
  momento_planejado: MomentoPlanejado;
  ancora: AncoraClinica;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  observacao: string;
  /** R-106 — só no rascunho vindo da IA; omitido antes de persistir. */
  evidencia_status?: EvidenciaStatus;
  /** R-106 — ambiguidade/histórico do relato atual pede conferência do dentista. */
  revisar_status?: boolean;
  /** Dado clínico da especialidade (migration 106) — ver comentário em OdontogramaEvento. */
  detalhe?: unknown | null;
}

/**
 * Rascunho de evento na UI (confirmação/painel) — o que a IA propôs + o que só o
 * dentista preenche. `realizado_em` NUNCA vem da IA (invariante #13): default = data
 * da consulta, editável na confirmação; null em indicado/pré-existente sem data.
 */
export interface OdontogramaEventoDraft extends OdontogramaEventoInput {
  /**
   * uuid gerado no cliente (`crypto.randomUUID()`) na criação do registro (R-01).
   * Estável: sobrevive a re-render, a save e a reload. Nunca renumerado.
   */
  id: string;
  realizado_em: string | null;
  /** R-127 — ordem clínica do evento salvo. Ausente em evento novo ainda não persistido;
   * nesse caso, a posição no rascunho define a ordem até o save. */
  registrado_em?: string;
  /** R-127 — desempata eventos registrados no mesmo dia. Campo somente de leitura/UI. */
  created_at?: string;
  /**
   * R-30 Parte 2 — presente só quando o draft veio de um evento já carregado do banco
   * (`eventoViewParaDraft`); ausente em draft novo (IA/manual). Existe só pra o dedup de
   * `eventosDraft` nunca colapsar nem descartar um evento assinado (invariante #2 da R-30) —
   * não é enviado no payload de salvar (o servidor não aceita mudança de assinatura por aqui).
   */
  assinaturaId?: string | null;
  /** R-125a — apresentação do rascunho, removida antes do save. */
  fonteFluxo?: FonteFluxoDraft;
  /** R-125a — destino escolhido junto da revisão. `undefined` preserva evento já existente;
   * `null` remove explicitamente o encaminhamento no save. */
  encaminhadoParaId?: string | null;
  /** R-125a — identidade estável dentro de uma mesma captura explícita. */
  chaveCaptura?: string;
  /** R-185 — identidade transitória do lote de restauração; não vai à RPC. */
  autorDentistaId?: string;
  dataIntencao?: string;
  /** R-49 — proveniência e dúvidas são só da revisão deste rascunho; montarRowsEventos não
   * as envia ao banco. O detalhe clínico continua sendo o único dado persistido. */
  endo_revisao?: {
    origemPorCampo: Record<string, 'deterministico' | 'ia' | 'manual'>;
    duvidas: Array<{
      campo: string;
      trecho: string;
      motivo: 'sem_canal' | 'fora_da_faixa' | 'resolucao_invalida' | 'conflito';
    }>;
  };
}
