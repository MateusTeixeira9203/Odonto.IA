"use client";

import * as React from "react";
import {
  Plus,
  X,  Trash2,
  FileText,
  Download,
  Check,
  Loader2,  PenLine,
  Pencil,
  Clock,
  Circle,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DexLoader } from "@/components/ui/dex-loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { toast } from 'sonner';
import type { PlanoId } from "@/lib/planos";
import { Odontograma, type ToothStatus } from "@/components/odontograma/Odontograma";
import { ToothDetailPanel } from "@/components/odontograma/ToothDetailPanel";
import {
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA, ARCH_LABELS,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
} from "@/lib/arcadas";
import dynamic from 'next/dynamic';
import type SignaturePadLib from 'signature_pad';
import { formatarDataFicha } from '@/lib/format-data-ficha';
import { CapturaLivreCard } from '@/components/fichas/captura-livre-card';
import { OrtoCard } from '@/components/fichas/orto-card';
import { RegistroCard, type RegistroCardData } from '@/components/fichas/registro-card';
import { endoDetalheSchema, type EndoDetalhe } from '@/lib/especialidades/endo';
import { EndoCard } from '@/components/fichas/endo-card';
import { EndoForm } from '@/components/fichas/endo-form';
import { implanteDetalheSchema, type ImplanteDetalhe } from '@/lib/especialidades/implante';
import { ImplanteCard } from '@/components/fichas/implante-card';
import { ImplanteForm } from '@/components/fichas/implante-form';
import { TIPO_LABEL } from '@/types/odontograma';
import type {
  OrtoManutencaoInfo, OdontogramaEventoDraft,
  TipoRegistroOdontograma, StatusRegistro, OrigemRegistro, AncoraClinica,
  NivelAncora, Arcada, FaceDental,
} from '@/types/odontograma';
import { salvarEventosOdontograma, alternarStatusRegistro } from '@/app/consulta/[agendamentoId]/actions';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
const SignaturePad = dynamic(
  () => import('@/components/fichas/SignaturePad').then(m => m.SignaturePad),
  { ssr: false }
);

interface ToothNote {
  tooth: number;
  notes: string[];
}



type ProcStatus = ToothStatus;

// #16 D3 — ciclo de status (clique avança) e metadados visuais (cinza → âmbar → teal).
const STATUS_CYCLE: Record<ProcStatus, ProcStatus> = {
  nao_iniciado: 'em_andamento',
  em_andamento: 'concluido',
  concluido: 'nao_iniciado',
};

