'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Calendar,
  Download,
  Sparkles,
  Loader2,
  Save,
  Presentation,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Circle,
  LayoutGrid,
  Activity,
  Zap,
  Filter,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Odontograma, TOOTH_NAMES } from '@/components/odontograma/Odontograma';
import { getProcStatus, getSectionStatus } from '@/lib/constants/treatment-status';

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
            <div className="text-[9px] font-bold text-teal uppercase tracking-wider mb-1">
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
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${st.className}`}
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
  const [planningTitle, setPlanningTitle] = useState(patientName);
  const [sections, setSections] = useState<Section[]>([]);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [budgetProcedures, setBudgetProcedures] = useState<BudgetProcedure[]>([]);
  const [budgetExists, setBudgetExists] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [overviewMode, setOverviewMode] = useState(false);
  const [patientModeOpen, setPatientModeOpen] = useState(false);

  // Treatment Map
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [fichaDateMap, setFichaDateMap] = useState<Record<string, string>>({});
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(true);

  const router = useRouter();

  const [planProcs, setPlanProcs] = useState<PlanProc[]>([]);
  const [updatingProcId, setUpdatingProcId] = useState<string | null>(null);

  const sectionsRef = useRef<Section[]>([]);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  // Keyboard navigation for presentation mode
  useEffect(() => {
    if (!isPresentationOpen) return;
    const maxSlide = sections.length;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsPresentationOpen(false); setOverviewMode(false); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => { if (prev < maxSlide) { setSlideDirection(1); return prev + 1; } return prev; });
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlide(prev => { if (prev > 0) { setSlideDirection(-1); return prev - 1; } return prev; });
      }
      if (e.key === 'o' || e.key === 'O') setOverviewMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPresentationOpen, sections.length]);

  // Patient mode keyboard close
  useEffect(() => {
    if (!patientModeOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPatientModeOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [patientModeOpen]);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();

      type FichaRow = {
        id: string;
        created_at: string;
        dentes_observacoes: Record<string, string> | null;
      };

      const [docsResult, budgetResult, secoesResult, fichasResult, existingProcsResult] =
        await Promise.all([
          supabase
            .from('paciente_documentos')
            .select('*')
            .eq('paciente_id', patientId)
            .in('categoria', ['Radiografias', 'Fotografias']),
          supabase
            .from('orcamentos')
            .select('*, orcamento_itens(*)')
            .eq('paciente_id', patientId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('planejamento_secoes')
            .select('*')
            .eq('paciente_id', patientId)
            .order('ordem', { ascending: true }),
          supabase
            .from('fichas')
            .select('id, created_at, dentes_observacoes')
            .eq('paciente_id', patientId)
            .not('dentes_observacoes', 'is', null),
          supabase
            .from('planejamento_procedimentos')
            .select('*')
            .eq('paciente_id', patientId)
            .order('ordem', { ascending: true }),
        ]);

      if (docsResult.error) throw docsResult.error;
      setDocuments(
        (docsResult.data ?? []).map((doc: Record<string, unknown>) => ({
          id: doc.id as string,
          name: doc.nome as string,
          category: doc.categoria as string,
          url: doc.url as string,
          thumbnail: (doc.thumbnail as string | undefined) ?? (doc.url as string),
        }))
      );

      if (budgetResult.error) throw budgetResult.error;
      if (budgetResult.data) {
        setBudgetExists(true);
        setBudgetProcedures(
          (budgetResult.data.orcamento_itens as Array<Record<string, unknown>> ?? []).map(p => ({
            id: p.id as string,
            name: p.descricao as string,
            value: p.preco_total as number,
          }))
        );
      } else {
        setBudgetExists(false);
        setBudgetProcedures([]);
      }

      if (secoesResult.error) throw secoesResult.error;
      if (secoesResult.data && secoesResult.data.length > 0) {
        setSections(
          (secoesResult.data as Array<Record<string, unknown>>).map(row => ({
            id: row.id as string,
            title: row.titulo as string,
            content: (row.conteudo as string) ?? '',
            imageIds: (row.imagem_ids as string[]) ?? [],
            status: ((row.status as string) ?? 'pendente') as Section['status'],
            dataEstimada: (row.data_estimada as string | null) ?? null,
          }))
        );
      }

      // Build ficha date map
      const dateMap: Record<string, string> = {};
      for (const ficha of (fichasResult.data ?? []) as FichaRow[]) {
        dateMap[ficha.id] = ficha.created_at;
      }
      setFichaDateMap(dateMap);

      // Sync procedures from fichas
      const rawProcs: { fichaRef: string; descricao: string; dente: number }[] = [];
      for (const ficha of (fichasResult.data ?? []) as FichaRow[]) {
        const obs = ficha.dentes_observacoes ?? {};
        for (const [dente, desc] of Object.entries(obs)) {
          if (typeof desc === 'string' && desc.trim()) {
            const lines = desc.split('\n').filter(Boolean);
            for (const line of lines) {
              rawProcs.push({
                fichaRef: `${ficha.id}::${dente}::${lines.indexOf(line)}`,
                descricao: line.trim(),
                dente: parseInt(dente, 10),
              });
            }
          }
        }
      }

      const existingRefs = new Set(
        (existingProcsResult.data ?? []).map((p: Record<string, unknown>) => p.ficha_ref as string)
      );
      const toInsert = rawProcs.filter(p => !existingRefs.has(p.fichaRef));

      const mapPlanProc = (row: Record<string, unknown>): PlanProc => ({
        id: row.id as string,
        descricao: row.descricao as string,
        dente: row.dente as number | null,
        status: (row.status as PlanProc['status']) ?? 'pendente',
        fichaRef: row.ficha_ref as string | null,
        ordem: row.ordem as number,
      });

      if (toInsert.length > 0) {
        const startOrdem = (existingProcsResult.data ?? []).length;
        await supabase.from('planejamento_procedimentos').insert(
          toInsert.map((p, i) => ({
            clinica_id: clinicaId,
            paciente_id: patientId,
            descricao: p.descricao,
            dente: p.dente,
            status: 'pendente',
            ficha_ref: p.fichaRef,
            ordem: startOrdem + i,
          }))
        );
        const { data: refreshed } = await supabase
          .from('planejamento_procedimentos')
          .select('*')
          .eq('paciente_id', patientId)
          .order('ordem', { ascending: true });
        setPlanProcs((refreshed ?? []).map(r => mapPlanProc(r as Record<string, unknown>)));
      } else {
        setPlanProcs(
          (existingProcsResult.data ?? []).map(r => mapPlanProc(r as Record<string, unknown>))
        );
      }
    } catch (error) {
      console.error('Erro ao buscar dados de planejamento:', JSON.stringify(error), error);
    } finally {
      setLoadingData(false);
    }
  }, [patientId, clinicaId]);

  useEffect(() => {
    if (patientId) void fetchData();
  }, [patientId, fetchData]);

  // ── Computed values ──────────────────────────────────────────────────────────

  const treatedTeeth = useMemo(() => {
    const teeth = new Set<number>();
    for (const p of planProcs) {
      if (p.dente) teeth.add(p.dente);
    }
    return teeth;
  }, [planProcs]);

  const concludedTeeth = useMemo(() => {
    const teeth = new Set<number>();
    for (const p of planProcs) {
      if (p.dente && p.status === 'concluido') teeth.add(p.dente);
    }
    return teeth;
  }, [planProcs]);

  const filteredProcs = useMemo(() =>
    selectedTooth ? planProcs.filter(p => p.dente === selectedTooth) : planProcs,
    [planProcs, selectedTooth]
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
        const dateA = fichaDateMap[a[0]] ?? '';
        const dateB = fichaDateMap[b[0]] ?? '';
        return dateB.localeCompare(dateA);
      })
      .map(([fichaId, procs], idx) => ({
        fichaId,
        date: fichaDateMap[fichaId] ?? null,
        sessionNumber: idx + 1,
        procedures: procs.sort((a, b) => (a.dente ?? 0) - (b.dente ?? 0)),
      }));
  }, [filteredProcs, fichaDateMap]);

  const quadrantStats = useMemo(() => {
    return Object.entries(Q_LABELS).map(([key, meta]) => {
      const procs = planProcs.filter(p => p.dente && meta.teeth.includes(p.dente));
      const done = procs.filter(p => p.status === 'concluido').length;
      return { key, ...meta, total: procs.length, done };
    }).filter(q => q.total > 0);
  }, [planProcs]);

  const intelligenceMessages = useMemo(() => {
    const msgs: { text: string; type: 'info' | 'warning' | 'success' }[] = [];

    const pending = planProcs.filter(p => p.status === 'pendente').length;
    const done = planProcs.filter(p => p.status === 'concluido').length;
    const total = planProcs.length;

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

    const allDates = Object.values(fichaDateMap).sort((a, b) => b.localeCompare(a));
    if (allDates.length > 0) {
      const lastDate = parseISO(allDates[0]);
      const daysSince = differenceInDays(new Date(), lastDate);
      if (daysSince > 30) {
        msgs.push({ text: `Última sessão há ${daysSince} dias`, type: 'warning' });
      }
    }

    return msgs.slice(0, 3);
  }, [planProcs, quadrantStats, fichaDateMap]);

  const concluidosCount = planProcs.filter(p => p.status === 'concluido').length;
  const progressPercent = planProcs.length > 0
    ? Math.round((concluidosCount / planProcs.length) * 100)
    : 0;

  const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);
  const totalSlides = sections.length + 1;

  // ── Tooth detail (selected tooth procedures) ──────────────────────────────

  const selectedToothProcs = useMemo(() =>
    selectedTooth ? planProcs.filter(p => p.dente === selectedTooth) : [],
    [planProcs, selectedTooth]
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
      if (!response.ok) throw new Error('Falha ao gerar');
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
      }
    } catch (error) {
      console.error('Erro ao gerar plano completo:', error);
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const handleGerarPDF = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const proceduresHTML = budgetProcedures.length > 0
      ? `<table><thead><tr><th>Procedimento</th><th>Valor</th></tr></thead><tbody>${budgetProcedures.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}</tbody><tfoot><tr><td><strong>Total</strong></td><td><strong>R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr></tfoot></table>`
      : '<p style="color:#8a8a8a">Nenhum procedimento vinculado.</p>';
    const sectionsHTML = sectionsRef.current.map((s, i) => {
      const contentFormatted = s.content ? escapeHtml(s.content).replace(/\n/g, '<br>') : '<em style="color:#8a8a8a">Sem conteúdo.</em>';
      return `<div class="section"><h2>${String(i + 1).padStart(2, '0')}. ${escapeHtml(s.title || 'Seção sem título')}</h2><p>${contentFormatted}</p></div>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(planningTitle)} — ${escapeHtml(patientName)}</title><style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;color:#0d0d0d;line-height:1.6}header{border-bottom:2px solid #2f9c85;padding-bottom:16px;margin-bottom:32px}header small{display:block;color:#2f9c85;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px}h1{font-size:28px;margin:0 0 4px}header p{margin:4px 0 0;color:#8a8a8a;font-size:13px}.section{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #d4d1ca}.section h2{font-size:18px;color:#2f9c85;margin:0 0 10px}.section p{margin:0;font-size:14px}.budget{margin-top:36px}.budget h2{font-size:18px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 12px;background:#f5f3ef;border-bottom:2px solid #d4d1ca}td{padding:8px 12px;border-bottom:1px solid #eceae4}tfoot td{border-top:2px solid #d4d1ca;border-bottom:none;font-size:15px}@media print{body{margin:20px}}</style></head><body><header><small>Apresentação ao Paciente</small><h1>${escapeHtml(planningTitle)}</h1><p>Paciente: <strong>${escapeHtml(patientName)}</strong></p></header>${sectionsHTML}<div class="budget"><h2>Resumo do Investimento</h2>${proceduresHTML}</div><script>window.onload=function(){window.print();}<\/script></body></html>`;
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

      {/* ── HEADER ── */}
      <div className="bg-surface rounded-3xl border border-border/60 shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-2">
              Plano Clínico
            </div>
            <input
              type="text"
              value={planningTitle}
              onChange={(e) => setPlanningTitle(e.target.value)}
              className="font-heading text-3xl text-text-primary bg-transparent border-none outline-none w-full focus:ring-0 p-0"
              placeholder="Título do Planejamento"
            />

            {/* Progress bar */}
            {planProcs.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-secondary">Progresso geral</span>
                  <span className="font-mono text-xs font-bold text-teal">{progressPercent}%</span>
                </div>
                <div className="w-full bg-surface-alt rounded-full h-2">
                  <motion.div
                    className="bg-teal h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <div className="flex items-center gap-6 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-lg font-bold text-text-primary">{planProcs.length}</span>
                    <span className="text-xs text-text-secondary">procedimentos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-lg font-bold text-teal">{concluidosCount}</span>
                    <span className="text-xs text-text-secondary">concluídos</span>
                  </div>
                  {budgetExists && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-lg font-bold text-text-primary">
                        R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-text-secondary">orçamento</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Intelligence indicators */}
            {intelligenceMessages.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {intelligenceMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
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

          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <button
              onClick={() => void generateFullPlanWithAI()}
              disabled={isGeneratingAI !== null || (budgetProcedures.length === 0 && planProcs.length === 0)}
              className="bg-surface border border-border text-text-primary px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-surface-alt transition-all disabled:opacity-50"
            >
              {isGeneratingAI === '__full__'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                : <><Sparkles className="w-4 h-4 text-teal" /> Gerar com IA</>
              }
            </button>
            {planProcs.length > 0 && (
              <button
                onClick={() => setPatientModeOpen(true)}
                className="bg-surface border border-border text-text-primary px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-surface-alt transition-all"
              >
                <Users className="w-4 h-4 text-teal" />
                Modo Paciente
              </button>
            )}
            <button
              onClick={() => { setCurrentSlide(0); setIsPresentationOpen(true); }}
              disabled={sections.length === 0}
              className="bg-teal/10 text-teal px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-teal/20 transition-all border border-teal/20 disabled:opacity-50"
            >
              <Presentation className="w-4 h-4" />
              Apresentar
            </button>
            <button
              onClick={handleGerarPDF}
              className="bg-text-primary text-bg px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:opacity-80 transition-all shadow-md"
            >
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── MAPA DO TRATAMENTO ── */}
      {planProcs.length > 0 && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <button
            onClick={() => setMapExpanded(prev => !prev)}
            className="w-full p-6 flex items-center justify-between hover:bg-surface-alt/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                Mapa do Tratamento
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
                {treatedTeeth.size} dente{treatedTeeth.size !== 1 ? 's' : ''}
              </span>
              {selectedTooth && (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedTooth(null); }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal/15 border border-teal/30 text-teal text-[10px] font-bold"
                >
                  <Filter className="w-2.5 h-2.5" />
                  D{selectedTooth}
                  <X className="w-2.5 h-2.5 ml-0.5" />
                </button>
              )}
            </div>
            {mapExpanded
              ? <ChevronUp className="w-4 h-4 text-text-secondary" />
              : <ChevronDown className="w-4 h-4 text-text-secondary" />
            }
          </button>

          <AnimatePresence initial={false}>
            {mapExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                  {/* Odontogram */}
                  <div>
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4">
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
                    />
                    {/* Custom legend override */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-border bg-surface-alt inline-block" />
                        <span className="text-[8.5px] text-text-secondary">Sem tratamento</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: 'var(--color-teal-pale)', border: '1px solid color-mix(in srgb, var(--color-teal) 38%, var(--color-border))' }} />
                        <span className="text-[8.5px] text-text-secondary">Planejado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal/60 border border-teal inline-block" />
                        <span className="text-[8.5px] text-text-secondary">Concluído</span>
                      </div>
                    </div>
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
                          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">
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
                            <span className="text-[10px] text-teal font-bold">
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
                                    className={`shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all disabled:opacity-50 ${st.className}`}
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
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
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
                                        <span className="text-[9px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">
                                          Concluído
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-text-secondary">
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
                            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
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
                              <span className="text-[10px] text-text-secondary">
                                {budgetProcedures.length} procedimento{budgetProcedures.length !== 1 ? 's' : ''} no orçamento
                              </span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── TIMELINE DO TRATAMENTO ── */}
      {planProcs.length > 0 && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <button
            onClick={() => setTimelineExpanded(prev => !prev)}
            className="w-full p-6 flex items-center justify-between hover:bg-surface-alt/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                Jornada Clínica
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
                {timelineSessions.length} sess{timelineSessions.length !== 1 ? 'ões' : 'ão'}
              </span>
              {selectedTooth && (
                <span className="text-[10px] text-text-secondary font-medium">
                  · filtrando dente {selectedTooth}
                </span>
              )}
            </div>
            {timelineExpanded
              ? <ChevronUp className="w-4 h-4 text-text-secondary" />
              : <ChevronDown className="w-4 h-4 text-text-secondary" />
            }
          </button>

          <AnimatePresence initial={false}>
            {timelineExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-8">
                  {timelineSessions.length === 0 ? (
                    <div className="py-10 text-center">
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
                            {/* Vertical connector line */}
                            {!isLast && (
                              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/50" />
                            )}

                            {/* Timeline dot */}
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

                            {/* Session content */}
                            <div className="flex-1 min-w-0">
                              {/* Session header */}
                              <div className="flex items-center gap-3 mb-3">
                                <div>
                                  <div className="font-bold text-xs text-text-primary">
                                    {session.date
                                      ? format(parseISO(session.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                                      : 'Sessão clínica'
                                    }
                                  </div>
                                  <div className="text-[10px] text-text-secondary mt-0.5">
                                    {sessionTotal} procedimento{sessionTotal !== 1 ? 's' : ''}
                                    {sessionDone > 0 && ` · ${sessionDone} concluído${sessionDone !== 1 ? 's' : ''}`}
                                  </div>
                                </div>
                                {sessionDone === sessionTotal && (
                                  <span className="text-[9px] font-bold text-teal bg-teal/10 border border-teal/20 px-1.5 py-0.5 rounded-full">
                                    Completa
                                  </span>
                                )}
                              </div>

                              {/* Procedure cards */}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── SEÇÕES DO PLANEJAMENTO ── */}
      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {sections.map((section, index) => {
            const secSt = getSectionStatus(section.status);
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden group"
              >
                <div className="p-6 border-b border-border/40 flex items-center justify-between bg-surface-alt/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-text-primary text-bg flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                        placeholder="Título da Seção (ex: Situação Atual)"
                        className="font-heading text-xl text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={section.status}
                          onChange={(e) => updateSection(section.id, 'status', e.target.value as Section['status'])}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${secSt.className}`}
                          style={{ appearance: 'none' }}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluido">Concluído</option>
                        </select>
                        <input
                          type="date"
                          value={section.dataEstimada ?? ''}
                          onChange={(e) => updateSection(section.id, 'dataEstimada', e.target.value || '')}
                          className="text-[11px] text-text-secondary bg-transparent border border-border/60 rounded-lg px-2 py-1 focus:ring-0 focus:border-teal transition-colors outline-none"
                          title="Data estimada"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {savingIds.has(section.id) ? (
                      <div className="p-2 text-text-secondary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : (
                      <button
                        onClick={() => void saveSectionToDb(section.id)}
                        className="p-2 text-text-secondary hover:text-teal transition-colors opacity-0 group-hover:opacity-100"
                        title="Salvar seção"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void removeSection(section.id)}
                      className="p-2 text-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Explicação para o Paciente</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void generateSectionWithAI(section.id)}
                          disabled={isGeneratingAI === section.id || !section.title}
                          className="text-teal text-[10px] font-bold flex items-center gap-1 hover:text-teal-dark transition-colors disabled:opacity-50"
                        >
                          {isGeneratingAI === section.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          Gerar com a IA
                        </button>
                        <HelpTooltip content="Descreva os procedimentos e a IA gera um texto profissional." className="ml-0.5" />
                      </div>
                    </div>
                    <textarea
                      value={section.content}
                      onChange={(e) => updateSection(section.id, 'content', e.target.value)}
                      placeholder="Descreva aqui o que o paciente precisa entender de forma simples..."
                      className="w-full h-40 bg-surface-alt/50 border border-border/60 rounded-2xl p-4 text-sm text-text-primary leading-relaxed outline-none focus:border-teal transition-colors resize-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Imagens Ilustrativas</label>
                      <button
                        onClick={() => setIsImagePickerOpen(section.id)}
                        className="text-teal text-xs font-bold flex items-center gap-1 hover:text-teal-dark transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Buscar da aba Documentos
                        {documents.length > 0 && (
                          <span className="ml-0.5 text-text-secondary font-normal">({documents.length})</span>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {section.imageIds.length > 0 ? (
                        section.imageIds.map(imgId => {
                          const doc = documents.find(d => d.id === imgId);
                          if (!doc) return null;
                          return (
                            <div key={imgId} className="aspect-square relative rounded-xl overflow-hidden border border-border/60 group/img">
                              <Image src={doc.thumbnail} alt={doc.name} fill className="object-cover" referrerPolicy="no-referrer" />
                              <button
                                onClick={() => toggleImageSelection(section.id, imgId)}
                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover/img:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div
                          onClick={() => setIsImagePickerOpen(section.id)}
                          className="col-span-3 h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-alt/50 transition-colors"
                        >
                          <ImageIcon className="w-6 h-6 text-text-secondary" />
                          <span className="text-xs font-medium text-text-secondary">Nenhuma imagem selecionada</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <button
          onClick={() => void addSection()}
          className="w-full py-6 border-2 border-dashed border-border rounded-3xl flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:border-text-primary transition-all group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-sm">Adicionar Nova Seção ao Plano</span>
        </button>
      </div>

      {/* ── PATIENT EXPLANATION MODE ── */}
      <AnimatePresence>
        {patientModeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: '#f8f6f2' }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-black/8 bg-white/60 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 leading-none">Modo Paciente</p>
                  <p className="text-xs text-gray-500 mt-0.5">{patientName}</p>
                </div>
              </div>
              <button
                onClick={() => setPatientModeOpen(false)}
                className="p-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                  <div className="text-xs font-bold text-teal uppercase tracking-[0.2em] mb-2">
                    Seu Plano de Tratamento
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{patientName}</h1>
                  <p className="text-gray-500 text-sm">
                    {planProcs.length} procedimento{planProcs.length !== 1 ? 's' : ''} ·{' '}
                    {concluidosCount} concluído{concluidosCount !== 1 ? 's' : ''}
                  </p>

                  {/* Progress circle */}
                  <div className="mt-6 flex justify-center">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e0d8" strokeWidth="8" />
                        <circle
                          cx="48" cy="48" r="40"
                          fill="none"
                          stroke="#2f9c85"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - progressPercent / 100)}`}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-900">{progressPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Procedures grouped by quadrant */}
                {['Q1', 'Q2', 'Q3', 'Q4'].map(qKey => {
                  const qProcs = planProcs.filter(p =>
                    p.dente && Q_LABELS[qKey].teeth.includes(p.dente)
                  );
                  if (qProcs.length === 0) return null;
                  return (
                    <div key={qKey} className="mb-8">
                      <div className="text-[10px] font-bold text-teal uppercase tracking-widest mb-3">
                        {Q_LABELS[qKey].long}
                      </div>
                      <div className="space-y-2">
                        {qProcs.map(proc => {
                          const st = getProcStatus(proc.status);
                          return (
                            <div
                              key={proc.id}
                              className={`flex items-center gap-4 p-4 rounded-2xl border bg-white transition-all ${
                                proc.status === 'concluido'
                                  ? 'border-teal/20 opacity-70'
                                  : 'border-black/8'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full shrink-0 ${st.dotClassName}`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${proc.status === 'concluido' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {proc.descricao}
                                </p>
                                {proc.dente && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    Dente {proc.dente}{TOOTH_NAMES[proc.dente] ? ` — ${TOOTH_NAMES[proc.dente]}` : ''}
                                  </p>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${st.className}`}>
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Procedures without a specific tooth */}
                {(() => {
                  const noToothProcs = planProcs.filter(p => !p.dente);
                  if (noToothProcs.length === 0) return null;
                  return (
                    <div className="mb-8">
                      <div className="text-[10px] font-bold text-teal uppercase tracking-widest mb-3">
                        Procedimentos Gerais
                      </div>
                      <div className="space-y-2">
                        {noToothProcs.map(proc => {
                          const st = getProcStatus(proc.status);
                          return (
                            <div
                              key={proc.id}
                              className="flex items-center gap-4 p-4 rounded-2xl border bg-white border-black/8"
                            >
                              <div className={`w-3 h-3 rounded-full shrink-0 ${st.dotClassName}`} />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{proc.descricao}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.className}`}>
                                {st.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Budget summary */}
                {budgetExists && budgetProcedures.length > 0 && (
                  <div className="mt-8 p-6 bg-white rounded-3xl border border-black/8">
                    <div className="text-[10px] font-bold text-teal uppercase tracking-widest mb-4">
                      Resumo do Investimento
                    </div>
                    <div className="space-y-2 mb-4">
                      {budgetProcedures.map(bp => (
                        <div key={bp.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                          <span className="text-sm text-gray-600">{bp.name}</span>
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            R$ {bp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-bold text-sm text-gray-900">Total</span>
                      <span className="font-mono text-xl font-bold text-teal">
                        R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-3 text-center shrink-0">
              <p className="text-xs text-gray-400">Esc para fechar</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRESENTATION ENGINE ── */}
      <AnimatePresence>
        {isPresentationOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="fixed inset-0 z-[200] flex flex-col select-none"
            style={{ background: '#080c0b' }}
          >
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(47,156,133,0.08) 0%, transparent 70%)' }} />

            <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: '#2f9c85' }}>
                  <Presentation className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/90 leading-none">{planningTitle}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{patientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOverviewMode(prev => !prev)}
                  className={`p-2 rounded-lg transition-colors ${overviewMode ? 'bg-teal/20 text-teal' : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80'}`}
                  title="Visão geral (O)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsPresentationOpen(false); setOverviewMode(false); }}
                  className="p-2 rounded-lg bg-white/8 hover:bg-white/15 transition-colors text-white/60 hover:text-white"
                  title="Fechar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative z-10 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {overviewMode ? (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="absolute inset-0 overflow-y-auto p-8"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                      {[...sections, null].map((sec, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setCurrentSlide(idx); setOverviewMode(false); }}
                          className={`relative rounded-2xl p-5 text-left transition-all border ${
                            currentSlide === idx ? 'border-teal bg-teal/10' : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
                          }`}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#2f9c85' }}>
                            {idx < sections.length ? `${String(idx + 1).padStart(2, '0')}` : '★'}
                          </p>
                          <p className="text-xs font-semibold text-white/90 leading-snug line-clamp-2">
                            {sec ? (sec.title || 'Sem título') : 'Investimento'}
                          </p>
                          {sec && sec.content && (
                            <p className="text-[10px] text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{sec.content}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="wait" custom={slideDirection}>
                    <motion.div
                      key={currentSlide}
                      custom={slideDirection}
                      initial={{ x: slideDirection * 60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: slideDirection * -60, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                      className="absolute inset-0 flex flex-col items-center justify-center px-8 sm:px-16 py-10"
                    >
                      {currentSlide < sections.length ? (
                        <div className="w-full max-w-3xl flex flex-col items-center text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-5" style={{ color: '#2f9c85' }}>
                            {String(currentSlide + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
                          </p>
                          <h2 className="font-heading text-3xl sm:text-5xl text-white mb-6 leading-tight">
                            {sections[currentSlide].title || 'Sem título'}
                          </h2>
                          <p className="text-base sm:text-xl text-white/65 leading-relaxed max-w-2xl">
                            {sections[currentSlide].content || 'Sem conteúdo.'}
                          </p>
                          {sections[currentSlide].imageIds.length > 0 && (
                            <div className="mt-10 grid grid-cols-3 gap-3 w-full max-w-2xl">
                              {sections[currentSlide].imageIds.map(imgId => {
                                const doc = documents.find(d => d.id === imgId);
                                if (!doc) return null;
                                return (
                                  <div key={imgId} className="aspect-square relative rounded-xl overflow-hidden border border-white/10">
                                    <Image src={doc.thumbnail} alt={doc.name} fill className="object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full max-w-lg flex flex-col items-center text-center">
                          <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-5" style={{ color: '#2f9c85' }}>
                            Resumo do Investimento
                          </p>
                          <h2 className="font-heading text-3xl sm:text-5xl text-white mb-10 leading-tight">
                            Seu Investimento
                          </h2>
                          {!budgetExists ? (
                            <p className="text-white/40 italic">Nenhum orçamento gerado ainda.</p>
                          ) : (
                            <div className="w-full space-y-1">
                              {budgetProcedures.map(proc => (
                                <div key={proc.id} className="flex items-center justify-between py-3 border-b border-white/8">
                                  <span className="text-sm text-white/70 text-left pr-4">{proc.name}</span>
                                  <span className="font-mono text-sm font-semibold text-white shrink-0">
                                    R$ {proc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-5">
                                <span className="text-sm font-bold text-white/90">Total</span>
                                <span className="font-mono text-2xl sm:text-3xl font-bold" style={{ color: '#2f9c85' }}>
                                  R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </AnimatePresence>
            </div>

            {!overviewMode && (
              <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-4 shrink-0">
                <button
                  onClick={() => { setSlideDirection(-1); setCurrentSlide(prev => Math.max(0, prev - 1)); }}
                  disabled={currentSlide === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 transition-colors text-white/70 hover:text-white font-semibold text-sm disabled:opacity-25"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalSlides }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setSlideDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
                      className="transition-all rounded-full"
                      style={{ width: i === currentSlide ? 20 : 6, height: 6, background: i === currentSlide ? '#2f9c85' : 'rgba(255,255,255,0.20)' }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => { setSlideDirection(1); setCurrentSlide(prev => Math.min(totalSlides - 1, prev + 1)); }}
                  disabled={currentSlide === totalSlides - 1}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 transition-colors text-white/70 hover:text-white font-semibold text-sm disabled:opacity-25"
                >
                  Próximo <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="relative z-10 pb-3 flex justify-center">
              <p className="text-[10px] text-white/20 font-mono">← → navegar · O visão geral · Esc fechar</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── IMAGE PICKER MODAL ── */}
      <AnimatePresence>
        {isImagePickerOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImagePickerOpen(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] border border-border/40"
            >
              <div className="p-6 border-b border-border/60 flex items-center justify-between">
                <h3 className="font-heading text-xl text-text-primary">
                  Documentos do Paciente
                  {documents.length === 0 && <span className="text-sm font-normal text-text-secondary ml-2">— nenhum encontrado</span>}
                </h3>
                <button onClick={() => setIsImagePickerOpen(null)} className="p-2 rounded-xl hover:bg-surface-alt/50 transition-colors text-text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {documents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ImageIcon className="w-10 h-10 text-text-secondary/40 mb-3" />
                    <p className="text-sm font-medium text-text-secondary">Nenhum documento encontrado</p>
                    <p className="text-xs text-text-secondary/60 mt-1 max-w-xs">Adicione fotos ou radiografias na aba Documentos do paciente.</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  {documents.map(doc => {
                    const isSelected = sections.find(s => s.id === isImagePickerOpen)?.imageIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleImageSelection(isImagePickerOpen, doc.id)}
                        className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${isSelected ? 'border-teal' : 'border-transparent hover:border-border'}`}
                      >
                        <Image src={doc.thumbnail} alt={doc.name} fill className="object-cover" referrerPolicy="no-referrer" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-teal/20 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center shadow-lg">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 backdrop-blur-sm">
                          <div className="text-[8px] font-bold text-white uppercase truncate">{doc.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-border/60 bg-surface-alt/30 flex justify-end">
                <button
                  onClick={() => setIsImagePickerOpen(null)}
                  className="px-8 py-3 rounded-2xl bg-teal text-white font-bold text-sm hover:bg-teal-dark transition-colors shadow-[0_0_15px_rgba(47,156,133,0.3)]"
                >
                  Confirmar Seleção
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
