'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  X,
  Calendar,
  Download,
  Loader2,
  Presentation,
  ChevronDown,
  ChevronUp,
  Clock,
  Circle,
  Activity,
  Zap,
  Filter,
  AlertTriangle,
  FileText,
  Square,
  Edit2,
  MoreHorizontal,
} from 'lucide-react';
import {
  buscarFichasSemTratamento,
  criarTratamento,
  buscarTratamentoAtivo,
  buscarTratamentosPendentes,
  buscarHistoricoTratamentos,
  encerrarTratamento,
  excluirTratamento,
  renomearTratamento,
  tornarPrincipal,
  type Tratamento,
  type FichaSemTratamento,
} from '@/app/dashboard/pacientes/[id]/tratamento-actions';
import { ApresentarPanel } from '@/components/pacientes/ApresentarPanel';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { Odontograma, TOOTH_NAMES } from '@/components/odontograma/Odontograma';
import { getProcStatus } from '@/lib/constants/treatment-status';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isUUID = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

function getQuadrantForTooth(tooth: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' | null {
  if (tooth >= 11 && tooth <= 18) return 'Q1';
  if (tooth >= 21 && tooth <= 28) return 'Q2';
  if (tooth >= 31 && tooth <= 38) return 'Q3';
  if (tooth >= 41 && tooth <= 48) return 'Q4';
  return null;
}

const Q_LABELS: Record<string, { short: string; long: string; teeth: number[] }> = {
  Q1: { short: 'Sup. Dir.', long: 'Superior Direito', teeth: [11,12,13,14,15,16,17,18] },
  Q2: { short: 'Sup. Esq.', long: 'Superior Esquerdo', teeth: [21,22,23,24,25,26,27,28] },
  Q3: { short: 'Inf. Esq.', long: 'Inferior Esquerdo', teeth: [31,32,33,34,35,36,37,38] },
  Q4: { short: 'Inf. Dir.', long: 'Inferior Direito', teeth: [41,42,43,44,45,46,47,48] },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  url: string;
}

interface Section {
  id: string;
  title: string;
  content: string;
  imageIds: string[];
  status: 'pendente' | 'em_andamento' | 'concluido';
  dataEstimada: string | null;
}

interface PlanProc {
  id: string;
  descricao: string;
  dente: number | null;
  status: 'pendente' | 'agendado' | 'concluido';
  fichaRef: string | null;
  ordem: number;
}

interface BudgetProcedure {
  id: string;
  name: string;
  value: number;
}

