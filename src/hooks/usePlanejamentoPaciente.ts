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
  status: 'nao_iniciado' | 'em_andamento' | 'concluido';
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

function dedupProcs(procs: PlanProc[]): PlanProc[] {
  const seen = new Set<string>();
  return procs.filter((p) => {
    const key = p.fichaRef ?? p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Mock do Apresentar na demo (K · spec 3.4) — enlatado, sem IA ao vivo ──────
// Coerente com a ficha enlatada (João Silva, dente 46). Conteúdo dentista-conduzido.
const DEMO_MOCK_SECTIONS: PlanSection[] = [
  {
    id: 'demo-sec-1',
    title: 'O que encontramos',
    content:
      'A restauração antiga do dente 46 apresenta infiltração, o que explica a dor ao mastigar e a sensibilidade ao frio. ' +
      'É uma situação comum e totalmente reversível quando tratada agora — antes que a infiltração avance para o nervo.',
    imageIds: [], status: 'pendente', dataEstimada: null,
  },
  {
    id: 'demo-sec-2',
    title: 'Como vamos resolver',
    content:
      'Substituímos a restauração do dente 46 por uma resina nova, devolvendo o vedamento e eliminando a sensibilidade. ' +
      'Na mesma sessão, fazemos uma profilaxia completa para deixar a boca em dia. Tratamento rápido, em uma única visita.',
    imageIds: [], status: 'pendente', dataEstimada: null,
  },
  {
    id: 'demo-sec-3',
    title: 'Investimento',
    content:
      'Restauração de compósito (dente 46) e profilaxia. Valor total apresentado de forma clara, com opções de pagamento. ' +
      'Sem surpresas: você aprova antes de começar.',
    imageIds: [], status: 'pendente', dataEstimada: null,
  },
];

const DEMO_MOCK_BUDGET: PlanBudgetProcedure[] = [
  { id: 'demo-b1', name: 'Restauração de compósito (dente 46)', value: 350 },
  { id: 'demo-b2', name: 'Profilaxia', value: 150 },
];

// Procedimentos do plano — alimenta o contador da capa ("2 procedimentos") na apresentação demo.
const DEMO_MOCK_PROCS: PlanProc[] = [
  { id: 'demo-p1', descricao: 'Restauração de compósito (dente 46)', dente: 46, status: 'nao_iniciado', fichaRef: 'demo-ficha', ordem: 0 },
  { id: 'demo-p2', descricao: 'Profilaxia', dente: null, status: 'nao_iniciado', fichaRef: 'demo-ficha', ordem: 1 },
];

/**
 * Motor de planejamento por paciente (seções + procedimentos + orçamento + documentos).
 * Extraído do antigo PlanejamentoTab — agora nível paciente (modelo 1 ficha = 1 tratamento):
 * os procedimentos derivam de TODAS as fichas do paciente, sem filtro de tratamento.
 *
 * `dentistaId` é o AUTOR das seções criadas aqui: a seção é lida por toda a clínica,
 * mas só o autor edita (migration 099 / spec 2026-07-16, invariante #1). Os procedimentos
 * não precisam de autor próprio — derivam da ficha, e a autoria deles é `fichas.dentista_id`.
 */
export function usePlanejamentoPaciente(patientId: string, clinicaId: string, patientName: string, dentistaId: string, enabled = true, fichaId?: string) {
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
      // Escopa o orçamento à ficha apresentada (quando houver) — senão a apresentação
      // herdaria o orçamento mais recente de OUTRO tratamento do paciente.
      let budgetQuery = supabase.from('orcamentos').select('*, orcamento_itens(*)').eq('paciente_id', patientId);
      if (fichaId) budgetQuery = budgetQuery.eq('ficha_id', fichaId);
      const [docsResult, budgetResult, secoesResult] = await Promise.all([
        supabase.from('paciente_documentos').select('*').eq('paciente_id', patientId).in('categoria', ['Radiografias', 'Fotografias']),
        budgetQuery.order('created_at', { ascending: false }).limit(1).maybeSingle(),
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
  }, [patientId, fichaId]);

  // ── Fetch: procedimentos derivados de TODAS as fichas do paciente ──
  // #16 D4: fonte única — deriva direto de fichas.dentes_observacoes + procedimentos_status,
  // sem tabela intermediária (planejamento_procedimentos deixou de ser escrita).
  const fetchPlanProcs = useCallback(async () => {
    const supabase = createClient();
    type FichaRow = {
      id: string;
      dentes_observacoes: Record<string, string> | null;
      procedimentos_status: Record<string, PlanProc['status']> | null;
    };
    const { data } = await supabase
      .from('fichas')
      .select('id, dentes_observacoes, procedimentos_status')
      .eq('paciente_id', patientId)
      .not('dentes_observacoes', 'is', null);

    const fichas = ((data ?? []) as FichaRow[]).filter(
      (f) => f.dentes_observacoes && Object.keys(f.dentes_observacoes).length > 0
    );

    const rawProcs: PlanProc[] = [];
    let ordem = 0;
    for (const ficha of fichas) {
      const obs = ficha.dentes_observacoes ?? {};
      const statusMap = ficha.procedimentos_status ?? {};
      for (const [dente, desc] of Object.entries(obs)) {
        if (typeof desc === 'string' && desc.trim()) {
          desc.split('\n').filter(Boolean).forEach((line, idx) => {
            const key = `${dente}_${idx}`;
            rawProcs.push({
              id: `${ficha.id}::${key}`,
              descricao: line.trim(),
              dente: parseInt(dente, 10),
              status: statusMap[key] ?? 'nao_iniciado',
              fichaRef: `${ficha.id}::${key}`,
              ordem: ordem++,
            });
          });
        }
      }
    }

    const all = dedupProcs(rawProcs);
    setPlanProcs(fichaId ? all.filter((p) => p.fichaRef?.startsWith(fichaId)) : all);
  }, [patientId, fichaId]);

  useEffect(() => {
    if (!patientId || !enabled) return;
    // Perfil demo: conteúdo enlatado, sem tocar no banco nem na IA (K · spec 3.4).
    if (patientId === 'demo') {
      setSections(DEMO_MOCK_SECTIONS);
      setBudgetProcedures(DEMO_MOCK_BUDGET);
      setBudgetExists(true);
      setPlanProcs(DEMO_MOCK_PROCS);
      setDocuments([]);
      setLoadingData(false);
      return;
    }
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
        // .select() confirma que a linha foi mesmo afetada: UPDATE barrado por RLS
        // (seção de outro dentista) volta 0 linhas SEM erro — invariante #9.
        const { data: updated } = await supabase.from('planejamento_secoes').upsert({
          id: section.id, clinica_id: clinicaId, paciente_id: patientId, dentista_id: dentistaId,
          titulo: section.title, conteudo: section.content, imagem_ids: section.imageIds,
          ordem: idx, status: section.status, data_estimada: section.dataEstimada || null,
          updated_at: new Date().toISOString(),
        }).select('id');
        if (!updated?.length) {
          console.error('[usePlanejamentoPaciente] saveSectionToDb: RLS recusou (seção de outro dentista?)');
          await fetchGlobalData();
        }
      } else {
        const { data } = await supabase.from('planejamento_secoes').insert({
          clinica_id: clinicaId, paciente_id: patientId, dentista_id: dentistaId,
          titulo: section.title, conteudo: section.content,
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
  }, [clinicaId, patientId, dentistaId, fetchGlobalData]);

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
      clinica_id: clinicaId, paciente_id: patientId, dentista_id: dentistaId, titulo: '', conteudo: '',
      imagem_ids: [], ordem: newOrder, status: 'pendente', data_estimada: null,
    }).select('id').single();
    if (error ?? !data) { console.error('[usePlanejamentoPaciente] addSection:', error); return; }
    setSections((prev) => [...prev, {
      id: (data as Record<string, unknown>).id as string,
      title: '', content: '', imageIds: [], status: 'pendente', dataEstimada: null,
    }]);
  }, [clinicaId, patientId, dentistaId]);

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
