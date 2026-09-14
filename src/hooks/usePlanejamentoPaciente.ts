'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { toStoragePath } from '@/lib/storage/url';
import type { OdontogramaEventoDraft, AncoraClinica } from '@/types/odontograma';

// ─── Tipos (espelhados do ApresentarPanel) ──────────────────────────────────

export interface PlanDocument {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  url: string;
}

// R-98a — layout do bloco na apresentação. 'texto' é o único que já existia.
export type SectionTipo = 'texto' | 'imagem' | 'odontograma';

// R-99 — os 5 tipos com marcador visual sobre a imagem. Mapeiam 1:1 pra
// TipoRegistroOdontograma (endodontia/coroa/implante/pino_nucleo/exodontia) — símbolo
// portado de Odontograma.tsx, ver AnotacaoIcone em ApresentarPanel.tsx.
export type TipoAnotacaoRadiografia = 'endodontia' | 'coroa' | 'implante' | 'pino_nucleo' | 'exodontia';

/** Formas de desenho livre (D13, 10/08) — além dos ícones tipados. */
export type FormaDesenho = 'linha' | 'circulo' | 'seta';

/** Overlay puro (R-99, invariante I1): nunca regrava a imagem, só geometria + tipo.
 *  Union por `forma`: ícone tipado (tamanho ajustável D12, posição e rotação livres
 *  D15) · forma geométrica (2 pontos) · traço livre (sequência de pontos). Todas as
 *  coordenadas são 0–100, percentual da imagem renderizada — independente de
 *  zoom/resolução. */
export type AnotacaoOverlay =
  | { id: string; forma: 'icone'; tipo: TipoAnotacaoRadiografia; x: number; y: number; tamanho: number; rotacao: number }
  | { id: string; forma: FormaDesenho; x1: number; y1: number; x2: number; y2: number }
  | { id: string; forma: 'traco'; pontos: { x: number; y: number }[] };