interface PlanejamentoTabProps {
  patientId: string;
  clinicaId: string;
  patientName: string;
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function mapPlanProc(row: Record<string, unknown>): PlanProc {
  return {
    id: row.id as string,
    descricao: row.descricao as string,
    dente: row.dente as number | null,
    status: (row.status as PlanProc['status']) ?? 'pendente',
    fichaRef: row.ficha_ref as string | null,
    ordem: row.ordem as number,
  };
}

function dedupProcs(procs: PlanProc[]): PlanProc[] {
  const seen = new Set<string>();
  return procs.filter(p => {
    const key = p.fichaRef ?? p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Inline sub-components ────────────────────────────────────────────────────

function ProcCard({
  proc,
  onStatusCycle,
  onSchedule,
  updating,
}: {
  proc: PlanProc;
  onStatusCycle: () => void;
  onSchedule: () => void;
  updating: boolean;
}) {
  const st = getProcStatus(proc.status);
  return (
    <div className="bg-surface-alt/40 border border-border/50 rounded-2xl p-3.5 flex flex-col gap-3 hover:border-border transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {proc.dente && (
            <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-1">
              Dente {proc.dente}
              {TOOTH_NAMES[proc.dente] ? ` · ${TOOTH_NAMES[proc.dente]}` : ''}
            </div>
          )}
          <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
            {proc.descricao}
          </p>
        </div>
        {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal shrink-0 mt-0.5" />}
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={onStatusCycle}
          disabled={updating}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${st.className}`}
        >
          {proc.status === 'concluido' ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : proc.status === 'agendado' ? (
            <Clock className="w-3 h-3" />
          ) : (
            <Circle className="w-3 h-3" />
          )}
          {st.label}
        </button>
        {proc.status !== 'concluido' && (
          <button
            onClick={onSchedule}
            className="ml-auto p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors border border-transparent hover:border-teal/20"
            title="Ir para agendamentos"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanejamentoTab({ patientId, clinicaId, patientName }: PlanejamentoTabProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [budgetProcedures, setBudgetProcedures] = useState<BudgetProcedure[]>([]);
  const [budgetExists, setBudgetExists] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [clinicaLogoUrl, setClinicaLogoUrl] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // Treatment Map
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [fichaDateMap, setFichaDateMap] = useState<Record<string, string>>({});
  const [mapExpanded, setMapExpanded] = useState(true);

  // Treatment state
  const [tratamentoAtivo, setTratamentoAtivo] = useState<Tratamento | null>(null);
  const [tratamentosPendentes, setTratamentosPendentes] = useState<Tratamento[]>([]);
  const [historicoTratamentos, setHistoricoTratamentos] = useState<Tratamento[]>([]);
  const [loadingTratamento, setLoadingTratamento] = useState(true);

  // Review mode — visualizar tratamento em pausa ou concluído no Mapa
  const [reviewingTratamento, setReviewingTratamento] = useState<Tratamento | null>(null);
  const [reviewData, setReviewData] = useState<{ planProcs: PlanProc[]; fichaDateMap: Record<string, string> } | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [tornarPrincipalId, setTornarPrincipalId] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [modalIniciarOpen, setModalIniciarOpen] = useState(false);
  const [fichasSemTratamento, setFichasSemTratamento] = useState<FichaSemTratamento[]>([]);
  const [fichasSelecionadas, setFichasSelecionadas] = useState<Set<string>>(new Set());
  const [salvandoTratamento, setSalvandoTratamento] = useState(false);
  const [loadingFichasSemTrat, setLoadingFichasSemTrat] = useState(false);
  const [tratamentoError, setTratamentoError] = useState<string | null>(null);
  const [confirmarEncerramentoOpen, setConfirmarEncerramentoOpen] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [confirmarExclusaoOpen, setConfirmarExclusaoOpen] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusaoHistId, setConfirmarExclusaoHistId] = useState<string | null>(null);
  const [excluindoHist, setExcluindoHist] = useState(false);

  // Apresentar panel
  const [apresentarOpen, setApresentarOpen] = useState(false);

  // More menu (Renomear / Encerrar / Excluir)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Renomear modal
  const [renomearOpen, setRenomearOpen] = useState(false);
  const [novoNomeTratamento, setNovoNomeTratamento] = useState('');
  const [renomeando, setRenomeando] = useState(false);

  // Concluded treatment inline expansion
  const [expandedConcluidoId, setExpandedConcluidoId] = useState<string | null>(null);
  const [concluidoData, setConcluidoData] = useState<{
    planProcs: PlanProc[];
    fichaDateMap: Record<string, string>;
  } | null>(null);
  const [loadingConcluido, setLoadingConcluido] = useState(false);

  const router = useRouter();

  const [planProcs, setPlanProcs] = useState<PlanProc[]>([]);
  const [updatingProcId, setUpdatingProcId] = useState<string | null>(null);

  const sectionsRef = useRef<Section[]>([]);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node))
        setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  const fetchGlobalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();
      const [docsResult, budgetResult, secoesResult] = await Promise.all([
        supabase.from('paciente_documentos').select('*').eq('paciente_id', patientId).in('categoria', ['Radiografias', 'Fotografias']),
        supabase.from('orcamentos').select('*, orcamento_itens(*)').eq('paciente_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('planejamento_secoes').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
      ]);
      if (docsResult.error) throw docsResult.error;
      setDocuments((docsResult.data ?? []).map((doc: Record<string, unknown>) => ({
        id: doc.id as string, name: doc.nome as string, category: doc.categoria as string,
        url: doc.url as string, thumbnail: (doc.thumbnail as string | undefined) ?? (doc.url as string),
      })));
      if (budgetResult.error) throw budgetResult.error;
      if (budgetResult.data) {
        setBudgetExists(true);
        setBudgetProcedures((budgetResult.data.orcamento_itens as Array<Record<string, unknown>> ?? []).map(p => ({
          id: p.id as string, name: p.descricao as string, value: p.preco_total as number,
        })));
      } else {
        setBudgetExists(false);
        setBudgetProcedures([]);
      }
      if (secoesResult.error) throw secoesResult.error;
      if (secoesResult.data && secoesResult.data.length > 0) {
        setSections((secoesResult.data as Array<Record<string, unknown>>).map(row => ({
          id: row.id as string, title: row.titulo as string, content: (row.conteudo as string) ?? '',
          imageIds: (row.imagem_ids as string[]) ?? [], status: ((row.status as string) ?? 'pendente') as Section['status'],
          dataEstimada: (row.data_estimada as string | null) ?? null,
        })));
      }
    } catch (error) {
      console.error('Erro ao buscar dados globais:', JSON.stringify(error), error);
    } finally {
      setLoadingData(false);
    }
  }, [patientId]);

  const fetchTratamentoData = useCallback(async (tratamentoId: string | null) => {
    if (!tratamentoId) {
      setPlanProcs([]);
      setFichaDateMap({});
      return;
    }
    const supabase = createClient();
    type FichaRow = { id: string; created_at: string; dentes_observacoes: Record<string, string> | null };
    const [fichasResult, existingProcsResult] = await Promise.all([
      supabase.from('fichas').select('id, created_at, dentes_observacoes').eq('paciente_id', patientId).eq('tratamento_id', tratamentoId).not('dentes_observacoes', 'is', null),
      supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
    ]);
    // Only consider fichas that actually have tooth observations
    const allFichas = (fichasResult.data ?? []) as FichaRow[];
    const fichas = allFichas.filter(f => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0);
    const fichaIds = new Set(fichas.map(f => f.id));
    const dateMap: Record<string, string> = {};
    for (const f of fichas) dateMap[f.id] = f.created_at;
    setFichaDateMap(dateMap);

    const rawProcs: { fichaRef: string; descricao: string; dente: number }[] = [];
    for (const ficha of fichas) {
      const obs = ficha.dentes_observacoes ?? {};
      for (const [dente, desc] of Object.entries(obs)) {
        if (typeof desc === 'string' && desc.trim()) {
          desc.split('\n').filter(Boolean).forEach((line, idx) => {
            rawProcs.push({ fichaRef: `${ficha.id}::${dente}::${idx}`, descricao: line.trim(), dente: parseInt(dente, 10) });
          });
        }
      }
    }
    const filterByTrat = (procs: PlanProc[]) => procs.filter(p => { const id = p.fichaRef?.split('::')?.[0]; return id !== undefined && fichaIds.has(id); });

    // Clean up any orphaned procs whose ficha no longer exists (belt-and-suspenders — trigger handles it on delete, this catches any that slipped through)
    const orphanIds = (existingProcsResult.data ?? [])
      .filter((p: Record<string, unknown>) => {
        const fichaId = (p.ficha_ref as string | null)?.split('::')?.[0];
        return fichaId !== undefined && !fichaIds.has(fichaId);
      })
      .map((p: Record<string, unknown>) => p.id as string);
    if (orphanIds.length > 0) {
      void supabase.from('planejamento_procedimentos').delete().in('id', orphanIds);
    }

    const existingRefs = new Set((existingProcsResult.data ?? []).map((p: Record<string, unknown>) => p.ficha_ref as string));
    const toInsert = rawProcs.filter(p => !existingRefs.has(p.fichaRef));
    if (toInsert.length > 0) {
      const startOrdem = (existingProcsResult.data ?? []).length;
      await supabase.from('planejamento_procedimentos').insert(toInsert.map((p, i) => ({
        clinica_id: clinicaId, paciente_id: patientId, descricao: p.descricao, dente: p.dente, status: 'pendente', ficha_ref: p.fichaRef, ordem: startOrdem + i,
      })));
      const { data: refreshed } = await supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true });
      setPlanProcs(filterByTrat(dedupProcs((refreshed ?? []).map(r => mapPlanProc(r as Record<string, unknown>)))));
    } else {
      setPlanProcs(filterByTrat(dedupProcs((existingProcsResult.data ?? []).map(r => mapPlanProc(r as Record<string, unknown>)))));
    }
  }, [patientId, clinicaId]);

  useEffect(() => {
    if (patientId) void fetchGlobalData();
  }, [patientId, fetchGlobalData]);

  const loadTratamento = useCallback(async () => {
    setLoadingTratamento(true);
    const [ativoResult, pendentesResult, historicoResult] = await Promise.all([
      buscarTratamentoAtivo(patientId),
      buscarTratamentosPendentes(patientId),
      buscarHistoricoTratamentos(patientId),
    ]);
    setTratamentoAtivo(ativoResult.tratamento);
    setTratamentosPendentes(pendentesResult.tratamentos);
    setHistoricoTratamentos(historicoResult.tratamentos);
    setLoadingTratamento(false);
    await fetchTratamentoData(ativoResult.tratamento?.id ?? null);
  }, [patientId, fetchTratamentoData]);

  useEffect(() => {
    if (patientId) void loadTratamento();
  }, [patientId, loadTratamento]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from('configuracoes_clinica')
      .select('logo_url')
      .eq('clinica_id', clinicaId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setClinicaLogoUrl(data.logo_url as string);
      });
  }, [clinicaId]);

  const handleAbrirModalIniciar = async () => {
    setLoadingFichasSemTrat(true);
    setModalIniciarOpen(true);
    setFichasSelecionadas(new Set());
    setTratamentoError(null);
    const { fichas } = await buscarFichasSemTratamento(patientId);
    setFichasSemTratamento(fichas);
    setLoadingFichasSemTrat(false);
  };

  const toggleFicha = (id: string) => {
    setFichasSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleIniciarTratamento = async () => {
    if (fichasSelecionadas.size === 0) return;
    setSalvandoTratamento(true);
    setTratamentoError(null);
    const { error } = await criarTratamento(patientId, null, Array.from(fichasSelecionadas));
    if (error) {
      setTratamentoError(error);
    } else {
      setModalIniciarOpen(false);
      await loadTratamento();
    }
    setSalvandoTratamento(false);
  };

  const handleEncerrarTratamento = async () => {
    if (!tratamentoAtivo) return;
    setEncerrando(true);
    const { error } = await encerrarTratamento(tratamentoAtivo.id, patientId);
    if (!error) {
      setConfirmarEncerramentoOpen(false);
      await loadTratamento();
    }
    setEncerrando(false);
  };

  const handleExcluirTratamento = async () => {
    if (!tratamentoAtivo) return;
    setExcluindo(true);
    const { error } = await excluirTratamento(tratamentoAtivo.id, patientId);
    if (!error) {
      setConfirmarExclusaoOpen(false);
      await loadTratamento();
    }
    setExcluindo(false);
  };

  const handleExcluirHistorico = async () => {
    if (!confirmarExclusaoHistId) return;
    setExcluindoHist(true);
    const { error } = await excluirTratamento(confirmarExclusaoHistId, patientId);
    if (!error) {
      setHistoricoTratamentos(prev => prev.filter(t => t.id !== confirmarExclusaoHistId));
      if (expandedConcluidoId === confirmarExclusaoHistId) setExpandedConcluidoId(null);
      setConfirmarExclusaoHistId(null);
    }
    setExcluindoHist(false);
  };

  const handleRenomearTratamento = async () => {
    if (!tratamentoAtivo || !novoNomeTratamento.trim()) return;
    setRenomeando(true);
    const { error } = await renomearTratamento(tratamentoAtivo.id, novoNomeTratamento, patientId);
    if (!error) {
      setTratamentoAtivo(prev => prev ? { ...prev, nome: novoNomeTratamento.trim() } : prev);
      setRenomearOpen(false);
      setNovoNomeTratamento('');
    }
    setRenomeando(false);
  };

  const handleToggleConcluido = async (tratamento: Tratamento) => {
    if (expandedConcluidoId === tratamento.id) {
      setExpandedConcluidoId(null);
      setConcluidoData(null);
      return;
    }
    setExpandedConcluidoId(tratamento.id);
    setConcluidoData(null);
    setLoadingConcluido(true);
    const supabase = createClient();
    type FichaRow = { id: string; created_at: string; dentes_observacoes: Record<string, string> | null };
    const [fichasResult, allProcsResult] = await Promise.all([
      supabase.from('fichas').select('id, created_at, dentes_observacoes').eq('paciente_id', patientId).eq('tratamento_id', tratamento.id),
      supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
    ]);
    const allFichasConcluido = (fichasResult.data ?? []) as FichaRow[];
    const fichas = allFichasConcluido.filter(f => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0);
    const fichaIds = new Set(fichas.map(f => f.id));
    const dateMap: Record<string, string> = {};
    for (const f of fichas) dateMap[f.id] = f.created_at;
    const filtered = dedupProcs(
      (allProcsResult.data ?? [])
        .map(r => mapPlanProc(r as Record<string, unknown>))
        .filter(p => { const id = p.fichaRef?.split('::')?.[0]; return id !== undefined && fichaIds.has(id); })
    );
    setConcluidoData({ planProcs: filtered, fichaDateMap: dateMap });
    setLoadingConcluido(false);
  };

  const handleReviewTratamento = async (t: Tratamento) => {
    if (reviewingTratamento?.id === t.id) {
      setReviewingTratamento(null);
      setReviewData(null);
      setSelectedTooth(null);
      return;
    }
    setReviewingTratamento(t);
    setReviewData(null);
    setLoadingReview(true);
    setSelectedTooth(null);
    const supabase = createClient();
    type FichaRow = { id: string; created_at: string; dentes_observacoes: Record<string, string> | null };
    const [fichasResult, allProcsResult] = await Promise.all([
      supabase.from('fichas').select('id, created_at, dentes_observacoes').eq('paciente_id', patientId).eq('tratamento_id', t.id),
      supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
    ]);
    const allFichas = (fichasResult.data ?? []) as FichaRow[];
    const fichas = allFichas.filter(f => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0);
    const fichaIds = new Set(fichas.map(f => f.id));
    const dateMap: Record<string, string> = {};
    for (const f of fichas) dateMap[f.id] = f.created_at;
    const filtered = dedupProcs(
      (allProcsResult.data ?? [])
        .map(r => mapPlanProc(r as Record<string, unknown>))
        .filter(p => { const id = p.fichaRef?.split('::')?.[0]; return id !== undefined && fichaIds.has(id); })
    );
    setReviewData({ planProcs: filtered, fichaDateMap: dateMap });
    setLoadingReview(false);
  };

  const handleTornarPrincipal = async (t: Tratamento) => {
    setTornarPrincipalId(t.id);
    const { error } = await tornarPrincipal(t.id, patientId);
    if (!error) {
      setReviewingTratamento(null);
      setReviewData(null);
      setSelectedTooth(null);
      await loadTratamento();
    } else {
      toast.error(error);
    }
    setTornarPrincipalId(null);
  };

  // ── Computed values ──────────────────────────────────────────────────────────

  // When reviewing, show the reviewed treatment's data in the Mapa
  const displayProcs = reviewingTratamento ? (reviewData?.planProcs ?? []) : planProcs;
  const displayFichaDateMap = reviewingTratamento ? (reviewData?.fichaDateMap ?? {}) : fichaDateMap;
  const displayTratamento = reviewingTratamento ?? tratamentoAtivo;

  const treatedTeeth = useMemo(() => {
    const teeth = new Set<number>();
    for (const p of displayProcs) {
      if (p.dente) teeth.add(p.dente);
    }
    return teeth;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProcs]);

  const concludedTeeth = useMemo(() => {
    const teeth = new Set<number>();
    for (const p of displayProcs) {
      if (p.dente && p.status === 'concluido') teeth.add(p.dente);
    }
    return teeth;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProcs]);

  const filteredProcs = useMemo(() =>
    selectedTooth ? displayProcs.filter(p => p.dente === selectedTooth) : displayProcs,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayProcs, selectedTooth]
  );

  const timelineSessions = useMemo(() => {
    const sessionsMap = new Map<string, PlanProc[]>();
    for (const proc of filteredProcs) {
      const fichaId = proc.fichaRef?.split('::')[0] ?? '__unknown__';
      if (!sessionsMap.has(fichaId)) sessionsMap.set(fichaId, []);
      sessionsMap.get(fichaId)!.push(proc);
    }
    return Array.from(sessionsMap.entries())
      .sort((a, b) => {
        const dateA = displayFichaDateMap[a[0]] ?? '';
        const dateB = displayFichaDateMap[b[0]] ?? '';
        return dateB.localeCompare(dateA);
      })
      .map(([fichaId, procs], idx) => ({
        fichaId,
        date: displayFichaDateMap[fichaId] ?? null,
        sessionNumber: idx + 1,
        procedures: procs.sort((a, b) => (a.dente ?? 0) - (b.dente ?? 0)),
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProcs, displayFichaDateMap]);

  const quadrantStats = useMemo(() => {
    return Object.entries(Q_LABELS).map(([key, meta]) => {
      const procs = displayProcs.filter(p => p.dente && meta.teeth.includes(p.dente));
      const done = procs.filter(p => p.status === 'concluido').length;
      return { key, ...meta, total: procs.length, done };
    }).filter(q => q.total > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProcs]);

  const intelligenceMessages = useMemo(() => {
    const msgs: { text: string; type: 'info' | 'warning' | 'success' }[] = [];

    const pending = displayProcs.filter(p => p.status === 'pendente').length;
    const done = displayProcs.filter(p => p.status === 'concluido').length;
    const total = displayProcs.length;

    if (total === 0) return msgs;

    if (done === total) {
      msgs.push({ text: 'Tratamento concluído', type: 'success' });
      return msgs;
    }

    if (pending > 0) msgs.push({ text: `${pending} procedimento${pending !== 1 ? 's' : ''} pendente${pending !== 1 ? 's' : ''}`, type: 'info' });

    const completedQuads = quadrantStats.filter(q => q.done > 0 && q.done === q.total);
    if (completedQuads.length > 0) {
      msgs.push({ text: `Quadrante${completedQuads.length > 1 ? 's' : ''} ${completedQuads.map(q => q.short).join(', ')} concluído${completedQuads.length > 1 ? 's' : ''}`, type: 'success' });
    }

    const allDates = Object.values(displayFichaDateMap).sort((a, b) => b.localeCompare(a));
    if (allDates.length > 0) {
      const lastDate = parseISO(allDates[0]);
      const daysSince = differenceInDays(new Date(), lastDate);
      if (daysSince > 30) {
        msgs.push({ text: `Última sessão há ${daysSince} dias`, type: 'warning' });
      }
    }

    return msgs.slice(0, 3);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProcs, quadrantStats, displayFichaDateMap]);

  const concluidosCount = displayProcs.filter(p => p.status === 'concluido').length;
  const progressPercent = displayProcs.length > 0
    ? Math.round((concluidosCount / displayProcs.length) * 100)
    : 0;

  const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);

  // ── Tooth detail (selected tooth procedures) ──────────────────────────────

  const selectedToothProcs = useMemo(() =>
    selectedTooth ? displayProcs.filter(p => p.dente === selectedTooth) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayProcs, selectedTooth]
  );

  // ── Proc actions ──────────────────────────────────────────────────────────

  const getNextStatus = (s: PlanProc['status']): PlanProc['status'] => {
    if (s === 'pendente') return 'agendado';
    if (s === 'agendado') return 'concluido';
    return 'pendente';
  };

  /**
   * Sincroniza status de conclusão de procedimento com a tabela fichas.
   * fichaRef = "fichaId::dente::lineIndex"
   * fichaKey  = "dente_lineIndex" (chave em procedimentos_concluidos)
   */
  async function syncFichaConclusion(
    supabase: ReturnType<typeof createClient>,
    fichaRef: string | null,
    newStatus: PlanProc['status']
  ): Promise<void> {
    if (!fichaRef) return;

    const parts = fichaRef.split('::');
    if (parts.length !== 3) return;
    const [fichaId, dente, lineIndex] = parts;
    const fichaKey = `${dente}_${lineIndex}`;

    try {
      const { data } = await supabase
        .from('fichas')
        .select('procedimentos_concluidos')
        .eq('id', fichaId)
        .single();

      const current: string[] = (data as { procedimentos_concluidos: string[] } | null)
        ?.procedimentos_concluidos ?? [];

      if (newStatus === 'concluido') {
        if (current.includes(fichaKey)) return;
        await supabase
          .from('fichas')
          .update({ procedimentos_concluidos: [...current, fichaKey] })
          .eq('id', fichaId)
          .eq('clinica_id', clinicaId);
      } else {
        await supabase
          .from('fichas')
          .update({ procedimentos_concluidos: current.filter(k => k !== fichaKey) })
          .eq('id', fichaId)
          .eq('clinica_id', clinicaId);
      }
    } catch (err) {
      console.warn('[syncFichaConclusion] best-effort sync falhou:', err);
    }
  }

  const updateProcStatus = async (procId: string, newStatus: PlanProc['status']): Promise<void> => {
    setUpdatingProcId(procId);
    const proc = planProcs.find(p => p.id === procId);
    setPlanProcs(prev => prev.map(p => p.id === procId ? { ...p, status: newStatus } : p));

    const supabase = createClient();
    await supabase
      .from('planejamento_procedimentos')
      .update({ status: newStatus })
      .eq('id', procId);

    if (proc) {
      await syncFichaConclusion(supabase, proc.fichaRef ?? null, newStatus);
    }

    setUpdatingProcId(null);
  };

  // ── Section helpers ───────────────────────────────────────────────────────

  const saveSectionToDb = useCallback(async (sectionId: string): Promise<void> => {
    const section = sectionsRef.current.find(s => s.id === sectionId);
    if (!section) return;

    setSavingIds(prev => new Set([...prev, sectionId]));
    try {
      const supabase = createClient();
      const idx = sectionsRef.current.findIndex(s => s.id === sectionId);

      if (isUUID(section.id)) {
        await supabase.from('planejamento_secoes').upsert({
          id: section.id,
          clinica_id: clinicaId,
          paciente_id: patientId,
          titulo: section.title,
          conteudo: section.content,
          imagem_ids: section.imageIds,
          ordem: idx,
          status: section.status,
          data_estimada: section.dataEstimada || null,
          updated_at: new Date().toISOString(),
        });
      } else {
        const { data } = await supabase
          .from('planejamento_secoes')
          .insert({
            clinica_id: clinicaId,
            paciente_id: patientId,
            titulo: section.title,
            conteudo: section.content,
            imagem_ids: section.imageIds,
            ordem: idx,
            status: section.status,
            data_estimada: section.dataEstimada || null,
          })
          .select('id')
          .single();

        if (data) {
          const newId = (data as Record<string, unknown>).id as string;
          setSections(prev => prev.map(s => s.id === sectionId ? { ...s, id: newId } : s));
        }
      }
    } catch (error) {
      console.error('Erro ao salvar seção:', error);
    } finally {
      setSavingIds(prev => { const next = new Set(prev); next.delete(sectionId); return next; });
    }
  }, [clinicaId, patientId]);

  const generateSectionWithAI = async (sectionId: string): Promise<void> => {
    const section = sections.find(s => s.id === sectionId);
    if (!section?.title) return;
    setIsGeneratingAI(sectionId);
    try {
      const response = await fetch('/api/gerar-planejamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: section.title,
          procedimentos: budgetProcedures.map(p => p.name),
          pacienteNome: patientName,
        }),
      });
      if (!response.ok) throw new Error('Falha ao gerar');
      const data = await response.json() as { texto?: string };
      if (data.texto) updateSection(sectionId, 'content', data.texto);
    } catch (error) {
      console.error('Erro ao gerar com IA:', error);
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const generateFullPlanWithAI = async (): Promise<void> => {
    setIsGeneratingAI('__full__');
    try {
      const response = await fetch('/api/gerar-planejamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completo: true,
          procedimentos: [
            ...budgetProcedures.map(p => p.name),
            ...planProcs.map(p => p.descricao),
          ].filter((v, i, arr) => arr.indexOf(v) === i),
          pacienteNome: patientName,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? 'Falha ao gerar apresentação');
      }
      const data = await response.json() as { secoes?: Array<{ title: string; content: string }> };
      if (data.secoes && data.secoes.length > 0) {
        setSections(data.secoes.map((s, i) => ({
          id: `ai-gen-${Date.now()}-${i}`,
          title: s.title,
          content: s.content,
          imageIds: [],
          status: 'pendente' as const,
          dataEstimada: null,
        })));
        toast.success('Apresentação gerada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao gerar apresentação:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar apresentação');
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const handleGerarPDF = async () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    // Convert clinic logo to base64 so it works in the print window without CORS issues
    let logoBase64 = '';
    if (clinicaLogoUrl) {
      try {
        const resp = await fetch(clinicaLogoUrl);
        const blob = await resp.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* logo unavailable, continue without it */ }
    }

    const logoHTML = logoBase64
      ? `<img src="${logoBase64}" class="clinica-logo" alt="Logo" />`
      : '';

    const proceduresHTML = budgetProcedures.length > 0
      ? `<table><thead><tr><th>Procedimento</th><th>Valor</th></tr></thead><tbody>${budgetProcedures.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}</tbody><tfoot><tr><td><strong>Total</strong></td><td><strong>R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr></tfoot></table>`
      : '<p style="color:#8a8a8a">Nenhum procedimento vinculado.</p>';
    const sectionsHTML = sectionsRef.current.map((s, i) => {
      const contentFormatted = s.content ? escapeHtml(s.content).replace(/\n/g, '<br>') : '<em style="color:#8a8a8a">Sem conteúdo.</em>';
      return `<div class="section"><h2>${String(i + 1).padStart(2, '0')}. ${escapeHtml(s.title || 'Seção sem título')}</h2><p>${contentFormatted}</p></div>`;
    }).join('');
    const treatmentTitle = tratamentoAtivo?.nome ?? patientName;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(treatmentTitle)} — ${escapeHtml(patientName)}</title><style>
body{font-family:Georgia,serif;max-width:780px;margin:40px auto;color:#0d0d0d;line-height:1.6}
header{display:flex;align-items:center;gap:20px;border-bottom:2px solid #2f9c85;padding-bottom:20px;margin-bottom:32px}
.clinica-logo{height:72px;width:auto;object-fit:contain;flex-shrink:0}
.header-text{flex:1}
.header-text small{display:block;color:#2f9c85;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px}
h1{font-size:28px;margin:0 0 4px}
.header-text p{margin:4px 0 0;color:#8a8a8a;font-size:13px}
.footer{margin-top:48px;padding-top:16px;text-align:center;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#bbb}
.section{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #d4d1ca}
.section h2{font-size:18px;color:#2f9c85;margin:0 0 10px}
.section p{margin:0;font-size:14px}
.budget{margin-top:36px}
.budget h2{font-size:18px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;background:#f5f3ef;border-bottom:2px solid #d4d1ca}
td{padding:8px 12px;border-bottom:1px solid #eceae4}
tfoot td{border-top:2px solid #d4d1ca;border-bottom:none;font-size:15px}
@media print{body{margin:20px}}
</style></head><body>
<header>
  ${logoHTML}
  <div class="header-text">
    <small>Apresentação ao Paciente</small>
    <h1>${escapeHtml(treatmentTitle)}</h1>
    <p>Paciente: <strong>${escapeHtml(patientName)}</strong></p>
  </div>
</header>
${sectionsHTML}
<div class="budget"><h2>Resumo do Investimento</h2>${proceduresHTML}</div>
<div class="footer">Odonto.IA</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const addSection = async (): Promise<void> => {
    const supabase = createClient();
    const newOrder = sectionsRef.current.length;
    const { data, error } = await supabase
      .from('planejamento_secoes')
      .insert({
        clinica_id: clinicaId,
        paciente_id: patientId,
        titulo: '',
        conteudo: '',
        imagem_ids: [],
        ordem: newOrder,
        status: 'pendente',
        data_estimada: null,
      })
      .select('id')
      .single();

    if (error ?? !data) { console.error('Erro ao criar seção:', error); return; }
    setSections(prev => [...prev, {
      id: (data as Record<string, unknown>).id as string,
      title: '',
      content: '',
      imageIds: [],
      status: 'pendente',
      dataEstimada: null,
    }]);
  };

  const removeSection = async (id: string): Promise<void> => {
    if (!window.confirm('Remover esta seção do planejamento?')) return;
    setSections(prev => prev.filter(s => s.id !== id));
    clearTimeout(debounceTimers.current[id]);
    delete debounceTimers.current[id];
    if (isUUID(id)) {
      const supabase = createClient();
      await supabase.from('planejamento_secoes').delete().eq('id', id);
    }
  };

  const updateSection = (id: string, field: keyof Section, value: string | string[]) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
    clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => void saveSectionToDb(id), 1000);
  };

  const toggleImageSelection = (sectionId: string, imageId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const newImageIds = section.imageIds.includes(imageId)
      ? section.imageIds.filter(id => id !== imageId)
      : [...section.imageIds, imageId];
    updateSection(sectionId, 'imageIds', newImageIds);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="space-y-6 pb-20 animate-pulse">
        <div className="bg-surface rounded-3xl border border-border/60 p-8 space-y-4">
          <div className="h-3 w-32 bg-surface-alt rounded-full" />
          <div className="h-9 w-64 bg-surface-alt rounded-xl" />
          <div className="h-2 w-full bg-surface-alt rounded-full" />
        </div>
        <div className="bg-surface rounded-3xl border border-border/60 p-8 h-64" />
        {[0, 1].map(i => (
          <div key={i} className="bg-surface rounded-3xl border border-border/60 p-8 space-y-4">
            <div className="h-6 w-48 bg-surface-alt rounded-lg" />
            <div className="h-40 w-full bg-surface-alt rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20">

      {/* ── HEADER: título estático da aba ── */}
      <div className="px-1">
        <div className="text-xs font-bold text-teal uppercase tracking-[0.2em] mb-1">
          Mapa de Tratamento
        </div>
        <h1 className="font-heading text-2xl text-text-primary">{patientName}</h1>
      </div>

      {/* ── CTA: SEM TRATAMENTO ATIVO ── */}
      {!tratamentoAtivo && !loadingTratamento && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-3xl border-2 border-dashed border-border/50 shadow-sm p-10 flex flex-col items-center text-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center">
            <Plus className="w-6 h-6 text-teal" />
          </div>
          <div>
            <p className="font-heading text-lg text-text-primary">Nenhum tratamento ativo</p>
            <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
              Vincule as fichas clínicas para iniciar o acompanhamento do tratamento.
            </p>
          </div>
          <button
            onClick={() => void handleAbrirModalIniciar()}
            className="bg-teal text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-teal/90 transition-all shadow-[0_0_20px_rgba(47,156,133,0.3)]"
          >
            <Plus className="w-4 h-4" /> Iniciar Tratamento
          </button>
        </motion.div>
      )}

      {/* ── BANNER DE REVISÃO — aparece acima do Mapa quando revisando outro tratamento ── */}
      <AnimatePresence>
        {reviewingTratamento && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 bg-surface rounded-2xl border border-teal/25 shadow-sm"
          >
            <button
              onClick={() => { setReviewingTratamento(null); setReviewData(null); setSelectedTooth(null); }}
              className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 rotate-90" /> Voltar
            </button>
            <div className="w-px h-4 bg-border/60" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em]">
                {reviewingTratamento.status === 'pendente' ? 'Em Pausa' : 'Concluído'} · Revisando
              </span>
              <p className="text-sm font-semibold text-text-primary truncate">
                {reviewingTratamento.nome ?? 'Sem nome'}
              </p>
            </div>
            {reviewingTratamento.status === 'pendente' && (
              <button
                onClick={() => void handleTornarPrincipal(reviewingTratamento)}
                disabled={tornarPrincipalId === reviewingTratamento.id}
                className="flex items-center gap-1.5 text-xs font-bold text-teal border border-teal/30 bg-teal/8 hover:bg-teal/15 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              >
                {tornarPrincipalId === reviewingTratamento.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <CheckCircle2 className="w-3 h-3" />}
                Tornar Principal
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CARD COMBINADO: tratamento principal (ou revisado) ── */}
      {(tratamentoAtivo ?? reviewingTratamento) && displayTratamento && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          {/* Header clicável */}
          <div
            onClick={() => setMapExpanded(prev => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMapExpanded(prev => !prev); }}
            className="w-full px-6 pt-6 pb-5 hover:bg-surface-alt/10 transition-colors cursor-pointer"
          >
            {/* Linha superior: nome do tratamento + botões + chevron */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${
                    reviewingTratamento
                      ? reviewingTratamento.status === 'pendente'
                        ? 'text-amber-600 bg-amber-500/8 border-amber-500/20'
                        : 'text-text-secondary bg-surface-alt border-border/50'
                      : 'text-teal bg-teal/8 border-teal/20'
                  }`}>
                    {reviewingTratamento
                      ? reviewingTratamento.status === 'pendente' ? 'Em Pausa' : 'Concluído'
                      : 'Em Tratamento'}
                  </span>
                  <span className="text-xs text-text-secondary">
                    iniciado em {format(parseISO(displayTratamento.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="font-heading text-xl text-text-primary truncate">
                  {displayTratamento.nome ?? 'Sem nome'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                {/* Apresentar — ação principal */}
                <button
                  onClick={() => setApresentarOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-teal hover:bg-teal/90 px-3 py-1.5 rounded-xl transition-colors shadow-[0_0_12px_rgba(47,156,133,0.25)]"
                >
                  <Presentation className="w-3 h-3" /> Apresentar
                </button>

                {/* PDF — ação secundária */}
                <button
                  onClick={() => void handleGerarPDF()}
                  className="p-1.5 rounded-xl text-text-secondary border border-border/50 hover:bg-surface-alt hover:border-border hover:text-text-primary transition-all"
                  title="Gerar PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                {/* ⋮ — Renomear / Encerrar / Excluir */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setMoreMenuOpen(prev => !prev)}
                    className={`p-1.5 rounded-xl border transition-all ${
                      moreMenuOpen
                        ? 'bg-surface-alt border-border text-text-primary'
                        : 'border-border/50 text-text-secondary hover:bg-surface-alt hover:border-border hover:text-text-primary'
                    }`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-border/60 rounded-2xl shadow-xl overflow-hidden z-50"
                      >
                        <button
                          onClick={() => { setMoreMenuOpen(false); setNovoNomeTratamento(displayTratamento.nome ?? ''); setRenomearOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-text-primary hover:bg-surface-alt/60 text-left transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-text-secondary" /> Renomear
                        </button>
                        <button
                          onClick={() => { setMoreMenuOpen(false); setConfirmarEncerramentoOpen(true); }}
                          disabled={encerrando}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-text-primary hover:bg-surface-alt/60 text-left transition-colors disabled:opacity-40"
                        >
                          {encerrando ? <Loader2 className="w-4 h-4 animate-spin text-text-secondary" /> : <CheckCircle2 className="w-4 h-4 text-text-secondary" />}
                          Encerrar
                        </button>
                        <div className="h-px bg-border/40 mx-3" />
                        <button
                          onClick={() => { setMoreMenuOpen(false); setConfirmarExclusaoOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-500/5 text-left transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Excluir tratamento
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="shrink-0 ml-1">
                  {mapExpanded
                    ? <ChevronUp className="w-4 h-4 text-text-secondary" />
                    : <ChevronDown className="w-4 h-4 text-text-secondary" />
                  }
                </div>
              </div>
            </div>

            {/* Progresso + stats */}
            {displayProcs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">Progresso geral</span>
                  <span className="font-mono text-xs font-bold text-teal">{progressPercent}%</span>
                </div>
                <div className="w-full bg-surface-alt rounded-full h-1.5 mb-3">
                  <motion.div
                    className="bg-teal h-1.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-bold text-text-primary">{displayProcs.length}</span>
                    <span className="text-xs text-text-secondary">procedimentos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-bold text-teal">{concluidosCount}</span>
                    <span className="text-xs text-text-secondary">concluídos</span>
                  </div>
                  {budgetExists && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-base font-bold text-text-primary">
                        R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-text-secondary">orçamento</span>
                    </div>
                  )}
                  {selectedTooth && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTooth(null); }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal/15 border border-teal/30 text-teal text-xs font-bold"
                    >
                      <Filter className="w-2.5 h-2.5" />
                      D{selectedTooth}
                      <X className="w-2.5 h-2.5 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Intelligence indicators */}
            {intelligenceMessages.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {intelligenceMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
                      msg.type === 'success'
                        ? 'bg-teal/8 text-teal border-teal/20'
                        : msg.type === 'warning'
                        ? 'bg-amber-500/8 text-amber-600 border-amber-500/20'
                        : 'bg-surface-alt text-text-secondary border-border/60'
                    }`}
                  >
                    {msg.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> :
                     msg.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                     <Zap className="w-3 h-3" />}
                    {msg.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {mapExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                {/* Loading spinner while fetching review data */}
                {loadingReview && (
                  <div className="flex items-center justify-center gap-3 py-16 text-text-secondary">
                    <Loader2 className="w-5 h-5 animate-spin text-teal" />
                    <span className="text-sm font-medium">Carregando sessões...</span>
                  </div>
                )}

                {!loadingReview && (
                <>
                <div className="px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                  {/* Odontogram */}
                  <div>
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-4">
                      Clique em um dente para filtrar
                    </p>
                    <Odontograma
                      selectedTeeth={selectedTooth ? [selectedTooth] : []}
                      historicalTeeth={treatedTeeth}
                      sharedTeeth={Array.from(concludedTeeth)}
                      onToothToggle={(tooth) =>
                        setSelectedTooth(prev => prev === tooth ? null : tooth)
                      }
                      showCheckbox={false}
                      compact
                      hideFilters
                    />
                  </div>

                  {/* Right panel: tooth detail or quadrant stats */}
                  <AnimatePresence mode="wait">
                    {selectedTooth ? (
                      <motion.div
                        key="tooth-detail"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div>
                          <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">
                            Dente selecionado
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-heading text-2xl text-text-primary font-bold">
                              Dente {selectedTooth}
                            </span>
                            {TOOTH_NAMES[selectedTooth] && (
                              <span className="text-sm text-text-secondary font-medium">
                                {TOOTH_NAMES[selectedTooth]}
                              </span>
                            )}
                          </div>
                          {getQuadrantForTooth(selectedTooth) && (
                            <span className="text-xs text-teal font-bold">
                              {Q_LABELS[getQuadrantForTooth(selectedTooth)!]?.long}
                            </span>
                          )}
                        </div>

                        {selectedToothProcs.length === 0 ? (
                          <div className="py-8 text-center text-text-secondary text-sm">
                            Nenhum procedimento para este dente.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedToothProcs.map(proc => {
                              const st = getProcStatus(proc.status);
                              return (
                                <div
                                  key={proc.id}
                                  className="flex items-center justify-between gap-3 p-3 bg-surface-alt/50 rounded-xl border border-border/40"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${st.dotClassName}`} />
                                    <p className="text-sm text-text-primary truncate">{proc.descricao}</p>
                                  </div>
                                  <button
                                    onClick={() => void updateProcStatus(proc.id, getNextStatus(proc.status))}
                                    disabled={updatingProcId === proc.id}
                                    className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold transition-all disabled:opacity-50 ${st.className}`}
                                  >
                                    {updatingProcId === proc.id
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : st.label
                                    }
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <button
                          onClick={() => setSelectedTooth(null)}
                          className="text-[11px] text-text-secondary hover:text-teal transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Limpar filtro
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="quadrant-stats"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                          Progresso por Quadrante
                        </div>

                        {quadrantStats.length === 0 ? (
                          <div className="py-6 text-sm text-text-secondary">
                            Nenhum dado por quadrante disponível.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {quadrantStats.map(q => {
                              const pct = q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;
                              const isComplete = q.done === q.total;
                              return (
                                <div key={q.key} className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-text-primary">{q.short}</span>
                                      {isComplete && (
                                        <span className="text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">
                                          Concluído
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs font-mono text-text-secondary">
                                      {q.done}/{q.total}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-surface-alt rounded-full overflow-hidden">
                                    <motion.div
                                      className={`h-full rounded-full ${isComplete ? 'bg-teal' : 'bg-teal/50'}`}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.5, delay: 0.1 }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {budgetExists && (
                          <div className="pt-4 border-t border-border/40 space-y-2">
                            <div className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                              Investimento
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono text-xl font-bold text-text-primary">
                                R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-text-secondary">total</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-teal shrink-0" />
                              <span className="text-xs text-text-secondary">
                                {budgetProcedures.length} procedimento{budgetProcedures.length !== 1 ? 's' : ''} no orçamento
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sessões Clínicas — timeline completo */}
                <div className="px-6 pb-8 border-t border-border/30 pt-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em]">
                      Sessões Clínicas
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-xs font-bold">
                      {timelineSessions.length} sess{timelineSessions.length !== 1 ? 'ões' : 'ão'}
                    </span>
                    {selectedTooth && (
                      <span className="text-xs text-text-secondary/60 font-medium">
                        · filtrando dente {selectedTooth}
                      </span>
                    )}
                  </div>
                  {timelineSessions.length === 0 ? (
                    <div className="py-8 text-center">
                      <Activity className="w-8 h-8 text-text-secondary/30 mx-auto mb-3" />
                      <p className="text-sm text-text-secondary">
                        {selectedTooth
                          ? `Nenhum procedimento para o dente ${selectedTooth}.`
                          : 'Nenhum procedimento registrado ainda.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0 relative">
                      {timelineSessions.map((session, idx) => {
                        const sessionDone = session.procedures.filter(p => p.status === 'concluido').length;
                        const sessionTotal = session.procedures.length;
                        const isLast = idx === timelineSessions.length - 1;
                        return (
                          <div key={session.fichaId} className="relative flex gap-5 pb-8 last:pb-0">
                            {!isLast && (
                              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/50" />
                            )}
                            <div className="relative z-10 shrink-0 mt-0.5">
                              <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                                sessionDone === sessionTotal
                                  ? 'bg-teal/15 border-teal'
                                  : 'bg-surface border-border/60'
                              }`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${
                                  sessionDone === sessionTotal ? 'bg-teal' : 'bg-text-secondary/30'
                                }`} />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-3">
                                <div>
                                  <div className="font-bold text-xs text-text-primary">
                                    {session.date
                                      ? format(parseISO(session.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                                      : 'Sessão clínica'}
                                  </div>
                                  <div className="text-xs text-text-secondary mt-0.5">
                                    {sessionTotal} procedimento{sessionTotal !== 1 ? 's' : ''}
                                    {sessionDone > 0 && ` · ${sessionDone} concluído${sessionDone !== 1 ? 's' : ''}`}
                                  </div>
                                </div>
                                {sessionDone === sessionTotal && (
                                  <span className="text-[10px] font-bold text-teal bg-teal/10 border border-teal/20 px-1.5 py-0.5 rounded-full">
                                    Completa
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {session.procedures.map(proc => (
                                  <ProcCard
                                    key={proc.id}
                                    proc={proc}
                                    onStatusCycle={() => void updateProcStatus(proc.id, getNextStatus(proc.status))}
                                    onSchedule={() => router.push('/dashboard/agendamentos')}
                                    updating={updatingProcId === proc.id}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── EM PAUSA ── */}
      {tratamentosPendentes.length > 0 && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em]">Em Pausa</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20">
                {tratamentosPendentes.length}
              </span>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-2">
            {tratamentosPendentes.map(t => {
              const isReviewing = reviewingTratamento?.id === t.id;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleReviewTratamento(t)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleReviewTratamento(t)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isReviewing ? 'border-teal/30 bg-teal/5' : 'border-border/40 bg-surface-alt/40 hover:bg-surface-alt/80'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{t.nome ?? 'Sem nome'}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Iniciado em {format(parseISO(t.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingReview && isReviewing
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal" />
                      : <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Em Pausa</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── NOVO TRATAMENTO (quando já há um principal) ── */}
      {tratamentoAtivo && !loadingTratamento && (
        <button
          onClick={() => void handleAbrirModalIniciar()}
          className="w-full py-4 border-2 border-dashed border-border/50 rounded-3xl flex items-center justify-center gap-2 text-text-secondary hover:text-teal hover:border-teal/40 transition-all group"
        >
          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-sm">Novo Tratamento</span>
        </button>
      )}

      {/* ── CONCLUÍDOS ── */}
      {historicoTratamentos.length > 0 && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <button
            onClick={() => setHistoricoAberto(prev => !prev)}
            className="w-full flex items-center justify-between px-6 py-5 hover:bg-surface-alt/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em]">Concluídos</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-alt text-text-secondary text-xs font-bold">
                {historicoTratamentos.length}
              </span>
            </div>
            {historicoAberto ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
          </button>
          <AnimatePresence initial={false}>
            {historicoAberto && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 space-y-2">
                  {historicoTratamentos.map(t => {
                    const isReviewing = reviewingTratamento?.id === t.id;
                    return (
                      <div key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleReviewTratamento(t)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleReviewTratamento(t)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isReviewing ? 'border-teal/30 bg-teal/5' : 'border-border/40 bg-surface-alt/50 hover:bg-surface-alt/80'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{t.nome ?? 'Sem nome'}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {format(parseISO(t.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            {t.encerrado_em && ` → ${format(parseISO(t.encerrado_em), 'dd/MM/yyyy', { locale: ptBR })}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {loadingReview && isReviewing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal" />
                            : <span className="text-[10px] font-bold text-text-secondary bg-surface-alt border border-border/40 px-2 py-0.5 rounded-full">Concluído</span>
                          }
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmarExclusaoHistId(t.id); }}
                            className="p-1.5 rounded-lg text-text-secondary/40 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── APRESENTAR PANEL ── */}
      <ApresentarPanel
        open={apresentarOpen}
        onClose={() => setApresentarOpen(false)}
        patientName={patientName}
        planningTitle={tratamentoAtivo?.nome ?? patientName}
        tratamentoAtivo={tratamentoAtivo}
        sections={sections}
        planProcs={planProcs}
        documents={documents}
        budgetProcedures={budgetProcedures}
        budgetExists={budgetExists}
        concluidosCount={concluidosCount}
        progressPercent={progressPercent}
        totalBudget={totalBudget}
        savingIds={savingIds}
        isGeneratingAI={isGeneratingAI}
        isImagePickerOpen={isImagePickerOpen}
        setIsImagePickerOpen={setIsImagePickerOpen}
        onUpdateSection={updateSection}
        onRemoveSection={removeSection}
        onAddSection={addSection}
        onGenerateSectionWithAI={generateSectionWithAI}
        onToggleImageSelection={toggleImageSelection}
        onGenerateFullPlanWithAI={generateFullPlanWithAI}
        onSaveSectionToDb={saveSectionToDb}
      />

      {/* ── MODAL: INICIAR TRATAMENTO ─────────────────────────── */}
      <AnimatePresence>
        {modalIniciarOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalIniciarOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border border-border/40"
            >
              <div className="p-6 border-b border-border/60 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg text-text-primary">Iniciar Planejamento</h3>
                  <p className="text-xs text-text-secondary mt-0.5">Selecione as fichas que serão a base deste planejamento.</p>
                </div>
                <button onClick={() => setModalIniciarOpen(false)} className="p-2 rounded-xl hover:bg-surface-alt/50 transition-colors text-text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingFichasSemTrat ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-14 rounded-2xl bg-surface-alt animate-pulse" />
                    ))}
                  </div>
                ) : fichasSemTratamento.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="w-10 h-10 text-text-secondary/30 mb-3" />
                    <p className="text-sm font-medium text-text-secondary">Nenhuma ficha disponível</p>
                    <p className="text-xs text-text-secondary/60 mt-1 max-w-xs">
                      Todas as fichas já estão vinculadas a um planejamento ou não há fichas cadastradas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fichasSemTratamento.map(f => {
                      const selected = fichasSelecionadas.has(f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => toggleFicha(f.id)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                            selected
                              ? 'border-teal/50 bg-teal/8'
                              : 'border-border/50 hover:border-border bg-surface-alt/30'
                          }`}
                        >
                          {selected
                            ? <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                            : <Square className="w-4 h-4 text-text-secondary/40 shrink-0" />
                          }
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-text-primary truncate">
                              {f.queixa_principal ?? 'Evolução'}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-xs text-text-secondary">
                                {format(new Date(f.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {f.dentes_afetados?.length > 0 && (
                                <p className="text-xs text-teal/80 font-medium">
                                  Dentes: {f.dentes_afetados.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border/60 bg-surface-alt/30 space-y-3">
                {tratamentoError && (
                  <p className="text-xs text-red-500 font-medium text-center">{tratamentoError}</p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    {fichasSelecionadas.size > 0 ? `${fichasSelecionadas.size} ficha(s) selecionada(s)` : 'Nenhuma ficha selecionada'}
                  </p>
                  <button
                    onClick={() => void handleIniciarTratamento()}
                    disabled={fichasSelecionadas.size === 0 || salvandoTratamento}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-teal text-white font-bold text-sm hover:bg-teal/90 transition-colors disabled:opacity-40 shadow-[0_0_15px_rgba(47,156,133,0.3)]"
                  >
                    {salvandoTratamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Iniciar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: ENCERRAR TRATAMENTO ────────────────────────── */}
      <AnimatePresence>
        {confirmarEncerramentoOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmarEncerramentoOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-2xl border border-border/40 p-6"
            >
              <h3 className="font-heading text-lg text-text-primary mb-2">Encerrar planejamento?</h3>
              <p className="text-sm text-text-secondary mb-6">
                O planejamento será marcado como concluído e movido para o histórico. As fichas vinculadas permanecem no sistema.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmarEncerramentoOpen(false)}
                  disabled={encerrando}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleEncerrarTratamento()}
                  disabled={encerrando}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal/90 transition-colors disabled:opacity-40"
                >
                  {encerrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Encerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: EXCLUIR TRATAMENTO ─────────────────────────── */}
      <AnimatePresence>
        {confirmarExclusaoOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmarExclusaoOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-2xl border border-border/40 p-6"
            >
              <h3 className="font-heading text-lg text-text-primary mb-2">Excluir planejamento?</h3>
              <p className="text-sm text-text-secondary mb-6">
                O planejamento será removido permanentemente. As fichas vinculadas ficarão livres e poderão ser usadas em um novo planejamento.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmarExclusaoOpen(false)}
                  disabled={excluindo}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleExcluirTratamento()}
                  disabled={excluindo}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {excluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: EXCLUIR PLANEJAMENTO CONCLUÍDO ─────────────── */}
      <AnimatePresence>
        {confirmarExclusaoHistId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmarExclusaoHistId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-2xl border border-border/40 p-6"
            >
              <h3 className="font-heading text-lg text-text-primary mb-2">Excluir planejamento concluído?</h3>
              <p className="text-sm text-text-secondary mb-6">
                O planejamento será removido permanentemente. As fichas vinculadas ficarão livres.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmarExclusaoHistId(null)}
                  disabled={excluindoHist}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleExcluirHistorico()}
                  disabled={excluindoHist}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {excluindoHist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: RENOMEAR TRATAMENTO ────────────────────────── */}
      <AnimatePresence>
        {renomearOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setRenomearOpen(false); setNovoNomeTratamento(''); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-2xl border border-border/40 p-6"
            >
              <h3 className="font-heading text-lg text-text-primary mb-2">Renomear planejamento</h3>
              <p className="text-sm text-text-secondary mb-4">Dê um nome que identifique o objetivo deste planejamento.</p>
              <input
                type="text"
                value={novoNomeTratamento}
                onChange={(e) => setNovoNomeTratamento(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRenomearTratamento(); }}
                placeholder="Ex: Reabilitação Oral 2025"
                autoFocus
                className="w-full bg-surface-alt border border-border/60 rounded-2xl px-4 py-3 text-sm text-text-primary outline-none focus:border-teal transition-colors mb-5"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setRenomearOpen(false); setNovoNomeTratamento(''); }}
                  disabled={renomeando}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleRenomearTratamento()}
                  disabled={renomeando || !novoNomeTratamento.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark transition-colors disabled:opacity-40 shadow-[0_0_15px_rgba(47,156,133,0.3)]"
                >
                  {renomeando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
