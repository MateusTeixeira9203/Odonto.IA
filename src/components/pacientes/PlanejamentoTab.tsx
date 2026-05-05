'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/help-tooltip';

// Verifica se a string é um UUID válido (indica que a seção está persistida no banco)
const isUUID = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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

  const router = useRouter();

  // Procedimentos da ficha sincronizados
  const [planProcs, setPlanProcs]           = useState<PlanProc[]>([]);
  const [procsExpanded, setProcsExpanded]   = useState(true);
  const [updatingProcId, setUpdatingProcId] = useState<string | null>(null);

  // Ref para acesso sempre atualizado nas funções de debounce
  const sectionsRef = useRef<Section[]>([]);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();

      type FichaRow = {
        id: string;
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
            .select('id, dentes_observacoes')
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

      // ── Sincroniza procedimentos das fichas ──────────────────────────────
      const rawProcs: { fichaRef: string; descricao: string; dente: number }[] = [];
      for (const ficha of (fichasResult.data ?? []) as FichaRow[]) {
        const obs = ficha.dentes_observacoes ?? {};
        for (const [dente, desc] of Object.entries(obs)) {
          if (typeof desc === 'string' && desc.trim()) {
            rawProcs.push({
              fichaRef: `${ficha.id}::${dente}`,
              descricao: desc.trim(),
              dente: parseInt(dente, 10),
            });
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
    if (patientId) {
      void fetchData();
    }
  }, [patientId, fetchData]);

  // Salva uma única seção no banco — usado pelo auto-save e pelo botão manual
  const saveSectionToDb = useCallback(async (sectionId: string): Promise<void> => {
    const section = sectionsRef.current.find(s => s.id === sectionId);
    if (!section) return;

    setSavingIds(prev => new Set([...prev, sectionId]));
    try {
      const supabase = createClient();
      const idx = sectionsRef.current.findIndex(s => s.id === sectionId);

      if (isUUID(section.id)) {
        // Seção já persistida: atualiza
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
        // Seção nova: insere e troca o ID temporário pelo UUID do banco
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
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
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
        }),
      });

      if (!response.ok) throw new Error('Falha ao gerar');
      const data = await response.json() as { texto?: string };
      if (data.texto) {
        updateSection(sectionId, 'content', data.texto);
      }
    } catch (error) {
      console.error('Erro ao gerar com IA:', error);
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
      ? `<table>
          <thead><tr><th>Procedimento</th><th>Valor</th></tr></thead>
          <tbody>
            ${budgetProcedures.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td><strong>Total</strong></td><td><strong>R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr></tfoot>
        </table>`
      : '<p style="color:#8a8a8a">Nenhum procedimento vinculado.</p>';

    const sectionsHTML = sectionsRef.current.map((s, i) => {
      const contentFormatted = s.content
        ? escapeHtml(s.content).replace(/\n/g, '<br>')
        : '<em style="color:#8a8a8a">Sem conteúdo.</em>';
      return `
      <div class="section">
        <h2>${String(i + 1).padStart(2, '0')}. ${escapeHtml(s.title || 'Seção sem título')}</h2>
        <p>${contentFormatted}</p>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(planningTitle)} — ${escapeHtml(patientName)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 780px; margin: 40px auto; color: #0d0d0d; line-height: 1.6; }
    header { border-bottom: 2px solid #2f9c85; padding-bottom: 16px; margin-bottom: 32px; }
    header small { display: block; color: #2f9c85; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    header p { margin: 4px 0 0; color: #8a8a8a; font-size: 13px; }
    .section { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #d4d1ca; }
    .section h2 { font-size: 18px; color: #2f9c85; margin: 0 0 10px; }
    .section p { margin: 0; font-size: 14px; }
    .budget { margin-top: 36px; }
    .budget h2 { font-size: 18px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f5f3ef; border-bottom: 2px solid #d4d1ca; }
    td { padding: 8px 12px; border-bottom: 1px solid #eceae4; }
    tfoot td { border-top: 2px solid #d4d1ca; border-bottom: none; font-size: 15px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <header>
    <small>Apresentação ao Paciente</small>
    <h1>${escapeHtml(planningTitle)}</h1>
    <p>Paciente: <strong>${escapeHtml(patientName)}</strong></p>
  </header>
  ${sectionsHTML}
  <div class="budget">
    <h2>Resumo do Investimento</h2>
    ${proceduresHTML}
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);
  const totalSlides = sections.length + 1; // +1 para o slide de orçamento

  const concluidosCount  = planProcs.filter(p => p.status === 'concluido').length;
  const progressPercent  = planProcs.length > 0
    ? Math.round((concluidosCount / planProcs.length) * 100)
    : 0;

  const getProcStatusLabel = (status: PlanProc['status']): string => {
    if (status === 'agendado')  return 'Agendado';
    if (status === 'concluido') return 'Concluído';
    return 'Pendente';
  };

  const getProcStatusNext = (status: PlanProc['status']): PlanProc['status'] => {
    if (status === 'pendente')  return 'agendado';
    if (status === 'agendado')  return 'concluido';
    return 'pendente';
  };

  const getProcStatusColor = (status: PlanProc['status']): string => {
    if (status === 'concluido') return 'bg-teal/10 text-teal border-teal/20';
    if (status === 'agendado')  return 'bg-teal/5 text-teal-lt border-teal/10';
    return 'bg-surface-alt text-text-secondary border-border/60';
  };

  const getSectionStatusColor = (status: Section['status']): string => {
    if (status === 'concluido')    return 'bg-teal/10 text-teal border-teal/20';
    if (status === 'em_andamento') return 'bg-teal/5 text-teal-lt border-teal/10';
    return 'bg-surface-alt text-text-secondary border-border/60';
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

    if (error ?? !data) {
      console.error('Erro ao criar seção:', error);
      return;
    }

    const newSection: Section = {
      id: (data as Record<string, unknown>).id as string,
      title: '',
      content: '',
      imageIds: [],
      status: 'pendente',
      dataEstimada: null,
    };
    setSections(prev => [...prev, newSection]);
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

    // Auto-save com debounce de 1 segundo
    clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      void saveSectionToDb(id);
    }, 1000);
  };

  const toggleImageSelection = (sectionId: string, imageId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const newImageIds = section.imageIds.includes(imageId)
      ? section.imageIds.filter(id => id !== imageId)
      : [...section.imageIds, imageId];

    updateSection(sectionId, 'imageIds', newImageIds);
  };

  const updateProcStatus = async (procId: string, newStatus: PlanProc['status']): Promise<void> => {
    setUpdatingProcId(procId);
    setPlanProcs(prev => prev.map(p => p.id === procId ? { ...p, status: newStatus } : p));
    const supabase = createClient();
    await supabase
      .from('planejamento_procedimentos')
      .update({ status: newStatus })
      .eq('id', procId);
    setUpdatingProcId(null);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho — Progresso + Ações */}
      <div className="bg-surface rounded-3xl border border-border/60 shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-2">
              Apresentação ao Paciente
            </div>
            <input
              type="text"
              value={planningTitle}
              onChange={(e) => setPlanningTitle(e.target.value)}
              className="font-heading text-3xl text-text-primary bg-transparent border-none outline-none w-full focus:ring-0 p-0"
              placeholder="Título do Planejamento"
            />

            {/* Barra de progresso */}
            {planProcs.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-secondary">
                    Progresso do tratamento
                  </span>
                  <span className="font-mono text-xs font-bold text-teal">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-surface-alt rounded-full h-2">
                  <div
                    className="bg-teal h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center gap-6 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-lg font-bold text-text-primary">
                      {planProcs.length}
                    </span>
                    <span className="text-xs text-text-secondary">procedimentos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-lg font-bold text-teal">
                      {concluidosCount}
                    </span>
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
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
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
              <Download className="w-4 h-4" /> Gerar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Seção de Procedimentos da Ficha */}
      {planProcs.length > 0 && (
        <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
          <button
            onClick={() => setProcsExpanded(prev => !prev)}
            className="w-full p-6 flex items-center justify-between hover:bg-surface-alt/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                Procedimentos da Ficha
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
                {planProcs.length}
              </span>
            </div>
            {procsExpanded
              ? <ChevronUp className="w-4 h-4 text-text-secondary" />
              : <ChevronDown className="w-4 h-4 text-text-secondary" />
            }
          </button>

          <AnimatePresence initial={false}>
            {procsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {planProcs.map(proc => (
                    <div
                      key={proc.id}
                      className="bg-surface-alt/50 border border-border/60 rounded-2xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {proc.dente && (
                            <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-0.5">
                              Dente {proc.dente}
                            </div>
                          )}
                          <p className="text-sm font-medium text-text-primary leading-snug">
                            {proc.descricao}
                          </p>
                        </div>
                        {updatingProcId === proc.id && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
                        <button
                          onClick={() => void updateProcStatus(proc.id, getProcStatusNext(proc.status))}
                          disabled={updatingProcId === proc.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${getProcStatusColor(proc.status)}`}
                        >
                          {proc.status === 'concluido' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : proc.status === 'agendado' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          {getProcStatusLabel(proc.status)}
                        </button>

                        {proc.status !== 'concluido' && (
                          <button
                            onClick={() => router.push('/dashboard/agendamentos')}
                            className="ml-auto p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors border border-transparent hover:border-teal/20"
                            title="Ir para agendamentos"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Seções */}
      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {sections.map((section, index) => (
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
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${getSectionStatusColor(section.status)}`}
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
                        title="Data estimada para esta etapa"
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
                      <HelpTooltip content="Descreva os procedimentos e a IA gera um orçamento profissional." className="ml-0.5" />
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
                            <Image
                              src={doc.thumbnail}
                              alt={doc.name}
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
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
          ))}
        </AnimatePresence>

        <button
          onClick={() => void addSection()}
          className="w-full py-6 border-2 border-dashed border-border rounded-3xl flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:border-text-primary transition-all group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-sm">Adicionar Nova Seção ao Plano</span>
        </button>
      </div>

      {/* Modal de Apresentação em Slides */}
      <AnimatePresence>
        {isPresentationOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-brand-charcoal flex flex-col"
          >
            {/* Barra superior */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/10">
              <span className="font-mono text-xs text-zinc-500">
                Slide {currentSlide + 1} de {totalSlides}
              </span>
              <button
                onClick={() => setIsPresentationOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do slide */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait" custom={slideDirection}>
                <motion.div
                  key={currentSlide}
                  custom={slideDirection}
                  initial={{ x: slideDirection * 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: slideDirection * -80, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="absolute inset-0 flex flex-col items-center justify-center px-16 py-12 max-w-5xl mx-auto w-full"
                >
                  {currentSlide < sections.length ? (
                    <>
                      <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-4">
                        {String(currentSlide + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
                      </div>
                      <h2 className="font-serif text-4xl text-white mb-6 text-center">
                        {sections[currentSlide].title || 'Sem título'}
                      </h2>
                      <p className="text-lg text-zinc-300 text-center leading-relaxed max-w-3xl">
                        {sections[currentSlide].content || 'Sem conteúdo.'}
                      </p>
                      {sections[currentSlide].imageIds.length > 0 && (
                        <div className="mt-10 grid grid-cols-3 gap-4 max-w-3xl w-full">
                          {sections[currentSlide].imageIds.map(imgId => {
                            const doc = documents.find(d => d.id === imgId);
                            if (!doc) return null;
                            return (
                              <div key={imgId} className="aspect-square relative rounded-2xl overflow-hidden border border-white/10">
                                <Image src={doc.thumbnail} alt={doc.name} fill className="object-cover" referrerPolicy="no-referrer" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-4">Resumo do Investimento</div>
                      <h2 className="font-serif text-4xl text-white mb-10 text-center">Seu Investimento em Saúde</h2>
                      {!budgetExists ? (
                        <p className="text-zinc-400 italic text-center">Nenhum orçamento gerado ainda.</p>
                      ) : (
                        <div className="w-full max-w-lg space-y-3">
                          {budgetProcedures.map(proc => (
                            <div key={proc.id} className="flex items-center justify-between py-3 border-b border-white/10">
                              <span className="text-sm font-medium text-zinc-300">{proc.name}</span>
                              <span className="font-mono text-sm font-semibold text-white">
                                R$ {proc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-4">
                            <span className="text-sm font-bold text-white">Total</span>
                            <span className="font-mono text-3xl font-bold text-white">
                              R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-white/10">
              <button
                onClick={() => { setSlideDirection(-1); setCurrentSlide(prev => prev - 1); }}
                disabled={currentSlide === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors text-white font-bold text-sm disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => { setSlideDirection(1); setCurrentSlide(prev => prev + 1); }}
                disabled={currentSlide === totalSlides - 1}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors text-white font-bold text-sm disabled:opacity-30"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Seleção de Imagens */}
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
                  {documents.length === 0 && (
                    <span className="text-sm font-normal text-text-secondary ml-2">— nenhum documento encontrado</span>
                  )}
                </h3>
                <button
                  onClick={() => setIsImagePickerOpen(null)}
                  className="p-2 rounded-xl hover:bg-surface-alt/50 transition-colors text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {documents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ImageIcon className="w-10 h-10 text-text-secondary/40 mb-3" />
                    <p className="text-sm font-medium text-text-secondary">Nenhum documento encontrado</p>
                    <p className="text-xs text-text-secondary/60 mt-1 max-w-xs">
                      Adicione fotos ou radiografias na aba Documentos do paciente.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  {documents.map(doc => {
                    const isSelected = sections.find(s => s.id === isImagePickerOpen)?.imageIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleImageSelection(isImagePickerOpen, doc.id)}
                        className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-4 transition-all ${
                          isSelected ? 'border-teal' : 'border-transparent hover:border-border'
                        }`}
                      >
                        <Image
                          src={doc.thumbnail}
                          alt={doc.name}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
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
