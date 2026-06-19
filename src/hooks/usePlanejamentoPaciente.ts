'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Tipos (espelhados do ApresentarPanel) ──────────────────────────────────

export interface PlanDocument {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  url: string;
}

export interface PlanSection {
  id: string;
  title: string;
  content: string;
  imageIds: string[];
  status: 'pendente' | 'em_andamento' | 'concluido';
  dataEstimada: string | null;
}

export interface PlanProc {
  id: string;
  descricao: string;
  dente: number | null;
  status: 'pendente' | 'agendado' | 'concluido';
  fichaRef: string | null;
  ordem: number;
}

export interface PlanBudgetProcedure {
  id: string;
  name: string;
  value: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isUUID = (str: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
  return procs.filter((p) => {
    const key = p.fichaRef ?? p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Motor de planejamento por paciente (seções + procedimentos + orçamento + documentos).
 * Extraído do antigo PlanejamentoTab — agora nível paciente (modelo 1 ficha = 1 tratamento):
 * os procedimentos derivam de TODAS as fichas do paciente, sem filtro de tratamento.
 */
export function usePlanejamentoPaciente(patientId: string, clinicaId: string, patientName: string, enabled = true, fichaId?: string) {
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [documents, setDocuments] = useState<PlanDocument[]>([]);
  const [budgetProcedures, setBudgetProcedures] = useState<PlanBudgetProcedure[]>([]);
  const [budgetExists, setBudgetExists] = useState(false);
  const [planProcs, setPlanProcs] = useState<PlanProc[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState<string | null>(null);

  const sectionsRef = useRef<PlanSection[]>([]);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  // ── Fetch: seções + orçamento + documentos (nível paciente) ──
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
        setBudgetProcedures(((budgetResult.data.orcamento_itens as Array<Record<string, unknown>>) ?? []).map((p) => ({
          id: p.id as string, name: p.descricao as string, value: p.preco_total as number,
        })));
      } else {
        setBudgetExists(false);
        setBudgetProcedures([]);
      }
      if (secoesResult.error) throw secoesResult.error;
      if (secoesResult.data && secoesResult.data.length > 0) {
        setSections((secoesResult.data as Array<Record<string, unknown>>).map((row) => ({
          id: row.id as string, title: row.titulo as string, content: (row.conteudo as string) ?? '',
          imageIds: (row.imagem_ids as string[]) ?? [], status: ((row.status as string) ?? 'pendente') as PlanSection['status'],
          dataEstimada: (row.data_estimada as string | null) ?? null,
        })));
      }
    } catch (error) {
      console.error('[usePlanejamentoPaciente] fetchGlobalData:', error);
    } finally {
      setLoadingData(false);
    }
  }, [patientId]);

  // ── Fetch: procedimentos derivados de TODAS as fichas do paciente ──
  const fetchPlanProcs = useCallback(async () => {
    const supabase = createClient();
    type FichaRow = { id: string; created_at: string; dentes_observacoes: Record<string, string> | null };
    const [fichasResult, existingProcsResult] = await Promise.all([
      supabase.from('fichas').select('id, created_at, dentes_observacoes').eq('paciente_id', patientId).not('dentes_observacoes', 'is', null),
      supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
    ]);
    const allFichas = (fichasResult.data ?? []) as FichaRow[];
    const fichas = allFichas.filter((f) => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0);
    const fichaIds = new Set(fichas.map((f) => f.id));

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

    // Limpa procedimentos órfãos (ficha apagada)
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
    const toInsert = rawProcs.filter((p) => !existingRefs.has(p.fichaRef));
    if (toInsert.length > 0) {
      const startOrdem = (existingProcsResult.data ?? []).length;
      await supabase.from('planejamento_procedimentos').insert(toInsert.map((p, i) => ({
        clinica_id: clinicaId, paciente_id: patientId, descricao: p.descricao, dente: p.dente, status: 'pendente', ficha_ref: p.fichaRef, ordem: startOrdem + i,
      })));
      const { data: refreshed } = await supabase.from('planejamento_procedimentos').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true });
      const all = dedupProcs((refreshed ?? []).map((r) => mapPlanProc(r as Record<string, unknown>)));
      setPlanProcs(fichaId ? all.filter((p) => p.fichaRef?.startsWith(fichaId)) : all);
    } else {
      const all = dedupProcs((existingProcsResult.data ?? []).map((r) => mapPlanProc(r as Record<string, unknown>)));
      setPlanProcs(fichaId ? all.filter((p) => p.fichaRef?.startsWith(fichaId)) : all);
    }
  }, [patientId, clinicaId, fichaId]);

  useEffect(() => {
    if (!patientId || !enabled) return;
    void fetchGlobalData();
    void fetchPlanProcs();
  }, [patientId, enabled, fetchGlobalData, fetchPlanProcs]);

  // ── Handlers de seção ──
  const saveSectionToDb = useCallback(async (sectionId: string): Promise<void> => {
    const section = sectionsRef.current.find((s) => s.id === sectionId);
    if (!section) return;
    setSavingIds((prev) => new Set([...prev, sectionId]));
    try {
      const supabase = createClient();
      const idx = sectionsRef.current.findIndex((s) => s.id === sectionId);
      if (isUUID(section.id)) {
        await supabase.from('planejamento_secoes').upsert({
          id: section.id, clinica_id: clinicaId, paciente_id: patientId,
          titulo: section.title, conteudo: section.content, imagem_ids: section.imageIds,
          ordem: idx, status: section.status, data_estimada: section.dataEstimada || null,
          updated_at: new Date().toISOString(),
        });
      } else {
        const { data } = await supabase.from('planejamento_secoes').insert({
          clinica_id: clinicaId, paciente_id: patientId, titulo: section.title, conteudo: section.content,
          imagem_ids: section.imageIds, ordem: idx, status: section.status, data_estimada: section.dataEstimada || null,
        }).select('id').single();
        if (data) {
          const newId = (data as Record<string, unknown>).id as string;
          setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, id: newId } : s)));
        }
      }
    } catch (error) {
      console.error('[usePlanejamentoPaciente] saveSectionToDb:', error);
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(sectionId); return next; });
    }
  }, [clinicaId, patientId]);

  const updateSection = useCallback((id: string, field: keyof PlanSection, value: string | string[]) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => void saveSectionToDb(id), 1000);
  }, [saveSectionToDb]);

  const toggleImageSelection = useCallback((sectionId: string, imageId: string) => {
    const section = sectionsRef.current.find((s) => s.id === sectionId);
    if (!section) return;
    const newImageIds = section.imageIds.includes(imageId)
      ? section.imageIds.filter((id) => id !== imageId)
      : [...section.imageIds, imageId];
    updateSection(sectionId, 'imageIds', newImageIds);
  }, [updateSection]);

  const addSection = useCallback(async (): Promise<void> => {
    const supabase = createClient();
    const newOrder = sectionsRef.current.length;
    const { data, error } = await supabase.from('planejamento_secoes').insert({
      clinica_id: clinicaId, paciente_id: patientId, titulo: '', conteudo: '',
      imagem_ids: [], ordem: newOrder, status: 'pendente', data_estimada: null,
    }).select('id').single();
    if (error ?? !data) { console.error('[usePlanejamentoPaciente] addSection:', error); return; }
    setSections((prev) => [...prev, {
      id: (data as Record<string, unknown>).id as string,
      title: '', content: '', imageIds: [], status: 'pendente', dataEstimada: null,
    }]);
  }, [clinicaId, patientId]);

  const removeSection = useCallback(async (id: string): Promise<void> => {
    if (!window.confirm('Remover esta seção do planejamento?')) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    clearTimeout(debounceTimers.current[id]);
    delete debounceTimers.current[id];
    if (isUUID(id)) {
      const supabase = createClient();
      await supabase.from('planejamento_secoes').delete().eq('id', id);
    }
  }, []);

  const generateSectionWithAI = useCallback(async (sectionId: string): Promise<void> => {
    const section = sectionsRef.current.find((s) => s.id === sectionId);
    if (!section?.title) return;
    setIsGeneratingAI(sectionId);
    try {
      const response = await fetch('/api/gerar-planejamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: section.title, procedimentos: budgetProcedures.map((p) => p.name), pacienteNome: patientName }),
      });
      if (!response.ok) throw new Error('Falha ao gerar');
      const data = await response.json() as { texto?: string };
      if (data.texto) updateSection(sectionId, 'content', data.texto);
    } catch (error) {
      console.error('[usePlanejamentoPaciente] generateSectionWithAI:', error);
    } finally {
      setIsGeneratingAI(null);
    }
  }, [budgetProcedures, patientName, updateSection]);

  const generateFullPlanWithAI = useCallback(async (): Promise<void> => {
    setIsGeneratingAI('__full__');
    try {
      const response = await fetch('/api/gerar-planejamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completo: true,
          procedimentos: [...budgetProcedures.map((p) => p.name), ...planProcs.map((p) => p.descricao)].filter((v, i, arr) => arr.indexOf(v) === i),
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
          id: `ai-gen-${Date.now()}-${i}`, title: s.title, content: s.content,
          imageIds: [], status: 'pendente' as const, dataEstimada: null,
        })));
        toast.success('Apresentação gerada com sucesso!');
      }
    } catch (error) {
      console.error('[usePlanejamentoPaciente] generateFullPlanWithAI:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar apresentação');
    } finally {
      setIsGeneratingAI(null);
    }
  }, [budgetProcedures, planProcs, patientName]);

  // ── Computados ──
  const concluidosCount = planProcs.filter((p) => p.status === 'concluido').length;
  const progressPercent = planProcs.length > 0 ? Math.round((concluidosCount / planProcs.length) * 100) : 0;
  const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);

  return {
    sections, setSections, documents, budgetProcedures, budgetExists, planProcs,
    loadingData, savingIds, isGeneratingAI, isImagePickerOpen, setIsImagePickerOpen,
    concluidosCount, progressPercent, totalBudget,
    updateSection, removeSection, addSection, generateSectionWithAI, generateFullPlanWithAI,
    toggleImageSelection, saveSectionToDb,
  };
}