const STATUS_META: Record<ProcStatus, { label: string; icon: typeof Check; className: string }> = {
  nao_iniciado: { label: 'A fazer', icon: Circle, className: 'bg-surface border-border text-text-secondary hover:border-teal hover:text-teal' },
  em_andamento: { label: 'Em andamento', icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20' },
  concluido: { label: 'Concluído', icon: Check, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' },
};


/** Evento de odontograma de uma ficha, forma enxuta pra render dos cards §11 (camada 2). */
interface EventoView {
  id: string;
  grupoId: string | null;
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  ancora: AncoraClinica;
  observacao: string | null;
  realizadoEm: string | null;
  registradoEm: string;
  /** Dado clínico da especialidade (migration 106) — cru, ainda não validado. */
  detalhe: unknown | null;
}

/**
 * Linha crua da tabela odontograma_eventos. A âncora NÃO é uma coluna composta — o schema
 * (migration 101) achata em nivel/arcada/quadrante/dente/faces, exatamente como a escrita
 * grava (`montarRowsEventos` em consulta/actions.ts). Ler pedindo uma coluna `ancora` que
 * não existe falha silenciosamente sem checagem de erro — foi um bug real desta sessão,
 * invisível enquanto o banco não tinha eventos pra expô-lo.
 */
type EventoRow = {
  id: string;
  ficha_id: string | null;
  grupo_id: string | null;
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  nivel: NivelAncora;
  arcada: Arcada | null;
  quadrante: number | null;
  dente: number | null;
  faces: FaceDental[] | null;
  observacao: string | null;
  /** Dado clínico da especialidade (migration 106) — cru, ainda não validado. */
  detalhe: unknown | null;
  realizado_em: string | null;
  registrado_em: string;
};

interface Evolution {
  id: string;
  date: string;
  /** Data CLÍNICA do atendimento (pode ser retroativa) — migration 100. ISO 'YYYY-MM-DD'. */
  dataAtendimento: string;
  type: string;
  observation: string;
  teethNotes: ToothNote[];
  professional: string;
  files: string[];
  procedimentosConcluidos: string[];
  procedimentosStatus: Record<string, ProcStatus>;
  procedimentos: string[];
  conduta: string | null;
  assinaturaUrl: string | null;
  assinadoEm: string | null;
  tratamentoId: string | null;
  /** Manutenção ortodôntica da consulta (Roadmap A / A0) — registro de arcada, não pinta dente. */
  ortoManutencao: OrtoManutencaoInfo | null;
  /** Autor da ficha. A ficha é lida por toda a clínica; só o autor escreve (migration 099). */
  dentistaId: string;
  /** CRO do autor — pro card §11 (fiscalização). */
  autorCro: string | null;
  /** Eventos do odontograma desta ficha (camada 2). Vazio nas fichas v2 antigas (sem backfill). */
  eventos: EventoView[];
}

type FichaDB = {
  id: string;
  created_at: string;
  data_atendimento: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  status: string;
  dentista_id: string;
  dentista?: { nome: string; cro: string | null } | null;
  procedimentos_concluidos: string[];
  procedimentos_status: Record<string, ProcStatus> | null;
  procedimentos: string[] | null;
  conduta: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  tratamento_id: string | null;
  orto_manutencao: OrtoManutencaoInfo | null;
};

/**
 * Exibição da data (§7.1): se `data_atendimento` cai no mesmo dia do `created_at`
 * (fuso da clínica), mantém `DD/MM/AAAA às HH:MM`; se é retroativa, só a data —
 * hora falsa (meia-noite) mentiria. Formata `data_atendimento` na mão (não via
 * `new Date()`) pra não sofrer o shift de fuso de um 'YYYY-MM-DD' parseado como UTC.
 */
/** Hoje no fuso da clínica, ISO 'YYYY-MM-DD' — default e teto do campo de data (invariante #5). */
function hojeBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

const mapFichaToEvolution = (f: FichaDB): Evolution => ({
  id: f.id,
  date: formatarDataFicha(f.data_atendimento, f.created_at),
  dataAtendimento: f.data_atendimento,
  type: f.queixa_principal ?? "Evolução",
  observation: f.anotacoes ?? "",
  teethNotes: (f.dentes_afetados ?? []).map((t) => {
    const raw = f.dentes_observacoes?.[String(t)] ?? "";
    const parts = raw.split('\n').filter(Boolean);
    return { tooth: t, notes: parts.length > 0 ? parts : [''] };
  }),
  professional: f.dentista?.nome ?? "Profissional",
  dentistaId: f.dentista_id,
  files: [],
  procedimentosConcluidos: f.procedimentos_concluidos ?? [],
  procedimentosStatus: (() => {
    if (f.procedimentos_status && Object.keys(f.procedimentos_status).length > 0) {
      return f.procedimentos_status;
    }
    // Migra modelo antigo: procedimentos_concluidos → concluido
    const s: Record<string, ProcStatus> = {};
    (f.procedimentos_concluidos ?? []).forEach((k) => { s[k] = 'concluido'; });
    return s;
  })(),
  procedimentos: f.procedimentos ?? [],
  conduta: f.conduta || null,
  assinaturaUrl: f.assinatura_url ?? null,
  assinadoEm: f.assinado_em ?? null,
  tratamentoId: f.tratamento_id ?? null,
  ortoManutencao: f.orto_manutencao ?? null,
  autorCro: f.dentista?.cro ?? null,
  eventos: [], // anexados em fetchFichas após buscar a tabela odontograma_eventos
});

/**
 * Deriva os campos v2 (`dentes_afetados` / `dentes_observacoes` / `procedimentos`) a partir
 * dos EVENTOS do odontograma.
 *
 * Por que existe: no design definitivo (21/07) o seletor manual de dentes deixou de existir —
 * quem lança à mão passa pelo perfil do dente, que produz **evento**, não seleção. Sem esta
 * derivação, orçamento, PDF e progresso (que leem os campos v2) ficariam vazios numa ficha
 * lançada manualmente. O que o Dex já preencheu tem **precedência**; a derivação só COMPLETA.
 */
function derivarV2DosEventos(eventos: OdontogramaEventoDraft[]): {
  dentes: number[];
  observacoes: Record<string, string>;
  procedimentos: string[];
} {
  const porDente = new Map<number, string[]>();
  const procedimentos: string[] = [];
  for (const ev of eventos) {
    const rotulo = TIPO_LABEL[ev.tipo] + (ev.status === 'indicado' ? ' - planejado' : '');
    const linha = ev.observacao ? `${rotulo} (${ev.observacao})` : rotulo;
    const d = ev.ancora.dente;
    if (d != null) {
      const arr = porDente.get(d);
      if (arr) arr.push(linha); else porDente.set(d, [linha]);
    }
    if (!procedimentos.includes(rotulo)) procedimentos.push(rotulo);
  }
  return {
    dentes: [...porDente.keys()],
    observacoes: Object.fromEntries([...porDente].map(([d, ls]) => [String(d), ls.join('\n')])),
    procedimentos,
  };
}

/** Converte os eventos salvos (EventoView) pra o shape que Odontograma/ToothDetailPanel leem. */
/**
 * Agrupa os eventos de uma ficha em cards §11 (camada 2): eventos com o MESMO grupo_id
 * viram UM card multi-dente ("Exodontia · dentes 31–41"); os isolados, um card cada.
 * Autor/CRO e estado de assinatura vêm da ficha (na ficha rápida, um autor por ficha).
 */
function eventosParaCards(
  eventos: EventoView[], autorNome: string, autorCro: string | null, assinada: boolean,
): Array<{ key: string; ids: string[]; data: RegistroCardData }> {
  const grupos = new Map<string, EventoView[]>();
  for (const ev of eventos) {
    // grupo_id une multi-dente; sem grupo, MESMO dente+tipo+status mescla (faces unidas) —
    // 3 eventos de face do Dex viram 1 card "Restauração LMO · dente 45" (feedback 21/07).
    const chave = ev.grupoId
      ?? `m:${ev.ancora.dente ?? `${ev.ancora.nivel}:${ev.ancora.arcada ?? ev.ancora.quadrante ?? ''}`}|${ev.tipo}|${ev.status}`;
    const arr = grupos.get(chave);
    if (arr) arr.push(ev); else grupos.set(chave, [ev]);
  }
  return [...grupos.values()]
    .sort((a, b) => (a[0].ancora.dente ?? 99) - (b[0].ancora.dente ?? 99))
    .map((grupo) => {
    const primeiro = grupo[0];
    return {
      key: primeiro.id,
      ids: grupo.map((e) => e.id),   // alvo do toggle de status (todos do grupo juntos)
      data: {
        tipo: primeiro.tipo,
        status: primeiro.status,
        origem: primeiro.origem,
        ancoras: grupo.map((e) => e.ancora),
        observacao: primeiro.observacao,
        detalhe: primeiro.detalhe,
        realizadoEm: primeiro.realizadoEm,
        registradoEm: primeiro.registradoEm,
        autorNome,
        autorCro,
        assinada,
      },
    };
  });
}

/** EventoView (salvo) -> Draft: o shape que Odontograma/ToothDetailPanel consomem. */
function eventoViewParaDraft(e: EventoView): OdontogramaEventoDraft {
  return {
    id: e.id, // já existe no banco — o draft de EDIÇÃO reusa o id, nunca gera outro (R-01)
    tipo: e.tipo, status: e.status, origem: e.origem, ancora: e.ancora,
    grupo_id: e.grupoId, papel_no_grupo: null, observacao: e.observacao ?? '',
    detalhe: e.detalhe, realizado_em: e.realizadoEm,
  };
}

/**
 * Resolve o corpo de camada 3 (tabela de endo, campos de implante) pra um card §11 —
 * só monta quando há dado (I2). `detalhe` é lido SEMPRE por safeParse (migration 106,
 * spec-106 §5): dado corrompido degrada pra "sem tabela", nunca quebra a ficha.
 */
function corpoEspecialidade(tipo: TipoRegistroOdontograma, detalhe: unknown): React.ReactNode {
  if (tipo === 'endodontia') {
    const r = endoDetalheSchema.safeParse(detalhe);
    return r.success ? <EndoCard valor={r.data} /> : null;
  }
  if (tipo === 'implante') {
    const r = implanteDetalheSchema.safeParse(detalhe);
    return r.success ? <ImplanteCard valor={r.data} /> : null;
  }
  return null;
}

// Ficha enlatada do perfil demo (K · spec 3.3) — coerente com o seed da consulta demo (João Silva, dente 46).
// `dentistaId` fica de fora: é injetado no uso com o dentista real logado, pra a demo continuar
// editável (professional: 'Você'). Sem isso ela cairia no caminho de "ficha de outro dentista".
const DEMO_EVOLUTION: Omit<Evolution, 'dentistaId'> = {
  id: 'demo-ficha',
  date: new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', ' às'),
  dataAtendimento: hojeBRT(),
  type: 'Dor ao mastigar no lado direito inferior',
  observation:
    'Paciente relata dor à mastigação no lado inferior direito há cerca de duas semanas, ' +
    'com sensibilidade ao frio. Sem histórico de trauma. Higiene satisfatória.',
  teethNotes: [{ tooth: 46, notes: ['Restauração antiga com infiltração', 'Sensibilidade ao frio'] }],
  professional: 'Você',
  files: [],
  procedimentosConcluidos: [],
  procedimentosStatus: { 'Restauração de compósito (dente 46)': 'nao_iniciado', 'Profilaxia': 'nao_iniciado' },
  procedimentos: ['Restauração de compósito (dente 46)', 'Profilaxia'],
  conduta: 'Substituir a restauração do dente 46 e realizar profilaxia. Reavaliar sensibilidade em 30 dias.',
  assinaturaUrl: null,
  assinadoEm: null,
  tratamentoId: null,
  ortoManutencao: null,
  autorCro: null,
  eventos: [],
};

interface FichasTabProps {
  patientId: string;
  clinicaId: string;
  dentistaId: string;
  plano?: PlanoId;
  patientName?: string;
  canWrite?: boolean;
  /** #6 — abre o modal de orçamento no pai, já mirado nesta ficha. */
  onGerarOrcamento?: (fichaId: string) => void;
}

export function FichasTab({ patientId, clinicaId, dentistaId, patientName, canWrite = true, onGerarOrcamento }: FichasTabProps) {
  // O histórico é da CLÍNICA (todo dentista lê), o trabalho é do AUTOR (só ele escreve) —
  // migration 099. `canWrite` cobre papel/plano; a autoria é uma segunda condição, não a
  // mesma. Esconder o controle é conveniência: quem barra de verdade é a RLS (invariante #9).
  const podeEditarFicha = React.useCallback(
    (evo: Evolution) => canWrite && evo.dentistaId === dentistaId,
    [canWrite, dentistaId],
  );

  const [evolutions, setEvolutions] = React.useState<Evolution[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);  const [selectedTeeth, setSelectedTeeth] = React.useState<number[]>([]);
  const [sharedTeeth, setSharedTeeth] = React.useState<number[]>([]);  const [sharedNotes, setSharedNotes] = React.useState<string[]>(['']);  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [signingFichaId, setSigningFichaId] = React.useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = React.useState(false);
  // #9: fica true quando "Organizar com Dex" preenche o form nesta edição — decide
  // origem no insert (nunca no update). Reseta ao fechar/abrir o painel.
  const [preenchidoPorDex, setPreenchidoPorDex] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadLib | null>(null);

  // ── Modo de visualização da ficha ─────────────────────────────────────────
  const [viewingEvo, setViewingEvo] = React.useState<Evolution | null>(null);

  const [formData, setFormData] = React.useState({
    dataAtendimento: hojeBRT(),
    type: "Evolução",
    observation: "",
    teethNotes: [] as ToothNote[],
    procedimentos: [] as string[],
    conduta: "",
    ortoManutencao: null as OrtoManutencaoInfo | null,
  } as { dataAtendimento: string; type: string; observation: string; teethNotes: ToothNote[]; procedimentos: string[]; conduta: string; ortoManutencao: OrtoManutencaoInfo | null });

  // Eventos de odontograma propostos pelo "Organizar com Dex" (camada 2). Só o campo
  // mágico os preenche na ficha rápida; persistem no save via a RPC atômica da consulta
  // (salvarEventosOdontograma). Vazio = save não toca a tabela de eventos (edição sem
  // reorganizar preserva os eventos existentes — a action no-opa em lista vazia).
  const [eventosDraft, setEventosDraft] = React.useState<OdontogramaEventoDraft[]>([]);

  // Camada 1: dente aberto no painel de revisão do odontograma (rascunho do Dex).
  const [denteAberto, setDenteAberto] = React.useState<number | null>(null);

  // Perfil do dente na ficha SALVA (readOnly) — um por vez, preso à ficha dona.
  const [denteSalvoAberto, setDenteSalvoAberto] = React.useState<{ fichaId: string; dente: number } | null>(null);
  // Tabela de especialidade aberta direto no card do registro (rascunho) — um por vez,
  // sem precisar reabrir o dente no odontograma (feedback 22/07).
  const [grupoDetalheAberto, setGrupoDetalheAberto] = React.useState<string | null>(null);
  // G11 — tocar um dente rola até o card do registro correspondente e destaca (some sozinho).
  const registroCardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const [grupoDestacado, setGrupoDestacado] = React.useState<string | null>(null);
  // Dente aberto na FICHA SALVA (leitura) — estado separado do de criação, sempre readOnly.

  /**
   * ZONA 3 — agrupa o rascunho pra render (feedback 21/07: "Restauração M · 45" três
   * vezes é poluição). Regras: mesmo grupo_id = 1 card multi-dente; sem grupo, MESMO
   * dente+tipo+status mescla num card só com as faces unidas ("Restauração LMO · 45").
   * Ordena por dente. Guarda os índices pra edição/remoção in-place.
   */
  const gruposDraft = React.useMemo(() => {
    const m = new Map<string, number[]>();
    eventosDraft.forEach((ev, i) => {
      const chave = ev.grupo_id
        ?? `m:${ev.ancora.dente ?? `${ev.ancora.nivel}:${ev.ancora.arcada ?? ev.ancora.quadrante ?? ''}`}|${ev.tipo}|${ev.status}`;
      const arr = m.get(chave);
      if (arr) arr.push(i); else m.set(chave, [i]);
    });
    return [...m.entries()]
      .map(([chave, idxs]) => ({
        chave,
        idxs,
        faces: [...new Set(idxs.flatMap((i) => eventosDraft[i].ancora.faces ?? []))].join(''),
      }))
      .sort((a, b) => (eventosDraft[a.idxs[0]].ancora.dente ?? 99) - (eventosDraft[b.idxs[0]].ancora.dente ?? 99));
  }, [eventosDraft]);

  /**
   * G11 — abre o painel do dente (como sempre) E rola até o card do registro correspondente,
   * destacando por 1,6s. Não abre tabela nenhuma sozinho — só direciona a atenção (P1: o
   * corpo da especialidade só aparece se o usuário tocar "Detalhes" em uma das duas entradas).
   */
  const abrirDenteEDestacarRegistro = React.useCallback((dente: number | null) => {
    setDenteAberto(dente);
    if (dente == null) return;
    const grupo = gruposDraft.find(({ idxs }) => idxs.some((i) => eventosDraft[i].ancora.dente === dente));
    if (!grupo) return;
    const el = registroCardRefs.current.get(grupo.chave);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setGrupoDestacado(grupo.chave);
    window.setTimeout(() => setGrupoDestacado((cur) => (cur === grupo.chave ? null : cur)), 1600);
  }, [gruposDraft, eventosDraft]);

  /** Observação por procedimento (§03 do definitivo) — aplica a todo o grupo. */
  const atualizarObsGrupo = (idxs: number[], obs: string) => {
    setEventosDraft((prev) => prev.map((ev, i) => (idxs.includes(i) ? { ...ev, observacao: obs } : ev)));
  };

  /** Remove o registro (grupo inteiro) do rascunho antes de salvar. */
  const removerGrupoDraft = (idxs: number[]) => {
    setEventosDraft((prev) => prev.filter((_, i) => !idxs.includes(i)));
  };

  /** Atualiza o `detalhe` (tabela de especialidade) de UM evento do rascunho por índice. */
  const atualizarDetalheDraft = (idx: number, detalhe: unknown) => {
    setEventosDraft((prev) => prev.map((ev, i) => (i === idx ? { ...ev, detalhe } : ev)));
  };

  // Busca fichas do Supabase
  const fetchFichas = React.useCallback(async () => {
    // Perfil demo: ficha enlatada, sem tocar no banco (K · spec 3.3).
    if (patientId === 'demo') {
      setEvolutions([{ ...DEMO_EVOLUTION, dentistaId }]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fichas")
        .select("id, created_at, data_atendimento, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, procedimentos_status, procedimentos, conduta, assinatura_url, assinado_em, tratamento_id, orto_manutencao, dentista_id, dentista:dentistas(nome, cro)")
        .eq("paciente_id", patientId)
        .eq("clinica_id", clinicaId)
        .order("data_atendimento", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const fichas = (data as unknown as FichaDB[]).map(mapFichaToEvolution);

      // Camada 2: eventos do odontograma (event-log) agrupados por ficha. Fichas v2
      // antigas não têm eventos → recebem [] e seguem no display legado (fonte híbrida).
      const { data: evData, error: evError } = await supabase
        .from("odontograma_eventos")
        .select("id, ficha_id, grupo_id, tipo, status, origem, nivel, arcada, quadrante, dente, faces, observacao, detalhe, realizado_em, registrado_em")
        .eq("paciente_id", patientId)
        .eq("clinica_id", clinicaId);

      // Falha na busca de eventos NUNCA pode ficar silenciosa — já esteve (bug real desta
      // sessão): erro engolido = camada 2 sempre vazia, sem sinal nenhum de que algo quebrou.
      if (evError) console.error("Erro ao buscar odontograma_eventos:", evError);

      const eventosPorFicha = new Map<string, EventoView[]>();
      for (const e of (evData ?? []) as unknown as EventoRow[]) {
        if (!e.ficha_id) continue;
        // Reconstrói a âncora a partir das colunas achatadas (espelha montarRowsEventos).
        const ancora: AncoraClinica = {
          nivel: e.nivel,
          ...(e.arcada != null && { arcada: e.arcada }),
          ...(e.quadrante != null && { quadrante: e.quadrante as AncoraClinica['quadrante'] }),
          ...(e.dente != null && { dente: e.dente }),
          ...(e.faces && e.faces.length > 0 && { faces: e.faces }),
        };
        const view: EventoView = {
          id: e.id, grupoId: e.grupo_id, tipo: e.tipo, status: e.status,
          origem: e.origem, ancora, observacao: e.observacao ?? null, realizadoEm: e.realizado_em, registradoEm: e.registrado_em,
          detalhe: e.detalhe ?? null,
        };
        const arr = eventosPorFicha.get(e.ficha_id);
        if (arr) arr.push(view); else eventosPorFicha.set(e.ficha_id, [view]);
      }

      setEvolutions(fichas.map((f) => ({ ...f, eventos: eventosPorFicha.get(f.id) ?? [] })));
    } catch (err) {
      console.error("Erro ao buscar fichas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, clinicaId, dentistaId]);

  React.useEffect(() => {
    if (patientId && clinicaId) {
      void fetchFichas();
    }
  }, [patientId, clinicaId, fetchFichas]);


  // Dentes mencionados em fichas anteriores — usados pelo odontograma premium
  const historicalTeeth = React.useMemo(() => {
    const set = new Set<number>();
    evolutions.forEach((e) =>
      e.teethNotes.forEach((tn) => {
        if (tn.tooth < 90) set.add(tn.tooth); // exclui constantes de arcada (97,98,99)
      })
    );
    return set;
  }, [evolutions]);



  const toggleArch = (archNum: number) => {
    setSelectedTeeth((prev) => {
      const isSelected = prev.includes(archNum);
      if (isSelected) {
        setFormData((f) => ({ ...f, teethNotes: f.teethNotes.filter((tn) => tn.tooth !== archNum) }));
        return prev.filter((t) => t !== archNum);
      } else {
        setFormData((f) => ({ ...f, teethNotes: [...f.teethNotes, { tooth: archNum, notes: [''] }] }));
        return [...prev, archNum];
      }
    });
  };


  // Job A Fatia B (§5) — form já preenchido pede confirmação antes do "Organizar"
  // sobrescrever (o CapturaLivreCard checa isto ANTES de disparar formatar-evolucao).
  const formDirty = Boolean(
    formData.observation.trim() ||
    selectedTeeth.length > 0 ||
    sharedTeeth.length > 0 ||
    formData.procedimentos.length > 0 ||
    formData.conduta.trim()
  );

  // Mapeamento IA → form (§5): "Organizar com Dex" preenche o form existente — o
  // form É a tela de revisão (invariante #8), nada entra na ficha sem passar por ele.
  // Dentes preenchidos = dentes SELECIONADOS; o dentista remove o que não confirma
  // (mesmo princípio da auto-confirmação do consulta, invertido pro idioma do form).
  const aplicarEvolucaoDoOrganizar = (data: EvolucaoFormatada) => {
    setFormData((f) => ({
      ...f,
      type: data.queixa_principal || f.type,
      observation: data.alerta_novo
        ? `${data.anotacoes}\n\n⚠️ Novo alerta detectado: ${data.alerta_novo}`
        : data.anotacoes,
      teethNotes: data.dentes_afetados.map((t) => {
        const raw = data.dentes_observacoes[String(t)] ?? '';
        const parts = raw.split('\n').filter(Boolean);
        return { tooth: t, notes: parts.length > 0 ? parts : [''] };
      }),
      procedimentos: data.procedimentos,
      conduta: data.conduta,
      ortoManutencao: data.orto_manutencao,
    }));
    // Camada 2: os eventos viram rascunho, com realizado_em pela mesma regra da consulta
    // (§1.10, invariante #13: só realizado+clínica ganha a data; IA nunca preenche data).
    setEventosDraft(
      (data.odontograma_eventos ?? []).map((ev) => ({
        ...ev,
        id: crypto.randomUUID(), // R-01 — id estável nasce aqui, na entrada do rascunho
        realizado_em: ev.status === 'realizado' && ev.origem === 'clinica' ? formData.dataAtendimento : null,
      })),
    );
    // Mesmo critério do handleEdit (linha 666): sentinela de arcada entre os dentes
    // afetados põe o modo em 'arch' — mantém os botões de seleção coerentes com o
    // que a IA de fato preencheu.    setSharedTeeth([]);
    setSharedNotes(['']);
    setSelectedTeeth(data.dentes_afetados);
    setPreenchidoPorDex(true);
  };

  /**
   * Alterna planejado ⇄ realizado de um registro da ficha SALVA (bug 21/07: não havia
   * caminho pra marcar o que foi feito). Otimista com rollback — a RLS/action barra o
   * não-autor e a ficha assinada, e aí a UI volta ao estado real (invariante #9: update
   * barrado por RLS volta sucesso com 0 linhas, então nunca confiamos sem confirmação).
   */
  const toggleStatusRegistro = async (
    evo: Evolution, ids: string[], statusAtual: StatusRegistro,
  ) => {
    const novoStatus: StatusRegistro = statusAtual === 'realizado' ? 'indicado' : 'realizado';
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id)
        ? { ...ev, status: novoStatus, realizadoEm: novoStatus === 'realizado' ? evo.dataAtendimento : null }
        : ev),
    }));

    const res = await alternarStatusRegistro({ eventoIds: ids, novoStatus, dataClinica: evo.dataAtendimento });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível atualizar o registro.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const validSharedNotes = sharedNotes.filter((n) => n.trim()).join('\n');

      // Design definitivo (21/07): o lançamento manual virou EVENTO (perfil do dente).
      // Derivamos os campos v2 pra que orçamento / PDF / progresso continuem alimentados.
      const derivado = derivarV2DosEventos(eventosDraft);

      // União: seleção de região (sentinelas de arcada/quadrante) + dentes dos eventos.
      const dentesAfetados = [...new Set([...selectedTeeth, ...sharedTeeth, ...derivado.dentes])];

      const dentesObservacoes: Record<string, string> = {
        // Base: o que veio dos eventos (perfil do dente ou Dex).
        ...derivado.observacoes,
        // Dentes individuais do form — PRECEDÊNCIA sobre a derivação (texto do Dex é mais rico).
        ...Object.fromEntries(
          formData.teethNotes
            .map((tn) => [String(tn.tooth), tn.notes.filter((n) => n.trim()).join('\n')] as [string, string])
            .filter(([, v]) => v.length > 0)
        ),
        // Grupo de dentes — todos compartilham as mesmas notas
        ...(validSharedNotes
          ? Object.fromEntries(sharedTeeth.map((t) => [String(t), validSharedNotes]))
          : {}),
      };

      // Procedimentos: os do form primeiro; a derivação só acrescenta o que faltou.
      const procedimentosFinais = [
        ...formData.procedimentos,
        ...derivado.procedimentos.filter((p) => !formData.procedimentos.includes(p)),
      ];

      let fichaId: string;
      if (editingId) {
        const { error } = await supabase
          .from("fichas")
          .update({
            // data_atendimento é editável (o dentista pode corrigir a data na edição);
            // origem NUNCA entra aqui — update não reescreve origem (invariante #9).
            data_atendimento: formData.dataAtendimento,
            queixa_principal: formData.type,
            anotacoes: formData.observation || null,
            dentes_afetados: dentesAfetados,
            dentes_observacoes: dentesObservacoes,
            procedimentos: procedimentosFinais,
            conduta: formData.conduta || null,
            orto_manutencao: formData.ortoManutencao,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)
          .eq("clinica_id", clinicaId);

        if (error) throw error;
        fichaId = editingId;
      } else {
        const { data: novaFicha, error } = await supabase.from("fichas").insert({
          paciente_id: patientId,
          dentista_id: dentistaId,
          clinica_id: clinicaId,
          data_atendimento: formData.dataAtendimento,
          queixa_principal: formData.type,
          anotacoes: formData.observation || null,
          dentes_afetados: dentesAfetados,
          dentes_observacoes: dentesObservacoes,
          procedimentos: procedimentosFinais,
          conduta: formData.conduta || null,
          orto_manutencao: formData.ortoManutencao,
          status: "aberta",
          // #9: só marca ficha_rapida se o preenchimento desta edição veio do Dex.
          origem: preenchidoPorDex ? 'ficha_rapida' : 'manual',
        }).select("id").single();

        if (error) throw error;
        if (!novaFicha) throw new Error("Falha ao criar a ficha.");
        fichaId = novaFicha.id as string;
      }

      // Camada 2 (Roadmap A / A0): persiste os eventos do odontograma via a RPC atômica
      // da consulta — upsert por id, idempotente, respeita autoria e imutabilidade da
      // ficha assinada (migration 107, R-01). Fail-soft: a ficha JÁ foi salva; se os
      // eventos falharem, avisa mas não desfaz. Lista vazia (edição sem reorganizar) =
      // a action no-opa, preserva.
      if (eventosDraft.length > 0) {
        const res = await salvarEventosOdontograma({ fichaId, pacienteId: patientId, eventos: eventosDraft });
        if (!res.ok) toast.error(res.error ?? "A ficha salvou, mas o odontograma não foi gravado.");
      }

      await fetchFichas();
      closePanel();
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (!signingFichaId || !signaturePadRef.current) return;
    if (signaturePadRef.current.isEmpty()) {
      toast.error('Nenhuma assinatura detectada. Por favor assine antes de confirmar.');
      return;
    }

    setIsSavingSignature(true);
    try {
      const dataUrl = signaturePadRef.current.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const supabase = createClient();
      const storagePath = `${clinicaId}/${patientId}/assinatura_${signingFichaId}.png`;

      const { error: storageErr } = await supabase.storage
        .from('fichas')
        .upload(storagePath, blob, { upsert: true, contentType: 'image/png' });
      if (storageErr) throw storageErr;

      const assinadoEm = new Date().toISOString();

      const { data: signed, error: dbErr } = await supabase
        .from('fichas')
        .update({ assinatura_url: storagePath, assinado_em: assinadoEm })
        .eq('id', signingFichaId)
        .eq('clinica_id', clinicaId)
        .select('id');
      if (dbErr) throw dbErr;
      // .select() vazio = RLS barrou (ficha de outro autor). O botão já é gated (defesa em
      // profundidade), mas se chegar aqui: remove o PNG órfão que subiu antes do update e
      // falha alto — nunca o "Assinatura salva com sucesso" falso (invariante #9).
      if (!signed?.length) {
        await supabase.storage.from('fichas').remove([storagePath]);
        toast.error('Só o dentista autor pode assinar esta ficha.');
        return;
      }

      setEvolutions((prev) =>
        prev.map((e) =>
          e.id === signingFichaId
            ? { ...e, assinaturaUrl: storagePath, assinadoEm: assinadoEm }
            : e
        )
      );

      setSigningFichaId(null);
      toast.success('Assinatura salva com sucesso.');
    } catch (err) {
      console.error('[assinatura] Erro ao salvar:', err);
      toast.error('Erro ao salvar assinatura. Tente novamente.');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setEditingId(null);
    setSelectedTeeth([]);
    setSharedTeeth([]);    setSharedNotes(['']);
    setFormData({ dataAtendimento: hojeBRT(), type: "Evolução", observation: "", teethNotes: [], procedimentos: [], conduta: "", ortoManutencao: null });
    setEventosDraft([]);
    setDenteAberto(null);
    setPreenchidoPorDex(false);
  };

  const updateProcStatus = async (fichaId: string, currentStatus: Record<string, ProcStatus>, procKey: string, newStatus: ProcStatus) => {
    const updatedStatus = { ...currentStatus, [procKey]: newStatus };
    setEvolutions((prev) => prev.map((e) => e.id === fichaId ? { ...e, procedimentosStatus: updatedStatus } : e));
    setViewingEvo((prev) => prev?.id === fichaId ? { ...prev, procedimentosStatus: updatedStatus } : prev);
    const supabase = createClient();
    // .select() é obrigatório: a ficha agora é LIDA por toda a clínica mas só o autor
    // escreve (migration 099), e um UPDATE barrado por RLS não retorna erro — devolve
    // sucesso com 0 linhas. Sem isso a tela afirmaria o que o banco negou (invariante #9).
    const { data: afetadas, error } = await supabase
      .from('fichas')
      .update({ procedimentos_status: updatedStatus })
      .eq('id', fichaId)
      .eq('clinica_id', clinicaId)
      .select('id');
    if (error ?? !afetadas?.length) {
      console.error('[proc-status] recusado — revertendo', error);
      setEvolutions((prev) => prev.map((e) => e.id === fichaId ? { ...e, procedimentosStatus: currentStatus } : e));
      setViewingEvo((prev) => prev?.id === fichaId ? { ...prev, procedimentosStatus: currentStatus } : prev);
    }
  };

  const handleEdit = (evolution: Evolution) => {
    // Detecta grupo compartilhado: dentes com exatamente as mesmas notas (≥2 dentes)
    const realTeeth = evolution.teethNotes.filter((tn) => !(tn.tooth in ARCH_LABELS));
    const byNotes = new Map<string, number[]>();
    for (const tn of realTeeth) {
      const key = tn.notes.filter(Boolean).join('\n');
      if (key) byNotes.set(key, [...(byNotes.get(key) ?? []), tn.tooth]);
    }
    // Grupo com mais dentes (mín. 2) é o grupo compartilhado
    let detectedSharedGroup: { notes: string; teeth: number[] } | null = null;
    for (const [notes, teeth] of byNotes) {
      if (teeth.length > 1 && (!detectedSharedGroup || teeth.length > detectedSharedGroup.teeth.length)) {
        detectedSharedGroup = { notes, teeth };
      }
    }

    const sharedTeethSet = new Set(detectedSharedGroup?.teeth ?? []);
    const individualNotes = evolution.teethNotes.filter((tn) => !sharedTeethSet.has(tn.tooth));    setSharedTeeth(detectedSharedGroup?.teeth ?? []);
    setSharedNotes(
      detectedSharedGroup ? detectedSharedGroup.notes.split('\n').filter(Boolean) : ['']
    );
    setEditingId(evolution.id);
    setFormData({
      dataAtendimento: evolution.dataAtendimento,
      type: evolution.type,
      observation: evolution.observation,
      teethNotes: individualNotes.map((tn) => ({
        tooth: tn.tooth,
        notes: tn.notes.length > 0 ? [...tn.notes] : [''],
      })),
      procedimentos: evolution.procedimentos,
      conduta: evolution.conduta ?? '',
      ortoManutencao: evolution.ortoManutencao,
    });
    // Edição não recarrega eventos: reorganizar substitui, salvar sem reorganizar preserva.
    setEventosDraft([]);
    setSelectedTeeth(individualNotes.map((tn) => tn.tooth));
    setIsPanelOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("fichas")
        .delete()
        .eq("id", id)
        .eq("clinica_id", clinicaId);

      if (error) throw error;
      setEvolutions((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <DexLoader className="p-20" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-2xl text-text-primary">Histórico Clínico</h2>
        {!isPanelOpen && canWrite && (
          <Button
            onClick={() => setIsPanelOpen(true)}
            className="bg-teal hover:bg-teal-lt text-white rounded-xl px-6 py-5 font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(47,156,133,0.3)] transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Evolução
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4">
            {/* ═══════ FICHA ÚNICA (design definitivo 21/07, feedback da 1ª rodada) ═══════
                UM organismo, não três balões: campo mágico → meta → odontograma (esq) +
                perfil do dente (dir) → registros agrupados → anotações/conduta → ações.
                Divisores sutis separam as zonas; nada de cards soltos competindo. */}
            <div className="bg-surface border border-border rounded-2xl p-4 md:p-6 flex flex-col gap-5">

              {/* Campo mágico (Job A Fatia B) — não renderiza no perfil demo (§8: sem clínica real). */}
              {patientId !== 'demo' && (
                <CapturaLivreCard
                  pacienteNome={patientName ?? ''}
                  formDirty={formDirty}
                  onOrganizado={aplicarEvolucaoDoOrganizar}
                />
              )}

              {/* Meta — tipo + data, compactos no topo (artefato §02) */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Tipo de Registro
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  >
                    <option value="Avaliação">Avaliação</option>
                    <option value="Evolução">Evolução</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Urgência">Urgência</option>
                    <option value="Procedimento">Procedimento</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5 flex items-center">
                    Data do atendimento
                    <HelpTooltip content="Pode ser retroativa — útil pra lançar histórico de outro sistema. A ficha ordena por esta data, não pela data de digitação." />
                  </label>
                  <input
                    type="date"
                    value={formData.dataAtendimento}
                    max={hojeBRT()}
                    onChange={(e) => setFormData((f) => ({ ...f, dataAtendimento: e.target.value || hojeBRT() }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  />
                </div>
              </div>

              <div className="border-t border-border/60" />

              {/* Odontograma (esq) + perfil do dente (dir) — clicar no dente abre ao lado */}
              <div className="flex flex-col gap-3">
                  <Odontograma
                    eventos={eventosDraft.length > 0 ? eventosDraft : undefined}
                    selectedTeeth={selectedTeeth}
                    sharedTeeth={sharedTeeth}
                    historicalTeeth={editingId ? historicalTeeth : new Set<number>()}
                    onToothToggle={abrirDenteEDestacarRegistro}
                    hideFilters
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
                    <span className="text-[9.5px] font-bold uppercase tracking-widest text-text-secondary mr-1">Região</span>
                    {[
                      { id: ARCH_SUPERIOR, label: 'Arcada sup.' },
                      { id: ARCH_INFERIOR, label: 'Arcada inf.' },
                      { id: ARCH_COMPLETA, label: 'Boca toda' },
                      { id: QUAD_SUP_DIREITO, label: 'Q1' },
                      { id: QUAD_SUP_ESQUERDO, label: 'Q2' },
                      { id: QUAD_INF_ESQUERDO, label: 'Q3' },
                      { id: QUAD_INF_DIREITO, label: 'Q4' },
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleArch(id)}
                        className={`text-[10.5px] font-bold rounded-full px-2.5 py-1 border transition-colors ${
                          selectedTeeth.includes(id)
                            ? 'bg-teal border-teal text-white'
                            : 'bg-surface border-border text-text-secondary hover:border-teal hover:text-teal-ink'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

              {/* Perfil do dente — abre full-width ao tocar um dente (artefato §04) */}
              {denteAberto != null && (
                <ToothDetailPanel
                  dente={denteAberto}
                  eventos={eventosDraft}
                  onChange={setEventosDraft}
                  onClose={() => setDenteAberto(null)}
                  dataPadrao={formData.dataAtendimento}
                />
              )}

              <div className="border-t border-border/60" />

              {/* Registros — agrupados por dente/procedimento, obs por registro */}
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="font-heading text-lg text-text-primary">Registros da consulta</h3>
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {gruposDraft.length > 0 ? `${gruposDraft.length} registro${gruposDraft.length > 1 ? 's' : ''}` : 'nenhum ainda'}
                  </span>
                </div>

                {gruposDraft.length === 0 ? (
                  <div className="border border-dashed border-border rounded-2xl px-6 py-7 text-center">
                    <p className="font-heading text-base text-text-primary mb-1">Nenhum registro ainda</p>
                    <p className="text-xs text-text-secondary max-w-sm mx-auto">
                      Narre no campo mágico e toque &ldquo;Organizar&rdquo;, ou toque um dente no odontograma
                      para lançar à mão. Os registros aparecem aqui.
                    </p>
                  </div>
                ) : (
                  gruposDraft.map(({ chave, idxs, faces }) => {
                    const ev = eventosDraft[idxs[0]];
                    const dentes = [...new Set(idxs.map((i) => eventosDraft[i].ancora.dente).filter((d): d is number => d != null))];
                    const alvo = dentes.length === 0
                      ? (ev.ancora.arcada ? `arcada ${ev.ancora.arcada}` : ev.ancora.quadrante ? `quadrante ${ev.ancora.quadrante}` : 'boca')
                      : dentes.length === 1 ? `dente ${dentes[0]}` : `dentes ${dentes.join(' · ')}`;
                    const feito = ev.status === 'realizado';
                    // Só registro de UM evento tem tabela de especialidade — grupo multi-dente
                    // não tem "o" detalhe pra editar (mesma regra do ToothDetailPanel).
                    const temDetalhe = idxs.length === 1 && (ev.tipo === 'endodontia' || ev.tipo === 'implante');
                    const detalheAberto = temDetalhe && grupoDetalheAberto === chave;
                    const destacado = grupoDestacado === chave;
                    return (
                      <div
                        key={chave}
                        ref={(el) => {
                          if (el) registroCardRefs.current.set(chave, el);
                          else registroCardRefs.current.delete(chave);
                        }}
                        className={`bg-surface border rounded-xl overflow-hidden transition-shadow duration-300 ${
                          destacado ? 'border-teal ring-2 ring-teal/40' : 'border-dashed border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                          <span className="shrink-0 min-w-[30px] h-[30px] px-2 rounded-lg bg-surface-alt border border-border flex items-center justify-center font-mono text-xs font-bold text-text-primary">
                            {dentes.length === 1 ? dentes[0] : dentes.length > 1 ? `${dentes.length}×` : '—'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-text-primary">
                              {TIPO_LABEL[ev.tipo]}{faces ? ` ${faces}` : ''} · {alvo}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            feito ? 'bg-teal-pale text-teal-ink' : 'bg-coral-pale text-coral-ink'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${feito ? 'bg-teal' : 'bg-coral'}`} />
                            {feito ? 'Realizado' : 'Planejado'}
                          </span>
                          {temDetalhe && (
                            <button
                              type="button"
                              onClick={() => setGrupoDetalheAberto(detalheAberto ? null : chave)}
                              className="flex items-center gap-0.5 shrink-0 text-[10.5px] font-bold text-teal-ink outline-none focus-visible:ring-1 focus-visible:ring-teal rounded px-1"
                            >
                              Detalhes
                              <ChevronRight className={`w-3 h-3 transition-transform ${detalheAberto ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removerGrupoDraft(idxs)}
                            className="shrink-0 p-1 rounded-md text-text-secondary hover:text-coral-ink transition-colors"
                            aria-label="Remover registro"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 px-4 pb-3">
                          <span className="text-[9.5px] font-bold uppercase tracking-widest text-text-secondary shrink-0">Obs.</span>
                          <input
                            type="text"
                            value={ev.observacao}
                            onChange={(e) => atualizarObsGrupo(idxs, e.target.value)}
                            placeholder="material, técnica, intercorrência…"
                            className="flex-1 bg-surface-alt border border-dashed border-border rounded-lg px-3 py-1.5 text-xs italic text-text-primary outline-none focus:border-teal transition-colors"
                          />
                        </div>
                        {detalheAberto && (
                          <div className="px-4 pb-3 pt-1 border-t border-border/60 bg-surface-alt/40">
                            {ev.tipo === 'endodontia' && (
                              <EndoForm
                                valor={(ev.detalhe ?? null) as EndoDetalhe | null}
                                onChange={(v) => atualizarDetalheDraft(idxs[0], v)}
                              />
                            )}
                            {ev.tipo === 'implante' && (
                              <ImplanteForm
                                valor={(ev.detalhe ?? null) as ImplanteDetalhe | null}
                                onChange={(v) => atualizarDetalheDraft(idxs[0], v)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border/60" />

              {/* Anotações gerais + conduta + ações (zona 5 do definitivo, sem o bloco Procedimentos) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Anotações gerais
                  </label>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Evolução clínica em texto — o que não é procedimento estruturado."
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[80px] resize-y"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Conduta
                  </label>
                  <textarea
                    value={formData.conduta}
                    onChange={(e) => setFormData((f) => ({ ...f, conduta: e.target.value }))}
                    placeholder="Orientações ao paciente, cuidados pós-procedimento, prescrições..."
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[80px] resize-y"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  onClick={closePanel}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="bg-teal hover:bg-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] disabled:opacity-50"
                >
                  {isSaving ? (<Loader2 className="w-4 h-4 animate-spin" />) : (<Check className="w-4 h-4" />)}
                  {isSaving ? "Salvando..." : "Salvar Evolução"}
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {evolutions.length === 0 && !isPanelOpen && (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <FileText className="w-10 h-10 text-text-secondary/30 mx-auto mb-3" />
          <p className="text-text-secondary text-sm">
            Nenhuma evolução registrada. Clique em &ldquo;Nova Evolução&rdquo; para começar.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Lista cronológica plana — todas as fichas (modelo 1 ficha = 1 tratamento) */}
        {evolutions.length > 0 && (
          <div className="space-y-5">
            {evolutions.map((evo, idx) => {
              const isExpanded = viewingEvo?.id === evo.id;
              const validKeys = evo.teethNotes.flatMap((tn) =>
                tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`)
              );
              const totalProcs = validKeys.length;
              const doneProcs = validKeys.filter((k) => evo.procedimentosStatus[k] === 'concluido').length;
              const allDone = totalProcs > 0 && doneProcs === totalProcs;

              return (
              <motion.div
                key={evo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              >
                {/* ═══ Ficha salva — design definitivo (artefato §05, 21/07). Header 1 linha:
                    tipo · data · autor/CRO · contagem · pills · ações. Expandido: odontograma-
                    índice + registros (eventos OU derivação v2 no MESMO visual) + orto + textos. */}
                <div className={`bg-surface rounded-2xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'border-teal/50 shadow-lg' : 'border-border/60 shadow-sm'}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setDenteSalvoAberto(null); setViewingEvo(isExpanded ? null : evo); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDenteSalvoAberto(null); setViewingEvo(isExpanded ? null : evo); } }}
                    className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-lg text-text-primary truncate">
                        {evo.type} · <span className="font-mono text-base">{evo.date}</span>
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 truncate">
                        {evo.professional}
                        {evo.autorCro && <span className="font-mono"> — {evo.autorCro}</span>}
                        {' · '}
                        {evo.eventos.length > 0
                          ? `${evo.eventos.length} registro${evo.eventos.length > 1 ? 's' : ''}`
                          : `${totalProcs} procedimento${totalProcs !== 1 ? 's' : ''}`}
                        {evo.assinadoEm && <span className="text-teal-ink font-semibold"> · ✓ assinada</span>}
                      </p>
                    </div>

                    {evo.eventos.length > 0 ? (
                      (() => {
                        const feitos = evo.eventos.filter((e) => e.status === 'realizado').length;
                        const plan = evo.eventos.length - feitos;
                        return (
                          <span className="flex items-center gap-1.5 shrink-0">
                            {feitos > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-teal-pale text-teal-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal" />{feitos} feito{feitos > 1 ? 's' : ''}
                              </span>
                            )}
                            {plan > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-coral-pale text-coral-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-coral" />{plan} planejado{plan > 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                        );
                      })()
                    ) : totalProcs > 0 ? (
                      <span className={`inline-flex items-center gap-1.5 shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full ${allDone ? 'bg-teal-pale text-teal-ink' : 'bg-surface-alt text-text-secondary'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-teal' : 'bg-border-strong'}`} style={!allDone ? { background: 'var(--color-border)' } : undefined} />
                        {doneProcs}/{totalProcs} realizados
                      </span>
                    ) : null}

                    <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onGerarOrcamento && (
                        <button
                          onClick={() => onGerarOrcamento(evo.id)}
                          title="Gerar orçamento"
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-teal-ink hover:bg-teal-pale transition-colors"
                        >
                          Gerar orçamento
                        </button>
                      )}
                      {podeEditarFicha(evo) && (
                        <button
                          onClick={() => handleEdit(evo)}
                          title="Editar"
                          className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => window.open(`/api/fichas/${evo.id}/pdf`, '_blank')}
                        title="Baixar"
                        className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {podeEditarFicha(evo) && (
                        <button
                          onClick={() => setShowDeleteConfirm(evo.id)}
                          title="Excluir"
                          className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <span className={`p-1 text-text-secondary/40 transition-transform duration-300 inline-flex ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronRight className="w-4 h-4 -rotate-90" />
                      </span>
                    </span>
                  </div>

                  {/* Colapsada: 1 linha de resumo — o detalhe mora no expandido (feedback 21/07) */}
                  {!isExpanded && (
                    <div className="px-5 pb-4 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-text-secondary">
                      {(() => {
                        const dentes = evo.eventos.length > 0
                          ? [...new Set(evo.eventos.map((e) => e.ancora.dente).filter((d): d is number => d != null))]
                          : [...new Set(evo.teethNotes.map((tn) => tn.tooth).filter((t) => !(t in ARCH_LABELS)))];
                        const regioes = evo.eventos.length === 0
                          ? evo.teethNotes.map((tn) => tn.tooth).filter((t) => t in ARCH_LABELS).map((t) => ARCH_LABELS[t])
                          : [];
                        return (
                          <>
                            {dentes.sort((a, b) => a - b).length > 0 && (
                              <span className="font-mono">{dentes.map((d) => `D${d}`).join(' · ')}</span>
                            )}
                            {regioes.map((r) => <span key={r}>{r}</span>)}
                            {evo.ortoManutencao && <span className="text-slate-ink">· orto</span>}
                            <span className="text-text-secondary/50 font-normal">— toque para abrir</span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="aberta"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="border-t border-border/60 px-5 py-5 flex flex-col gap-4">

                          {/* Odontograma — índice: clicar um dente abre o perfil (readOnly) */}
                          <div className="bg-surface-alt/40 border border-border/60 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <p className="font-heading text-base text-text-primary">Odontograma — índice</p>
                              <p className="text-[10.5px] text-text-secondary italic">toque um dente para ver o perfil</p>
                            </div>
                            <Odontograma
                              eventos={evo.eventos.length > 0 ? evo.eventos.map(eventoViewParaDraft) : undefined}
                              selectedTeeth={evo.eventos.length > 0 ? [] : evo.teethNotes.map((tn) => tn.tooth)}
                              onToothToggle={(d) => setDenteSalvoAberto((cur) => cur?.fichaId === evo.id && cur.dente === d ? null : { fichaId: evo.id, dente: d })}
                              compact
                              hideFilters
                            />
                          </div>

                          {denteSalvoAberto?.fichaId === evo.id && (
                            <ToothDetailPanel
                              dente={denteSalvoAberto.dente}
                              eventos={evo.eventos.map(eventoViewParaDraft)}
                              onChange={() => {}}
                              onClose={() => setDenteSalvoAberto(null)}
                              dataPadrao={evo.dataAtendimento}
                              readOnly
                            />
                          )}

                          {/* Registros — eventos (novo modelo) OU derivação v2 no MESMO visual */}
                          {evo.eventos.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {eventosParaCards(evo.eventos, evo.professional, evo.autorCro, evo.assinadoEm != null).map(({ key, ids, data }) => (
                                <RegistroCard
                                  key={key}
                                  data={data}
                                  onToggleStatus={
                                    podeEditarFicha(evo) && !evo.assinadoEm
                                      ? () => void toggleStatusRegistro(evo, ids, data.status)
                                      : undefined
                                  }
                                >
                                  {corpoEspecialidade(data.tipo, data.detalhe)}
                                </RegistroCard>
                              ))}
                            </div>
                          ) : evo.teethNotes.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {evo.teethNotes.flatMap((tn) =>
                                tn.notes.filter(Boolean).map((nota, i) => {
                                  const k = `${tn.tooth}_${i}`;
                                  const st: ProcStatus = evo.procedimentosStatus[k] ?? 'nao_iniciado';
                                  const meta = STATUS_META[st];
                                  const StatusIcon = meta.icon;
                                  const editavel = podeEditarFicha(evo);
                                  return (
                                    <div key={k} className="bg-surface border border-border rounded-xl flex items-center gap-3 px-4 py-2.5 flex-wrap">
                                      <span className="shrink-0 min-w-[30px] h-[30px] px-2 rounded-lg bg-surface-alt border border-border flex items-center justify-center font-mono text-[11px] font-bold text-text-primary">
                                        {tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : tn.tooth}
                                      </span>
                                      <p className="min-w-0 flex-1 text-sm font-medium text-text-primary">{nota}</p>
                                      <button
                                        type="button"
                                        disabled={!editavel}
                                        onClick={() => editavel && void updateProcStatus(evo.id, evo.procedimentosStatus, k, STATUS_CYCLE[st])}
                                        className={`inline-flex items-center gap-1.5 shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full border transition-colors ${meta.className} ${!editavel ? 'cursor-default opacity-70' : ''}`}
                                      >
                                        <StatusIcon className="w-3 h-3" />
                                        {meta.label}
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}

                          {evo.ortoManutencao && (
                            <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                              <OrtoCard valor={evo.ortoManutencao} />
                            </div>
                          )}

                          {/* Assinatura por procedimento (artefato §07) — sai do topo, vem
                              pro rodapé mostrando O QUE ela cobre. Planejado não assina. */}
                          {podeEditarFicha(evo) && !evo.assinadoEm && (() => {
                            const realizados = evo.eventos.filter((e) => e.status === 'realizado');
                            const legado = evo.eventos.length === 0 && totalProcs > 0;
                            if (realizados.length === 0 && !legado) return null;
                            return (
                              <div className="border border-teal/40 bg-teal-pale/40 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold uppercase tracking-widest text-teal-ink mb-0.5">
                                    Assinatura do paciente
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    {legado
                                      ? `Cobre os ${doneProcs} procedimento${doneProcs !== 1 ? 's' : ''} concluído${doneProcs !== 1 ? 's' : ''} desta ficha.`
                                      : `Cobre ${realizados.length} procedimento${realizados.length > 1 ? 's' : ''} realizado${realizados.length > 1 ? 's' : ''}: ${realizados.map((e) => `${TIPO_LABEL[e.tipo]}${e.ancora.dente ? ` ${e.ancora.dente}` : ''}`).join(' · ')}`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setSigningFichaId(evo.id)}
                                  className="shrink-0 bg-teal hover:bg-teal-lt text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors"
                                >
                                  <PenLine className="w-3.5 h-3.5" />
                                  Coletar assinatura
                                </button>
                              </div>
                            );
                          })()}

                          {(evo.observation || evo.conduta) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {evo.observation && (
                                <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Anotações gerais</p>
                                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{evo.observation}</p>
                                </div>
                              )}
                              {evo.conduta && (
                                <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Conduta</p>
                                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{evo.conduta}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              );
            })}
          </div>
        )}

      </div>

      {/* Dialog: Assinatura do Paciente */}
      <Dialog open={!!signingFichaId} onOpenChange={(open) => { if (!open) setSigningFichaId(null); }}>
        <DialogContent className="max-w-md rounded-2xl bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-text-primary flex items-center gap-2">
              <PenLine className="w-5 h-5 text-teal" />
              Assinatura do Paciente
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-sm">
              Vire a tela para o paciente e peça que assine com o dedo ou mouse.
            </DialogDescription>
          </DialogHeader>

          <SignaturePad padRef={signaturePadRef} />

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setSigningFichaId(null)}
              disabled={isSavingSignature}
              className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveSignature()}
              disabled={isSavingSignature}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl"
            >
              {isSavingSignature ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Confirmar assinatura</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-border/40"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-heading text-2xl text-text-primary mb-2">Excluir Evolução?</h3>
              <p className="text-text-secondary text-sm mb-8">
                Esta ação não pode ser desfeita. O registro será removido permanentemente.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleDelete(showDeleteConfirm)}
                  className="flex-1 bg-red-500 text-white hover:bg-red-600 rounded-xl"
                >
                  Excluir
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

