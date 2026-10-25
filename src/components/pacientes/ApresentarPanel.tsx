'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
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
  Type,
  ScanFace,
  Pencil,
  Circle,
  ArrowUpRight,
  PenTool,
  Minus,
} from 'lucide-react';
import Image from 'next/image';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { getSectionStatus } from '@/lib/constants/treatment-status';
import type { Tratamento } from '@/app/dashboard/pacientes/[id]/tratamento-actions';
import type { SectionTipo, AnotacaoOverlay, FormaDesenho } from '@/hooks/usePlanejamentoPaciente';
import { Odontograma } from '@/components/odontograma/Odontograma';
import type { OdontogramaEventoDraft } from '@/types/odontograma';
import { ANOTACAO_TIPOS, AnotacaoIcone } from './anotacao-simbolos';
import { CamadaAnotacaoImagem, type FerramentaAnotacao, type ModoInteracaoImagem } from './anotacao-overlay-imagem';
import { VisualizadorImagemClinica } from '@/components/imagens/visualizador-imagem-clinica';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const subscribeMounted = () => () => {};

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
  tipo: SectionTipo;
  title: string;
  content: string;
  imageIds: string[];
  anotacoes: AnotacaoOverlay[];
  status: 'pendente' | 'em_andamento' | 'concluido';
  dataEstimada: string | null;
}

const TIPO_BLOCO: { tipo: SectionTipo; label: string; icon: typeof Type }[] = [
  { tipo: 'texto', label: 'Texto', icon: Type },
  { tipo: 'imagem', label: 'Imagem', icon: ImageIcon },
  { tipo: 'odontograma', label: 'Odontograma', icon: ScanFace },
];

// ─── R-99 — ferramentas de desenho livre (D13, 10/08) — linha/círculo/seta/traço. ──
// Os 5 tipos com ícone (canal/coroa/implante/pino/extração) vêm de anotacao-simbolos.tsx;
// aqui só os 4 que não têm símbolo tipado, ícone genérico do lucide-react.

const DESENHO_TIPOS: { modo: FormaDesenho | 'traco'; label: string; Icon: typeof Circle }[] = [
  { modo: 'traco', label: 'Traço', Icon: PenTool },
  { modo: 'linha', label: 'Linha', Icon: Minus },
  { modo: 'circulo', label: 'Círculo', Icon: Circle },
  { modo: 'seta', label: 'Seta', Icon: ArrowUpRight },
];

function ferramentaEhIgual(a: FerramentaAnotacao | null, b: FerramentaAnotacao): boolean {
  if (!a || a.modo !== b.modo) return false;
  if (a.modo === 'icone' && b.modo === 'icone') return a.tipo === b.tipo;
  if (a.modo === 'forma' && b.modo === 'forma') return a.tipo === b.tipo;
  return true; // 'traco' não tem subtipo
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
  /** R-98a — bloco odontograma deriva sozinho daqui, sem escolha manual de dente. */
  odontogramaEventos: OdontogramaEventoDraft[];
  concluidosCount: number;
  progressPercent: number;
  totalBudget: number;
  savingIds: Set<string>;
  isGeneratingAI: string | null;
  isImagePickerOpen: string | null;
  setIsImagePickerOpen: (id: string | null) => void;
  onUpdateSection: (id: string, field: keyof Section, value: string | string[] | AnotacaoOverlay[]) => void;
  onRemoveSection: (id: string) => Promise<void>;
  onAddSection: (tipo: SectionTipo) => Promise<void>;
  onGenerateSectionWithAI: (id: string) => Promise<void>;
  onToggleImageSelection: (sectionId: string, imageId: string) => void;
  onGenerateFullPlanWithAI: () => Promise<void>;
  onSaveSectionToDb: (id: string) => Promise<void>;
}

// ─── Corpo do bloco imagem (R-98a) — picker de 1 doc + legenda ──────────────
// Nome e responsabilidade vêm do §4.2 da spec (árvore de componentes) — corpo próprio
// porque o layout (imagem grande + legenda) não tem nada em comum com o de texto.