export interface PlanSection {
  id: string;
  tipo: SectionTipo;
  title: string;
  content: string;      // texto: corpo · imagem: legenda opcional · odontograma: nota opcional
  imageIds: string[];   // texto: 0..N (como sempre) · imagem: 0..1 · odontograma: sempre []
  anotacoes: AnotacaoOverlay[]; // R-99 — só usado em tipo='imagem'; demais tipos ficam []
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

// R-99 (I3) — mesmo padrão de `detalhe` em odontograma_eventos (types/odontograma.ts):
// dado corrompido ou fora do schema degrada pra lista vazia, nunca quebra o editor.
const pct = z.number().min(0).max(100);
const anotacaoOverlaySchema = z.discriminatedUnion('forma', [
  z.object({
    id: z.string(), forma: z.literal('icone'),
    tipo: z.enum(['endodontia', 'coroa', 'implante', 'pino_nucleo', 'exodontia']),
    x: pct, y: pct, tamanho: z.number().min(0.4).max(3),
    // .default(0): ícones salvos antes do D15 (rotação) não têm este campo — compat
    // retroativa sem migration, mesma disciplina da I3 (nunca perde dado por schema novo).
    rotacao: z.number().default(0),
  }),
  z.object({
    id: z.string(), forma: z.enum(['linha', 'circulo', 'seta']),
    x1: pct, y1: pct, x2: pct, y2: pct,
  }),
  z.object({
    id: z.string(), forma: z.literal('traco'),
    pontos: z.array(z.object({ x: pct, y: pct })).min(2),
  }),
]);
const anotacoesArraySchema = z.array(anotacaoOverlaySchema);

function parseAnotacoes(raw: unknown): AnotacaoOverlay[] {
  const parsed = anotacoesArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
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

// ─── Mock do Apresentar na demo (K · spec 3.4) — enlatado, sem IA ao vivo ──────
// Coerente com a ficha enlatada (João Silva, dente 46). Conteúdo dentista-conduzido.
const DEMO_MOCK_SECTIONS: PlanSection[] = [
  {
    id: 'demo-sec-1',
    tipo: 'texto',
    title: 'O que encontramos',
    content:
      'A restauração antiga do dente 46 apresenta infiltração, o que explica a dor ao mastigar e a sensibilidade ao frio. ' +
      'É uma situação comum e totalmente reversível quando tratada agora — antes que a infiltração avance para o nervo.',
    imageIds: [], anotacoes: [], status: 'pendente', dataEstimada: null,
  },
  {
    id: 'demo-sec-2',
    tipo: 'texto',
    title: 'Como vamos resolver',
    content:
      'Substituímos a restauração do dente 46 por uma resina nova, devolvendo o vedamento e eliminando a sensibilidade. ' +
      'Na mesma sessão, fazemos uma profilaxia completa para deixar a boca em dia. Tratamento rápido, em uma única visita.',
    imageIds: [], anotacoes: [], status: 'pendente', dataEstimada: null,
  },
  {
    id: 'demo-sec-3',
    tipo: 'texto',
    title: 'Investimento',
    content:
      'Restauração de compósito (dente 46) e profilaxia. Valor total apresentado de forma clara, com opções de pagamento. ' +
      'Sem surpresas: você aprova antes de começar.',
    imageIds: [], anotacoes: [], status: 'pendente', dataEstimada: null,
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
  // R-98a — bloco odontograma: deriva sozinho, sem escolha manual de dente (invariante §7).
  const [odontogramaEventos, setOdontogramaEventos] = useState<OdontogramaEventoDraft[]>([]);
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
      let budgetQuery = supabase.from('orcamentos').select('*, orcamento_itens(*)')
        .eq('paciente_id', patientId).eq('clinica_id', clinicaId)
        .is('orcamento_itens.retirado_em', null);
      if (fichaId) budgetQuery = budgetQuery.eq('ficha_id', fichaId);
      // R-98a — bloco odontograma: mesmo filtro condicional do orçamento, escopado à ficha
      // apresentada quando houver (senão herdaria evento de OUTRO atendimento do paciente).
      let eventosQuery = supabase
        .from('odontograma_eventos')
        .select('id,tipo,procedimento_nome,procedimento_id,status,origem,momento_planejado,nivel,arcada,quadrante,dente,faces,grupo_id,papel_no_grupo,observacao,realizado_em,registrado_em,created_at')
        .eq('paciente_id', patientId)
        .eq('clinica_id', clinicaId)
    .is('retirado_em', null);
      if (fichaId) eventosQuery = eventosQuery.eq('ficha_id', fichaId);
      const [docsResult, budgetResult, secoesResult, eventosResult] = await Promise.all([
        supabase.from('paciente_documentos').select('*').eq('paciente_id', patientId).in('categoria', ['Radiografias', 'Fotografias']),
        budgetQuery.order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('planejamento_secoes').select('*').eq('paciente_id', patientId).order('ordem', { ascending: true }),
        eventosQuery,
      ]);
      if (docsResult.error) throw docsResult.error;
      // `paciente_documentos.url` guarda o PATH do storage (bucket privado), não uma URL
      // navegável — mesmo padrão de DocumentosTab.tsx: resolve em lote pra URL assinada
      // (1h). Sem isso, <Image src> quebra com "Failed to construct URL".
      const docRows = (docsResult.data ?? []) as Array<Record<string, unknown>>;
      const docPaths = docRows.map((doc) => toStoragePath(doc.url as string, 'fichas'));
      const { data: signedList } = docPaths.length > 0
        ? await supabase.storage.from('fichas').createSignedUrls(docPaths, 3600)
        : { data: [] };
      const signedMap = new Map<string, string>();
      (signedList ?? []).forEach((entry) => { if (entry.path && entry.signedUrl) signedMap.set(entry.path, entry.signedUrl); });
      setDocuments(docRows.map((doc) => {
        const signedUrl = signedMap.get(toStoragePath(doc.url as string, 'fichas')) ?? (doc.url as string);
        return {
          id: doc.id as string, name: doc.nome as string, category: doc.categoria as string,
          url: signedUrl, thumbnail: signedUrl,
        };
      }));
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
          id: row.id as string, tipo: ((row.tipo as string) ?? 'texto') as SectionTipo,
          title: row.titulo as string, content: (row.conteudo as string) ?? '',
          imageIds: (row.imagem_ids as string[]) ?? [], anotacoes: parseAnotacoes(row.anotacoes),
          status: ((row.status as string) ?? 'pendente') as PlanSection['status'],
          dataEstimada: (row.data_estimada as string | null) ?? null,
        })));
      }
      if (eventosResult.error) throw eventosResult.error;
      // Reconstrói a âncora a partir das colunas achatadas — mesmo padrão de
      // get-meu-dia.ts:eventoParaBoca / FichasTab.tsx:842 / historico-bloco.tsx:46.
      setOdontogramaEventos((eventosResult.data as Array<Record<string, unknown>>).map((e) => {
        const ancora: AncoraClinica = { nivel: e.nivel as AncoraClinica['nivel'] };
        if (e.dente != null) ancora.dente = e.dente as number;
        if (e.arcada != null) ancora.arcada = e.arcada as AncoraClinica['arcada'];
        if (e.quadrante != null) ancora.quadrante = e.quadrante as AncoraClinica['quadrante'];
        if ((e.faces as string[] | null)?.length) ancora.faces = e.faces as AncoraClinica['faces'];
        return {
          id: e.id as string, procedimentoNome: (e.procedimento_nome as string | null) ?? null,
          procedimentoId: (e.procedimento_id as string | null) ?? null, tipo: e.tipo as OdontogramaEventoDraft['tipo'],
          status: e.status as OdontogramaEventoDraft['status'], origem: e.origem as OdontogramaEventoDraft['origem'],
          momento_planejado: (e.momento_planejado as OdontogramaEventoDraft['momento_planejado']) ?? 'sessao_atual',
          ancora, grupo_id: (e.grupo_id as string | null) ?? null,
          papel_no_grupo: (e.papel_no_grupo as OdontogramaEventoDraft['papel_no_grupo']) ?? null,
          observacao: (e.observacao as string | null) ?? '', realizado_em: (e.realizado_em as string | null) ?? null,
          registrado_em: (e.registrado_em as string | null) ?? undefined,
          created_at: (e.created_at as string | null) ?? undefined,
        };
      }));
    } catch (error) {
      console.error('[usePlanejamentoPaciente] fetchGlobalData:', error);
    } finally {
      setLoadingData(false);
    }
  }, [patientId, clinicaId, fichaId]);

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
          tipo: section.tipo, titulo: section.title, conteudo: section.content, imagem_ids: section.imageIds,
          anotacoes: section.anotacoes,
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
          tipo: section.tipo, titulo: section.title, conteudo: section.content,
          imagem_ids: section.imageIds, anotacoes: section.anotacoes,
          ordem: idx, status: section.status, data_estimada: section.dataEstimada || null,
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

  const updateSection = useCallback((id: string, field: keyof PlanSection, value: string | string[] | AnotacaoOverlay[]) => {
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

  const addSection = useCallback(async (tipo: SectionTipo = 'texto'): Promise<void> => {
    const supabase = createClient();
    const newOrder = sectionsRef.current.length;
    const { data, error } = await supabase.from('planejamento_secoes').insert({
      clinica_id: clinicaId, paciente_id: patientId, dentista_id: dentistaId, tipo, titulo: '', conteudo: '',
      imagem_ids: [], anotacoes: [], ordem: newOrder, status: 'pendente', data_estimada: null,
    }).select('id').single();
    if (error ?? !data) { console.error('[usePlanejamentoPaciente] addSection:', error); return; }
    setSections((prev) => [...prev, {
      id: (data as Record<string, unknown>).id as string, tipo,
      title: '', content: '', imageIds: [], anotacoes: [], status: 'pendente', dataEstimada: null,
    }]);
  }, [clinicaId, patientId, dentistaId]);

  // Confirmação de exclusão é responsabilidade do CALLER (AlertDialog, R-98a) — o hook só executa.
  const removeSection = useCallback(async (id: string): Promise<void> => {
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
        const supabase = createClient();
        // R-98a — fix do bug de persistência: antes disto, a função criava ids fantasma
        // (ai-gen-<ts>) e nunca gravava. Regenerar substitui só o que EU escrevi — RLS já
        // trava o resto de qualquer outro autor (confirmação de sobrescrever já rodou no
        // caller antes de chegar aqui, ver ApresentarPanel).
        await supabase.from('planejamento_secoes')
          .delete().eq('paciente_id', patientId).eq('dentista_id', dentistaId);
        const { error } = await supabase.from('planejamento_secoes').insert(
          data.secoes.map((s, i) => ({
            clinica_id: clinicaId, paciente_id: patientId, dentista_id: dentistaId,
            tipo: 'texto' as const, titulo: s.title, conteudo: s.content,
            imagem_ids: [], ordem: i, status: 'pendente' as const, data_estimada: null,
          })),
        );
        if (error) throw error;
        await fetchGlobalData(); // ids e ordem reais do banco — nunca mais estado local fantasma
        toast.success('Apresentação gerada com sucesso!');
      }
    } catch (error) {
      console.error('[usePlanejamentoPaciente] generateFullPlanWithAI:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar apresentação');
    } finally {
      setIsGeneratingAI(null);
    }
  }, [budgetProcedures, planProcs, patientName, patientId, dentistaId, clinicaId, fetchGlobalData]);

  // ── Computados ──
  const concluidosCount = planProcs.filter((p) => p.status === 'concluido').length;
  const progressPercent = planProcs.length > 0 ? Math.round((concluidosCount / planProcs.length) * 100) : 0;
  const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);

  return {
    sections, setSections, documents, budgetProcedures, budgetExists, planProcs,
    odontogramaEventos,
    loadingData, savingIds, isGeneratingAI, isImagePickerOpen, setIsImagePickerOpen,
    concluidosCount, progressPercent, totalBudget,
    updateSection, removeSection, addSection, generateSectionWithAI, generateFullPlanWithAI,
    toggleImageSelection, saveSectionToDb,
  };
}
