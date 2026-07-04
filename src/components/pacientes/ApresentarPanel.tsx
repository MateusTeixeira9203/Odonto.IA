'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Loader2,
  Save,
  Presentation,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import Image from 'next/image';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { getSectionStatus } from '@/lib/constants/treatment-status';
import type { Tratamento } from '@/app/dashboard/pacientes/[id]/tratamento-actions';

// ─── Types (mirrored from PlanejamentoTab) ──────────────────────────────────

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
  status: 'nao_iniciado' | 'em_andamento' | 'concluido';
  fichaRef: string | null;
  ordem: number;
}

interface BudgetProcedure {
  id: string;
  name: string;
  value: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const Q_LABELS: Record<string, { short: string; long: string; teeth: number[] }> = {
  Q1: { short: 'Sup. Dir.', long: 'Superior Direito', teeth: [11,12,13,14,15,16,17,18] },
  Q2: { short: 'Sup. Esq.', long: 'Superior Esquerdo', teeth: [21,22,23,24,25,26,27,28] },
  Q3: { short: 'Inf. Esq.', long: 'Inferior Esquerdo', teeth: [31,32,33,34,35,36,37,38] },
  Q4: { short: 'Inf. Dir.', long: 'Inferior Direito', teeth: [41,42,43,44,45,46,47,48] },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ApresentarPanelProps {
  open: boolean;
  onClose: () => void;
  patientName: string;
  planningTitle: string;
  tratamentoAtivo: Tratamento | null;
  sections: Section[];
  planProcs: PlanProc[];
  documents: Document[];
  budgetProcedures: BudgetProcedure[];
  budgetExists: boolean;
  concluidosCount: number;
  progressPercent: number;
  totalBudget: number;
  savingIds: Set<string>;
  isGeneratingAI: string | null;
  isImagePickerOpen: string | null;
  setIsImagePickerOpen: (id: string | null) => void;
  onUpdateSection: (id: string, field: keyof Section, value: string | string[]) => void;
  onRemoveSection: (id: string) => Promise<void>;
  onAddSection: () => Promise<void>;
  onGenerateSectionWithAI: (id: string) => Promise<void>;
  onToggleImageSelection: (sectionId: string, imageId: string) => void;
  onGenerateFullPlanWithAI: () => Promise<void>;
  onSaveSectionToDb: (id: string) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApresentarPanel({
  open,
  onClose,
  patientName,
  planningTitle,
  planProcs,
  sections,
  documents,
  budgetProcedures,
  budgetExists,
  concluidosCount,
  progressPercent,
  totalBudget,
  savingIds,
  isGeneratingAI,
  isImagePickerOpen,
  setIsImagePickerOpen,
  onUpdateSection,
  onRemoveSection,
  onAddSection,
  onGenerateSectionWithAI,
  onToggleImageSelection,
  onGenerateFullPlanWithAI,
  onSaveSectionToDb,
}: ApresentarPanelProps) {
  const [panelTab, setPanelTab] = useState<'editar' | 'apresentar'>('editar');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [overviewMode, setOverviewMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const totalSlides = sections.length + 2;

  useEffect(() => setIsMounted(true), []);

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setPanelTab('editar');
      setCurrentSlide(0);
      setOverviewMode(false);
    }
  }, [open]);

  // Fullscreen: enter when presenting, exit when closing or going back to editor
  useEffect(() => {
    if (open && panelTab === 'apresentar') {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open, panelTab]);

  // Lock body scroll when panel is open (prevents page scrollbars showing behind overlay)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Keyboard navigation in presentation mode
  useEffect(() => {
    if (!open || panelTab !== 'apresentar') return;
    const maxSlide = sections.length + 1;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanelTab('editar'); setOverviewMode(false); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide(prev => {
          if (prev < maxSlide) { setSlideDirection(1); return prev + 1; }
          return prev;
        });
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlide(prev => {
          if (prev > 0) { setSlideDirection(-1); return prev - 1; }
          return prev;
        });
      }
      if (e.key === 'o' || e.key === 'O') setOverviewMode(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, panelTab, sections.length, onClose]);

  if (!isMounted) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          panelTab === 'editar' ? (
            /* ── EDITOR MODE — centered modal ── */
            <motion.div
              key="editor-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                onClick={onClose}
              />

              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="relative z-10 flex flex-col w-full max-w-5xl bg-surface rounded-3xl overflow-hidden border border-border/40 shadow-2xl"
                style={{ height: 'min(90vh, 820px)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0 bg-surface">
                  <div>
                    <p className="text-xs font-bold text-teal uppercase tracking-[0.2em]">
                      Apresentação · {patientName}
                    </p>
                    <p className="font-heading text-lg text-text-primary leading-tight mt-0.5">
                      {planningTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setCurrentSlide(0); setPanelTab('apresentar'); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal/90 transition-colors shadow-[0_0_12px_rgba(47,156,133,0.3)]"
                    >
                      <Presentation className="w-4 h-4" /> Apresentar para o paciente
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-xl hover:bg-surface-alt/60 text-text-secondary transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6 space-y-6 pb-20">

                    {/* AI — Gerar plano completo */}
                    {(budgetProcedures.length > 0 || planProcs.length > 0) && (
                      <div className="flex items-center justify-between px-5 py-4 bg-surface-alt/40 border border-border/40 rounded-2xl">
                        <div>
                          <p className="text-sm font-bold text-text-primary">Gerar apresentação com IA</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Cria automaticamente as seções com base nos procedimentos do paciente.
                          </p>
                        </div>
                        <button
                          onClick={() => void onGenerateFullPlanWithAI()}
                          disabled={isGeneratingAI !== null}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-text-primary text-sm font-bold hover:bg-surface-alt transition-all disabled:opacity-50 shrink-0 ml-4"
                        >
                          {isGeneratingAI === '__full__'
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                            : <><Sparkles className="w-3.5 h-3.5 text-teal" /> Gerar apresentação</>
                          }
                        </button>
                      </div>
                    )}

                    {/* Sections */}
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
                                    onChange={(e) => onUpdateSection(section.id, 'title', e.target.value)}
                                    placeholder="Título da Seção (ex: Situação Atual)"
                                    className="font-heading text-xl text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                                  />
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <select
                                      value={section.status}
                                      onChange={(e) => onUpdateSection(section.id, 'status', e.target.value as Section['status'])}
                                      className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${secSt.className}`}
                                      style={{ appearance: 'none' }}
                                    >
                                      <option value="pendente">Pendente</option>
                                      <option value="em_andamento">Em Andamento</option>
                                      <option value="concluido">Concluído</option>
                                    </select>
                                    <input
                                      type="date"
                                      value={section.dataEstimada ?? ''}
                                      onChange={(e) => onUpdateSection(section.id, 'dataEstimada', e.target.value || '')}
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
                                    onClick={() => void onSaveSectionToDb(section.id)}
                                    className="p-2 text-text-secondary hover:text-teal transition-colors opacity-0 group-hover:opacity-100"
                                    title="Salvar seção"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => void onRemoveSection(section.id)}
                                  className="p-2 text-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                                    Explicação para o Paciente
                                  </label>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => void onGenerateSectionWithAI(section.id)}
                                      disabled={isGeneratingAI === section.id || !section.title}
                                      className="text-teal text-xs font-bold flex items-center gap-1 hover:text-teal-dark transition-colors disabled:opacity-50"
                                    >
                                      {isGeneratingAI === section.id
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <Sparkles className="w-3 h-3" />
                                      }
                                      Gerar com a IA
                                    </button>
                                    <HelpTooltip content="Descreva os procedimentos e a IA gera um texto profissional." className="ml-0.5" />
                                  </div>
                                </div>
                                <textarea
                                  value={section.content}
                                  onChange={(e) => onUpdateSection(section.id, 'content', e.target.value)}
                                  placeholder="Descreva aqui o que o paciente precisa entender de forma simples..."
                                  className="w-full h-40 bg-surface-alt/50 border border-border/60 rounded-2xl p-4 text-sm text-text-primary leading-relaxed outline-none focus:border-teal transition-colors resize-none"
                                />
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                                    Imagens Ilustrativas
                                  </label>
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
                                            onClick={() => onToggleImageSelection(section.id, imgId)}
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

                    {/* Add section button */}
                    <button
                      onClick={() => void onAddSection()}
                      className="w-full py-6 border-2 border-dashed border-border rounded-3xl flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:border-text-primary transition-all group"
                    >
                      <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-sm">Adicionar Nova Seção ao Plano</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            /* ── PRESENTATION MODE — fullscreen ── */
            <motion.div
              key="presentation-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] flex flex-col select-none overflow-hidden"
              style={{ background: '#080c0b' }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(47,156,133,0.08) 0%, transparent 70%)' }} />

              {/* Presentation header */}
              <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: '#2f9c85' }}>
                    <Presentation className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white/90 leading-none">{planningTitle}</p>
                    <p className="text-xs text-white/35 mt-0.5">{patientName}</p>
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
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/8 hover:bg-white/15 transition-colors text-white/60 hover:text-white"
                    title="Fechar apresentação (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Slides area */}
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
                        {[null, ...sections, null].map((sec, idx) => (
                          <button
                            key={idx}
                            onClick={() => { setCurrentSlide(idx); setOverviewMode(false); }}
                            className={`relative rounded-2xl p-5 text-left transition-all border ${
                              currentSlide === idx ? 'border-teal bg-teal/10' : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
                            }`}
                          >
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#2f9c85' }}>
                              {idx === 0 ? '◎' : idx <= sections.length ? String(idx).padStart(2, '0') : '★'}
                            </p>
                            <p className="text-xs font-semibold text-white/90 leading-snug line-clamp-2">
                              {idx === 0 ? 'Progresso' : sec ? ((sec as Section).title || 'Sem título') : 'Investimento'}
                            </p>
                            {sec && (sec as Section).content && (
                              <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{(sec as Section).content}</p>
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
                        className="absolute inset-0 overflow-y-auto"
                        style={{ overscrollBehavior: 'contain' }}
                      >
                      <div className="min-h-full flex flex-col items-center justify-center px-8 sm:px-16 py-10">
                        {currentSlide === 0 ? (
                          /* Slide 0: Progresso */
                          <div className="w-full max-w-lg flex flex-col items-center text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-4" style={{ color: '#2f9c85' }}>
                              Progresso do Tratamento
                            </p>
                            <h2 className="font-heading text-3xl sm:text-5xl text-white mb-2 leading-tight">
                              {patientName}
                            </h2>
                            <p className="text-white/45 text-sm mb-10">
                              {planProcs.length} procedimento{planProcs.length !== 1 ? 's' : ''} · {concluidosCount} concluído{concluidosCount !== 1 ? 's' : ''}
                            </p>

                            <div className="relative w-32 h-32 mb-10">
                              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                                <circle cx="64" cy="64" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                                <circle
                                  cx="64" cy="64" r="52"
                                  fill="none"
                                  stroke="#2f9c85"
                                  strokeWidth="10"
                                  strokeLinecap="round"
                                  strokeDasharray={`${2 * Math.PI * 52}`}
                                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPercent / 100)}`}
                                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                <span className="text-3xl font-bold text-white leading-none">{progressPercent}%</span>
                                <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">concluído</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(qKey => {
                                const qProcs = planProcs.filter(p => p.dente && Q_LABELS[qKey].teeth.includes(p.dente));
                                if (qProcs.length === 0) return null;
                                const qDone = qProcs.filter(p => p.status === 'concluido').length;
                                const pct = Math.round((qDone / qProcs.length) * 100);
                                return (
                                  <div key={qKey} className="rounded-2xl p-4 text-left border border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#2f9c85' }}>
                                      {Q_LABELS[qKey].short}
                                    </p>
                                    <p className="text-white text-sm font-semibold mb-2">{qDone}/{qProcs.length}</p>
                                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.10)' }}>
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#2f9c85', transition: 'width 0.6s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : currentSlide <= sections.length ? (
                          /* Content slides */
                          <div className="w-full max-w-3xl flex flex-col items-center text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: '#2f9c85' }}>
                              {String(currentSlide).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
                            </p>
                            <h2 className="font-heading text-3xl sm:text-5xl text-white mb-6 leading-tight">
                              {sections[currentSlide - 1].title || 'Sem título'}
                            </h2>
                            <p className="text-base sm:text-xl text-white/65 leading-relaxed max-w-2xl">
                              {sections[currentSlide - 1].content || 'Sem conteúdo.'}
                            </p>
                            {sections[currentSlide - 1].imageIds.length > 0 && (
                              <div className="mt-10 grid grid-cols-3 gap-3 w-full max-w-2xl">
                                {sections[currentSlide - 1].imageIds.map(imgId => {
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
                          /* Final slide: Investment */
                          <div className="w-full max-w-lg flex flex-col items-center text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-5" style={{ color: '#2f9c85' }}>
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
                      </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation */}
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
                <p className="text-xs text-white/20 font-mono">← → navegar · O visão geral · Esc fechar</p>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* ── IMAGE PICKER MODAL ── */}
      <AnimatePresence>
        {isImagePickerOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
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
                        onClick={() => onToggleImageSelection(isImagePickerOpen, doc.id)}
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
                          <div className="text-[10px] font-bold text-white uppercase truncate">{doc.name}</div>
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
    </>,
    document.body
  );
}