function ImagemSectionBody({
  section, documents, onUpdateSection, onOpenPicker,
}: {
  section: Section;
  documents: Document[];
  onUpdateSection: (id: string, field: keyof Section, value: string | string[] | AnotacaoOverlay[]) => void;
  onOpenPicker: () => void;
}) {
  const doc = documents.find(d => d.id === section.imageIds[0]);
  // R-99 — ferramenta armada da paleta; null mantém seleção de anotações, sem criar outra.
  const [ferramenta, setFerramenta] = useState<FerramentaAnotacao | null>(null);
  const [modoInteracao, setModoInteracao] = useState<ModoInteracaoImagem>('navegar');

  return (
    <div className="p-8 space-y-4">
      {doc ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-surface-alt/40 p-1.5 w-fit">
            <button
              type="button"
              onClick={() => { setModoInteracao('navegar'); setFerramenta(null); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                modoInteracao === 'navegar' ? 'border-teal/50 bg-teal/15 text-teal-ink' : 'border-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              Navegar
            </button>
            <button
              type="button"
              onClick={() => setModoInteracao('anotar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                modoInteracao === 'anotar' ? 'border-teal/50 bg-teal/15 text-teal-ink' : 'border-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary'
              }`}
            >
              Anotar
            </button>
            <div className="mx-1 h-5 w-px bg-border" />
            {ANOTACAO_TIPOS.map(({ tipo, label }) => {
              const f: FerramentaAnotacao = { modo: 'icone', tipo };
              const ativa = ferramentaEhIgual(ferramenta, f);
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => { setModoInteracao('anotar'); setFerramenta(ativa ? null : f); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                    ativa ? 'border-teal/50 bg-teal/15 text-teal-ink' : 'border-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  <AnotacaoIcone tipo={tipo} className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
            <div className="mx-1 h-5 w-px bg-border" />
            {DESENHO_TIPOS.map(({ modo, label, Icon }) => {
              const f: FerramentaAnotacao = modo === 'traco' ? { modo: 'traco' } : { modo: 'forma', tipo: modo };
              const ativa = ferramentaEhIgual(ferramenta, f);
              return (
                <button
                  key={modo}
                  type="button"
                  onClick={() => { setModoInteracao('anotar'); setFerramenta(ativa ? null : f); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                    ativa ? 'border-teal/50 bg-teal/15 text-teal-ink' : 'border-transparent text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onOpenPicker}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
              >
                Trocar imagem
              </button>
            </div>
            <VisualizadorImagemClinica
              src={doc.thumbnail}
              alt={doc.name}
              contexto="editor_apresentacao"
              className="h-[420px] w-full"
              overlay={(
                <CamadaAnotacaoImagem
                  key={doc.id}
                  anotacoes={section.anotacoes}
                  onChange={(anotacoes) => onUpdateSection(section.id, 'anotacoes', anotacoes)}
                  ferramenta={ferramenta}
                  interativo={modoInteracao === 'anotar'}
                  cor="#22d3ee"
                  onFerramentaUsada={() => setFerramenta(null)}
                />
              )}
            />
          </div>
        </>
      ) : (
        <div
          onClick={onOpenPicker}
          className="h-48 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-alt/50 transition-colors"
        >
          <ImageIcon className="w-6 h-6 text-text-secondary" />
          <span className="text-xs font-medium text-text-secondary">Escolher radiografia ou foto</span>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
          Legenda (opcional)
        </label>
        <textarea
          value={section.content}
          onChange={(e) => onUpdateSection(section.id, 'content', e.target.value)}
          placeholder="Ex: Aqui entra o canal, e por cima a coroa."
          className="w-full h-20 bg-surface-alt/50 border border-border/60 rounded-2xl p-4 text-sm text-text-primary leading-relaxed outline-none focus:border-teal transition-colors resize-none"
        />
      </div>
    </div>
  );
}

// ─── Corpo do bloco odontograma (R-98a) — sem picker, deriva sozinho ────────
// Invariante §7: nunca escolha manual de dente. Editor mostra o Odontograma REAL (não
// presentationMode) — o dentista precisa da legenda/abas pra conferir o que vai aparecer;
// presentationMode só entra no slide, com o paciente olhando (ver SlidePresentation).

function OdontogramaSectionBody({
  section, eventos, onUpdateSection,
}: {
  section: Section;
  eventos: OdontogramaEventoDraft[];
  onUpdateSection: (id: string, field: keyof Section, value: string | string[] | AnotacaoOverlay[]) => void;
}) {
  return (
    <div className="p-8 space-y-4">
      {eventos.length > 0 ? (
        <div className="bg-surface-alt/30 border border-border/60 rounded-2xl p-4">
          <Odontograma
            selectedTeeth={[]}
            onToothToggle={() => {}}
            showCheckbox={false}
            eventosPersistidos={eventos}
          />
        </div>
      ) : (
        <div className="h-40 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-center px-6">
          <ScanFace className="w-6 h-6 text-text-secondary" />
          <span className="text-xs font-medium text-text-secondary">
            Nenhum evento registrado no odontograma deste paciente ainda
          </span>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">
          Nota (opcional)
        </label>
        <textarea
          value={section.content}
          onChange={(e) => onUpdateSection(section.id, 'content', e.target.value)}
          placeholder="Ex: O que eu proponho pra você"
          className="w-full h-16 bg-surface-alt/50 border border-border/60 rounded-2xl p-4 text-sm text-text-primary leading-relaxed outline-none focus:border-teal transition-colors resize-none"
        />
      </div>
    </div>
  );
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
  odontogramaEventos,
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
  const isMounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  // R-98a — confirmação destrutiva usa AlertDialog, nunca window.confirm (o paciente está
  // vendo a tela). O hook só executa; decidir SE confirma é do editor.
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingRegenerate, setPendingRegenerate] = useState(false);
  const [addingTipo, setAddingTipo] = useState(false);
  // R-99 (10/08) — marcar ao vivo durante a apresentação, atrás de botão revelar
  // (decisão dele: tela fica limpa pro paciente até o dentista precisar marcar).
  const [marcarAberto, setMarcarAberto] = useState(false);
  const [marcarFerramenta, setMarcarFerramenta] = useState<FerramentaAnotacao | null>(null);

  const totalSlides = sections.length + 2;
  // R-98a — slide de conteúdo (1..sections.length) muda de layout por tipo de bloco.
  const currentSection = currentSlide >= 1 && currentSlide <= sections.length ? sections[currentSlide - 1] : null;
  const isImagemSlide = currentSection?.tipo === 'imagem';

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- OD016-L33: reset coordena slides, marcacao e fullscreen; preservar ate QA proprio; dono ALFA - Dev 2 (lista unica no vault)
      setPanelTab('editar');
      setCurrentSlide(0);
      setOverviewMode(false);
      setMarcarAberto(false);
      setMarcarFerramenta(null);
    }
  }, [open]);

  // R-99 — marcação ao vivo fecha ao trocar de slide (só faz sentido na imagem atual).
  // Ajuste DURANTE o render, não useEffect: evita o round-trip de re-render que
  // setState-em-efeito causa (mesma razão do R-25, só que aqui resolvido na origem).
  const [slideDaMarcacao, setSlideDaMarcacao] = useState(currentSlide);
  if (slideDaMarcacao !== currentSlide) {
    setSlideDaMarcacao(currentSlide);
    setMarcarAberto(false);
    setMarcarFerramenta(null);
  }

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
      if (e.key === 'Escape') {
        // R-99 — Esc fecha a marcação primeiro (overlay mais local), só a 2ª vez sai da apresentação.
        if (marcarAberto) { setMarcarAberto(false); setMarcarFerramenta(null); return; }
        setPanelTab('editar'); setOverviewMode(false); return;
      }
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
  }, [open, panelTab, sections.length, onClose, marcarAberto]);

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
                          onClick={() => {
                            if (sections.length > 0) setPendingRegenerate(true);
                            else void onGenerateFullPlanWithAI();
                          }}
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
                                  onClick={() => setPendingRemoveId(section.id)}
                                  className="p-2 text-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {section.tipo === 'texto' && (
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
                            )}

                            {section.tipo === 'imagem' && (
                              <ImagemSectionBody
                                section={section}
                                documents={documents}
                                onUpdateSection={onUpdateSection}
                                onOpenPicker={() => setIsImagePickerOpen(section.id)}
                              />
                            )}

                            {section.tipo === 'odontograma' && (
                              <OdontogramaSectionBody
                                section={section}
                                eventos={odontogramaEventos}
                                onUpdateSection={onUpdateSection}
                              />
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {/* Add block — escolher tipo (R-98a) */}
                    {addingTipo ? (
                      <div className="w-full p-4 border-2 border-dashed border-teal/40 rounded-3xl flex flex-col sm:flex-row items-center gap-3">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-widest shrink-0 px-2">
                          Tipo do bloco
                        </span>
                        <div className="flex flex-1 flex-wrap gap-2 w-full">
                          {TIPO_BLOCO.map(({ tipo, label, icon: Icon }) => (
                            <button
                              key={tipo}
                              onClick={() => { setAddingTipo(false); void onAddSection(tipo); }}
                              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-2xl bg-surface-alt border border-border text-text-primary text-sm font-bold hover:border-teal hover:text-teal transition-colors"
                            >
                              <Icon className="w-4 h-4" /> {label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setAddingTipo(false)}
                          className="p-2 text-text-secondary hover:text-text-primary transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTipo(true)}
                        className="w-full py-6 border-2 border-dashed border-border rounded-3xl flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:border-text-primary transition-all group"
                      >
                        <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-sm">Adicionar Bloco</span>
                      </button>
                    )}
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
                  {isImagemSlide && (
                    <button
                      onClick={() => { setMarcarAberto(prev => !prev); setMarcarFerramenta(null); }}
                      className={`p-2 rounded-lg transition-colors ${marcarAberto ? 'bg-teal/20 text-teal' : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/80'}`}
                      title="Marcar no raio-x"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
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
                      <div className={isImagemSlide ? 'relative w-full h-full' : 'min-h-full flex flex-col items-center justify-center px-8 sm:px-16 py-10'}>
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
                        ) : currentSlide <= sections.length && currentSection?.tipo === 'imagem' ? (
                          /* Content slide — imagem em tela cheia (§6 da spec: geometria do artefato) */
                          (() => {
                            const doc = documents.find(d => d.id === currentSection.imageIds[0]);
                            return (
                              <>
                                <div className="absolute inset-0 p-6 sm:p-10">
                                  {doc ? (
                                    <VisualizadorImagemClinica
                                      src={doc.thumbnail}
                                      alt={doc.name}
                                      className="h-full w-full"
                                      contexto="apresentacao"
                                      overlay={(
                                        <CamadaAnotacaoImagem
                                          key={doc.id}
                                          anotacoes={currentSection.anotacoes}
                                          onChange={(anotacoes) => onUpdateSection(currentSection.id, 'anotacoes', anotacoes)}
                                          ferramenta={marcarFerramenta}
                                          interativo={marcarAberto}
                                          cor="#22d3ee"
                                          onFerramentaUsada={() => setMarcarFerramenta(null)}
                                        />
                                      )}
                                    />
                                  ) : (
                                    <p className="text-white/40 italic">Nenhuma imagem selecionada.</p>
                                  )}
                                </div>
                                {marcarAberto && (
                                  <div
                                    className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-2xl px-2 py-2"
                                    style={{ background: 'rgba(20,24,23,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}
                                  >
                                    {ANOTACAO_TIPOS.map(({ tipo, label }) => {
                                      const f: FerramentaAnotacao = { modo: 'icone', tipo };
                                      const ativa = ferramentaEhIgual(marcarFerramenta, f);
                                      return (
                                        <button
                                          key={tipo}
                                          type="button"
                                          onClick={() => setMarcarFerramenta(ativa ? null : f)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                                          style={ativa ? { background: 'rgba(47,156,133,0.22)', color: '#5dbeb0' } : { color: 'rgba(255,255,255,0.55)' }}
                                        >
                                          <AnotacaoIcone tipo={tipo} className="h-4 w-4" />
                                          {label}
                                        </button>
                                      );
                                    })}
                                    <div className="mx-1 h-5 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                                    {DESENHO_TIPOS.map(({ modo, label, Icon }) => {
                                      const f: FerramentaAnotacao = modo === 'traco' ? { modo: 'traco' } : { modo: 'forma', tipo: modo };
                                      const ativa = ferramentaEhIgual(marcarFerramenta, f);
                                      return (
                                        <button
                                          key={modo}
                                          type="button"
                                          onClick={() => setMarcarFerramenta(ativa ? null : f)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                                          style={ativa ? { background: 'rgba(47,156,133,0.22)', color: '#5dbeb0' } : { color: 'rgba(255,255,255,0.55)' }}
                                        >
                                          <Icon className="h-4 w-4" />
                                          {label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {currentSection.content && (
                                  <div
                                    className="absolute left-0 right-0 bottom-0 px-10 sm:px-16 pt-24 pb-10 text-center"
                                    style={{ background: 'linear-gradient(to top, rgba(8,12,11,0.94) 0%, rgba(8,12,11,0.6) 55%, transparent 100%)' }}
                                  >
                                    <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-2xl mx-auto">
                                      {currentSection.content}
                                    </p>
                                  </div>
                                )}
                              </>
                            );
                          })()
                        ) : currentSlide <= sections.length && currentSection?.tipo === 'odontograma' ? (
                          /* Content slide — odontograma (§6 da spec: 77%x55%, título 26px, folga >=56px) */
                          <div className="w-full max-w-4xl flex flex-col items-center text-center">
                            <p className="text-xs font-bold uppercase tracking-[0.25em] mb-2" style={{ color: '#2f9c85' }}>
                              {String(currentSlide).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}
                            </p>
                            <h2 className="font-heading text-white leading-tight" style={{ fontSize: 26 }}>
                              {currentSection.title || 'Sem título'}
                            </h2>
                            {odontogramaEventos.length > 0 ? (
                              <>
                                <div className="w-full flex justify-center" style={{ transform: 'scale(1.28)', margin: '56px 0' }}>
                                  <Odontograma
                                    selectedTeeth={[]}
                                    onToothToggle={() => {}}
                                    showCheckbox={false}
                                    hideFilters
                                    presentationMode
                                    eventosPersistidos={odontogramaEventos}
                                  />
                                </div>
                                <div className="flex items-center gap-6 flex-wrap justify-center">
                                  <span className="flex items-center gap-2 text-sm text-white/60">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#ef9a9a' }} /> A fazer
                                  </span>
                                  <span className="flex items-center gap-2 text-sm text-white/60">
                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#2f9c85' }} /> Já feito
                                  </span>
                                </div>
                              </>
                            ) : (
                              <p className="text-white/40 italic" style={{ margin: '56px 0' }}>Nenhum procedimento indicado ainda.</p>
                            )}
                            {currentSection.content && (
                              <p className="text-sm text-white/50 mt-4 max-w-xl">{currentSection.content}</p>
                            )}
                          </div>
                        ) : currentSlide <= sections.length ? (
                          /* Content slide — texto (inalterado) */
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
                    const targetSection = sections.find(s => s.id === isImagePickerOpen);
                    const isSelected = targetSection?.imageIds.includes(doc.id);
                    // Bloco imagem guarda 0..1 (invariante §4.1) — escolher já fecha, sem
                    // "Confirmar Seleção". Bloco texto continua multi-seleção, como sempre foi.
                    const isSingleSelect = targetSection?.tipo === 'imagem';
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          if (isSingleSelect) {
                            onUpdateSection(isImagePickerOpen, 'imageIds', [doc.id]);
                            // R-99 (I4) — troca de imagem zera as anotações: a coordenada é
                            // relativa à imagem antiga, não faz sentido sobre a nova.
                            onUpdateSection(isImagePickerOpen, 'anotacoes', []);
                            setIsImagePickerOpen(null);
                          } else {
                            onToggleImageSelection(isImagePickerOpen, doc.id);
                          }
                        }}
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

      {/* ── AlertDialog: remover bloco (R-98a — nunca window.confirm, o paciente vê a tela) ── */}
      <AlertDialog open={!!pendingRemoveId} onOpenChange={(o) => { if (!o) setPendingRemoveId(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold text-xl">Remover este bloco?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveId) void onRemoveSection(pendingRemoveId);
                setPendingRemoveId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: regenerar com IA por cima de blocos existentes ── */}
      <AlertDialog open={pendingRegenerate} onOpenChange={setPendingRegenerate}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold text-xl">Refazer a apresentação?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Os {sections.length} bloco{sections.length !== 1 ? 's' : ''} atual{sections.length !== 1 ? 'is' : ''} ser{sections.length !== 1 ? 'ão' : 'á'} apagado{sections.length !== 1 ? 's' : ''} e substituído{sections.length !== 1 ? 's' : ''} pelo que a IA gerar. Não dá pra desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingRegenerate(false);
                void onGenerateFullPlanWithAI();
              }}
            >
              Refazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
    document.body
  );
}
