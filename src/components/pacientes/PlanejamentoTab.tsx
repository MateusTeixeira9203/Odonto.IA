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
} from 'lucide-react';
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

      const [docsResult, budgetResult, secoesResult] = await Promise.all([
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
          }))
        );
      }
    } catch (error) {
      console.error('Erro ao buscar dados de planejamento:', JSON.stringify(error), error);
    } finally {
      setLoadingData(false);
    }
  }, [patientId]);

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

  const handleGerarPDF = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const proceduresHTML = budgetProcedures.length > 0
      ? `<table>
          <thead><tr><th>Procedimento</th><th>Valor</th></tr></thead>
          <tbody>
            ${budgetProcedures.map(p => `<tr><td>${p.name}</td><td>R$ ${p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td><strong>Total</strong></td><td><strong>R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td></tr></tfoot>
        </table>`
      : '<p style="color:#8a8a8a">Nenhum procedimento vinculado.</p>';

    const sectionsHTML = sectionsRef.current.map((s, i) => `
      <div class="section">
        <h2>${String(i + 1).padStart(2, '0')}. ${s.title || 'Seção sem título'}</h2>
        <p>${s.content || '<em style="color:#8a8a8a">Sem conteúdo.</em>'}</p>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${planningTitle} — ${patientName}</title>
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
    <h1>${planningTitle}</h1>
    <p>Paciente: <strong>${patientName}</strong></p>
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

  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Cabeçalho da Apresentação */}
      <div className="bg-surface rounded-3xl border border-border/60 shadow-sm p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-2">Apresentação ao Paciente</div>
            <input
              type="text"
              value={planningTitle}
              onChange={(e) => setPlanningTitle(e.target.value)}
              className="font-heading text-3xl text-text-primary bg-transparent border-none outline-none w-full focus:ring-0 p-0"
              placeholder="Título do Planejamento"
            />
            <div className="flex items-center gap-2 mt-2 text-text-secondary text-sm font-medium">
              <Calendar className="w-4 h-4" />
              Criado em 19 de Março, 2026
            </div>
          </div>
          <div className="flex items-center gap-3">
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
              <Download className="w-4 h-4" /> Gerar PDF da Apresentação
            </button>
          </div>
        </div>
      </div>

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
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-text-primary text-bg flex items-center justify-center font-mono text-xs font-bold">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                    placeholder="Título da Seção (ex: Situação Atual)"
                    className="font-heading text-xl text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 min-w-[300px]"
                  />
                </div>
                <div className="flex items-center gap-1">
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
                      <HelpTooltip content="Descreva os procedimentos e a IA gera um orçamento profissional." className="ml-0.5" />
                    </button>
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
                      <Plus className="w-3 h-3" /> Selecionar do Histórico
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
                <h3 className="font-heading text-xl text-text-primary">Selecionar Imagens do Histórico</h3>
                <button
                  onClick={() => setIsImagePickerOpen(null)}
                  className="p-2 rounded-xl hover:bg-surface-alt/50 transition-colors text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
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
