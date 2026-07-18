"use client";

import * as React from "react";
import {
  Plus,
  X,
  Mic,
  MicOff,
  Trash2,
  FileText,
  Download,
  Check,
  User,
  Loader2,
  Lock,
  PenLine,
  Pencil,
  Signature,
  CircleDollarSign,
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
import { temFeature, type PlanoId } from "@/lib/planos";
import { Odontograma, type ToothStatus } from "@/components/odontograma/Odontograma";
import {
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA, ARCH_LABELS,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
} from "@/lib/arcadas";
import dynamic from 'next/dynamic';
import type SignaturePadLib from 'signature_pad';
import { ApresentarPaciente } from '@/components/pacientes/ApresentarPaciente';
const SignaturePad = dynamic(
  () => import('@/components/fichas/SignaturePad').then(m => m.SignaturePad),
  { ssr: false }
);

interface ToothNote {
  tooth: number;
  notes: string[];
}

type SelectionMode = 'single' | 'multiple' | 'arch';


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

// #16 D7 — agrega o status dos procedimentos de cada dente pro odontograma-mapa.
// Sentinelas de arcada/quadrante (>=90) entram no mapa também (mesma agregação),
// mas o Odontograma não pinta dente a dente com elas — usa só pro "destaque de
// região" nos rótulos de quadrante (D6).
function computeToothStatusMap(evo: Evolution): Partial<Record<number, ToothStatus>> {
  const map: Partial<Record<number, ToothStatus>> = {};
  evo.teethNotes.forEach((tn) => {
    const keys = tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`);
    if (keys.length === 0) return;
    const statuses = keys.map((k) => evo.procedimentosStatus[k] ?? 'nao_iniciado');
    if (statuses.every((s) => s === 'concluido')) map[tn.tooth] = 'concluido';
    else if (statuses.some((s) => s === 'concluido' || s === 'em_andamento')) map[tn.tooth] = 'em_andamento';
    else map[tn.tooth] = 'nao_iniciado';
  });
  return map;
}

interface Evolution {
  id: string;
  date: string;
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
  /** Autor da ficha. A ficha é lida por toda a clínica; só o autor escreve (migration 099). */
  dentistaId: string;
}

type FichaDB = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  status: string;
  dentista_id: string;
  dentista?: { nome: string } | null;
  procedimentos_concluidos: string[];
  procedimentos_status: Record<string, ProcStatus> | null;
  procedimentos: string[] | null;
  conduta: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  tratamento_id: string | null;
};

const mapFichaToEvolution = (f: FichaDB): Evolution => ({
  id: f.id,
  date: new Date(f.created_at)
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " às"),
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
});

// Ficha enlatada do perfil demo (K · spec 3.3) — coerente com o seed da consulta demo (João Silva, dente 46).
// `dentistaId` fica de fora: é injetado no uso com o dentista real logado, pra a demo continuar
// editável (professional: 'Você'). Sem isso ela cairia no caminho de "ficha de outro dentista".
const DEMO_EVOLUTION: Omit<Evolution, 'dentistaId'> = {
  id: 'demo-ficha',
  date: new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', ' às'),
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

export function FichasTab({ patientId, clinicaId, dentistaId, plano, patientName, canWrite = true, onGerarOrcamento }: FichasTabProps) {
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
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [selectedTeeth, setSelectedTeeth] = React.useState<number[]>([]);
  const [sharedTeeth, setSharedTeeth] = React.useState<number[]>([]);
  const [selectionMode, setSelectionMode] = React.useState<SelectionMode>('single');
  const [sharedNotes, setSharedNotes] = React.useState<string[]>(['']);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [signingFichaId, setSigningFichaId] = React.useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadLib | null>(null);

  // ── Modo de visualização da ficha ─────────────────────────────────────────
  const [viewingEvo, setViewingEvo] = React.useState<Evolution | null>(null);
  const [filterTooth, setFilterTooth] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    type: "Evolução",
    observation: "",
    teethNotes: [] as ToothNote[],
  } as { type: string; observation: string; teethNotes: ToothNote[] });

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
        .select("id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, procedimentos_status, procedimentos, conduta, assinatura_url, assinado_em, tratamento_id, dentista_id, dentista:dentistas(nome)")
        .eq("paciente_id", patientId)
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvolutions((data as unknown as FichaDB[]).map(mapFichaToEvolution));
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

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      toast.error('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      // Trava o botão já aqui — entre parar e o onstop assíncrono disparar
      // a transcrição, havia uma janela em que o botão voltava a ficar
      // clicável e dava pra iniciar uma segunda gravação sem perceber,
      // duplicando o trecho transcrito.
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob): Promise<void> => {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "gravacao.webm");
      const response = await fetch("/api/transcrever", { method: "POST", body: fd });
      if (!response.ok) throw new Error("Falha na transcrição");
      const data = await response.json() as { transcricao?: string };
      if (data.transcricao) {
        setFormData((f) => ({
          ...f,
          observation: f.observation ? `${f.observation}\n${data.transcricao}` : (data.transcricao ?? ""),
        }));
      }
    } catch (error) {
      console.error("Erro na transcrição:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleTooth = (tooth: number) => {
    if (selectionMode === 'multiple') {
      // Modo múltiplos: adiciona/remove do grupo compartilhado
      setSharedTeeth((prev) =>
        prev.includes(tooth) ? prev.filter((t) => t !== tooth) : [...prev, tooth]
      );
      return;
    }
    // Modo individual e arcada: cada dente tem seus próprios procedimentos
    setSelectedTeeth((prev) => {
      const isSelected = prev.includes(tooth);
      if (isSelected) {
        setFormData((f) => ({ ...f, teethNotes: f.teethNotes.filter((tn) => tn.tooth !== tooth) }));
        return prev.filter((t) => t !== tooth);
      } else {
        setFormData((f) => ({ ...f, teethNotes: [...f.teethNotes, { tooth, notes: [''] }] }));
        return [...prev, tooth];
      }
    });
  };

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

  const handleModeChange = (mode: SelectionMode) => {
    setSelectionMode(mode);
    // Não limpa seleções ao trocar de modo — permite transicionar mantendo o que já foi selecionado
  };

  const handleSharedNoteChange = (index: number, value: string) => {
    setSharedNotes((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const addSharedNote = () => setSharedNotes((prev) => [...prev, '']);

  const removeSharedNote = (index: number) => {
    setSharedNotes((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']);
  };

  const handleToothNoteChange = (tooth: number, index: number, value: string) => {
    setFormData((f) => ({
      ...f,
      teethNotes: f.teethNotes.map((tn) =>
        tn.tooth === tooth
          ? { ...tn, notes: tn.notes.map((n, i) => (i === index ? value : n)) }
          : tn
      ),
    }));
  };

  const addToothNote = (tooth: number) => {
    setFormData((f) => ({
      ...f,
      teethNotes: f.teethNotes.map((tn) =>
        tn.tooth === tooth ? { ...tn, notes: [...tn.notes, ''] } : tn
      ),
    }));
  };

  const removeToothNote = (tooth: number, index: number) => {
    setFormData((f) => ({
      ...f,
      teethNotes: f.teethNotes.map((tn) =>
        tn.tooth === tooth
          ? { ...tn, notes: tn.notes.length > 1 ? tn.notes.filter((_, i) => i !== index) : [''] }
          : tn
      ),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const dentesAfetados = [...selectedTeeth, ...sharedTeeth];
      const validSharedNotes = sharedNotes.filter((n) => n.trim()).join('\n');

      const dentesObservacoes: Record<string, string> = {
        // Dentes individuais — cada um com seus próprios procedimentos
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

      if (editingId) {
        const { error } = await supabase
          .from("fichas")
          .update({
            queixa_principal: formData.type,
            anotacoes: formData.observation || null,
            dentes_afetados: dentesAfetados,
            dentes_observacoes: dentesObservacoes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId)
          .eq("clinica_id", clinicaId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("fichas").insert({
          paciente_id: patientId,
          dentista_id: dentistaId,
          clinica_id: clinicaId,
          queixa_principal: formData.type,
          anotacoes: formData.observation || null,
          dentes_afetados: dentesAfetados,
          dentes_observacoes: dentesObservacoes,
          status: "aberta",
        });

        if (error) throw error;
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
    setSharedTeeth([]);
    setSelectionMode('single');
    setSharedNotes(['']);
    setFormData({ type: "Evolução", observation: "", teethNotes: [] } as { type: string; observation: string; teethNotes: ToothNote[] });
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
    const individualNotes = evolution.teethNotes.filter((tn) => !sharedTeethSet.has(tn.tooth));
    const hasArch = individualNotes.some((tn) => tn.tooth in ARCH_LABELS);
    const startMode: SelectionMode =
      detectedSharedGroup && individualNotes.length === 0 ? 'multiple' :
      hasArch ? 'arch' : 'single';

    setSelectionMode(startMode);
    setSharedTeeth(detectedSharedGroup?.teeth ?? []);
    setSharedNotes(
      detectedSharedGroup ? detectedSharedGroup.notes.split('\n').filter(Boolean) : ['']
    );
    setEditingId(evolution.id);
    setFormData({
      type: evolution.type,
      observation: evolution.observation,
      teethNotes: individualNotes.map((tn) => ({
        tooth: tn.tooth,
        notes: tn.notes.length > 0 ? [...tn.notes] : [''],
      })),
    });
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
            <div className="bg-surface-alt/30 border border-border/60 rounded-2xl p-4 md:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Coluna Esquerda */}
              <div className="flex-[3] flex flex-col gap-6">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
                    Tipo de Registro
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  >
                    <option value="Avaliação">Avaliação</option>
                    <option value="Evolução">Evolução</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Urgência">Urgência</option>
                    <option value="Procedimento">Procedimento</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] flex items-center">
                      Observações Gerais
                      <HelpTooltip content="Fale os procedimentos e a IA transcreve automaticamente." />
                    </label>
                    {temFeature(plano, 'transcricaoVoz') ? (
                      <button
                        onClick={() => {
                          void (isRecording ? stopRecording() : startRecording());
                        }}
                        disabled={isTranscribing}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isRecording
                            ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                            : "bg-teal/10 text-teal hover:bg-teal/20"
                        }`}
                      >
                        {isTranscribing ? (
                          <>
                            <span className="w-3.5 h-3.5 inline-block border-2 border-teal border-t-transparent rounded-full animate-spin" />{" "}
                            Transcrevendo...
                          </>
                        ) : isRecording ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" /> Parar Gravação
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" /> Gravar Voz (IA)
                          </>
                        )}
                      </button>
                    ) : (
                      <span
                        title="Disponível no Plano Básico"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-alt text-text-secondary cursor-not-allowed select-none"
                      >
                        <Lock className="w-3.5 h-3.5" /> Gravar Voz (IA)
                      </span>
                    )}
                  </div>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Descreva os procedimentos realizados, queixas do paciente, etc..."
                    className="w-full bg-surface-alt border border-border rounded-xl px-4 py-3 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[120px] resize-y"
                  />
                </div>

                {/* Seção de procedimentos — sempre visível, sem layout shift */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                    Procedimentos
                  </label>

                  {selectedTeeth.length === 0 && sharedTeeth.length === 0 ? (
                    <div className="min-h-[88px] flex items-center justify-center text-xs text-text-secondary bg-surface-alt rounded-xl border border-dashed border-border/60">
                      {selectionMode === 'arch'
                        ? 'Selecione uma arcada ao lado'
                        : 'Selecione dentes no odontograma ao lado'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Dentes individuais (modo single / arcada) */}
                      {selectedTeeth.length > 0 && (
                        <div className="space-y-3">
                          {sharedTeeth.length > 0 && (
                            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Individuais</span>
                          )}
                          {selectedTeeth.map((tooth) => {
                            const tn = formData.teethNotes.find((t) => t.tooth === tooth);
                            const notes = tn?.notes ?? [''];
                            return (
                              <motion.div
                                key={tooth}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-3"
                              >
                                {tooth in ARCH_LABELS ? (
                                  <div className="shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-xs font-bold shadow-sm mt-0.5 px-2 py-2 whitespace-nowrap">
                                    {ARCH_LABELS[tooth]}
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-sm font-bold shadow-sm mt-0.5">
                                    {tooth}
                                  </div>
                                )}
                                <div className="flex-1 space-y-2">
                                  {notes.map((note, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={note}
                                        onChange={(e) => handleToothNoteChange(tooth, idx, e.target.value)}
                                        placeholder={`Procedimento ${idx + 1}...`}
                                        className="flex-1 bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                                      />
                                      {notes.length > 1 && (
                                        <button type="button" onClick={() => removeToothNote(tooth, idx)} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors rounded-lg hover:bg-surface-alt">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => addToothNote(tooth)} className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-lt transition-colors px-1">
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar procedimento
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Grupo de dentes (modo múltiplos) */}
                      {(sharedTeeth.length > 0 || selectionMode === 'multiple') && (
                        <div className="space-y-3">
                          {selectedTeeth.length > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border/60" />
                              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest shrink-0">Grupo</span>
                              <div className="flex-1 h-px bg-border/60" />
                            </div>
                          )}
                          {sharedTeeth.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sharedTeeth.map((tooth) => (
                                <div key={tooth} className="flex items-center gap-1 bg-teal/15 border border-teal/40 text-teal px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
                                  D{tooth}
                                  <button type="button" onClick={() => toggleTooth(tooth)} className="ml-0.5 hover:opacity-60 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {sharedTeeth.length === 0 ? (
                            <div className="min-h-[60px] flex items-center justify-center text-xs text-text-secondary bg-surface-alt rounded-xl border border-dashed border-border/60">
                              Selecione os dentes no odontograma
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sharedNotes.map((note, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => handleSharedNoteChange(idx, e.target.value)}
                                    placeholder={`Procedimento ${idx + 1} para todos os dentes...`}
                                    className="flex-1 bg-surface-alt border border-teal/30 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                                  />
                                  {sharedNotes.length > 1 && (
                                    <button type="button" onClick={() => removeSharedNote(idx)} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors rounded-lg hover:bg-surface-alt">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={addSharedNote} className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-lt transition-colors px-1">
                                <Plus className="w-3.5 h-3.5" />
                                Adicionar procedimento
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {isSaving ? "Salvando..." : "Salvar Evolução"}
                  </button>
                </div>
              </div>

              {/* Odontograma */}
              <div
                className="flex-[2] p-6 flex flex-col border-t lg:border-t-0 lg:border-l min-h-[480px]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg text-text-primary flex items-center">
                    Odontograma
                    <HelpTooltip content="Escolha o tipo de seleção e marque os dentes ou arcadas afetados." />
                  </h3>
                  {selectionMode === 'arch' && (
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <div className="w-2.5 h-2.5 rounded-sm bg-teal" /> Selecionado
                    </div>
                  )}
                </div>

                {/* Seletor de modo */}
                <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--color-bg)' }}>
                  {([
                    { id: 'single', label: 'Dente único' },
                    { id: 'multiple', label: 'Múltiplos' },
                    { id: 'arch', label: 'Arcada / Geral' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => handleModeChange(id)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        selectionMode === id
                          ? 'bg-surface-alt shadow-sm text-text-primary'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {selectionMode !== 'arch' ? (
                    <motion.div
                      key="odontogram"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="flex-1 flex flex-col justify-center"
                    >
                      <Odontograma
                        selectedTeeth={selectedTeeth}
                        sharedTeeth={sharedTeeth}
                        historicalTeeth={editingId ? historicalTeeth : new Set<number>()}
                        onToothToggle={toggleTooth}
                        showCheckbox={selectionMode === 'multiple'}
                        hideFilters
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="arch"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="flex-1 flex flex-col justify-center gap-3"
                    >
                      <p className="text-xs text-text-secondary text-center mb-1">
                        Selecione a área afetada pelo procedimento
                      </p>
                      {[
                        { id: ARCH_SUPERIOR, label: 'Arcada Superior', sub: 'Dentes 11 a 28' },
                        { id: ARCH_INFERIOR, label: 'Arcada Inferior', sub: 'Dentes 31 a 48' },
                        { id: ARCH_COMPLETA, label: 'Boca Toda', sub: 'Todas as arcadas' },
                      ].map(({ id, label, sub }) => (
                        <button
                          key={id}
                          onClick={() => toggleArch(id)}
                          className={`w-full px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-between ${
                            selectedTeeth.includes(id)
                              ? 'bg-teal border-teal text-white'
                              : 'bg-surface-alt border-border text-text-primary hover:border-teal hover:text-teal'
                          }`}
                        >
                          <span>{label}</span>
                          <span className={`text-xs font-normal ${selectedTeeth.includes(id) ? 'text-white/70' : 'text-text-secondary'}`}>
                            {sub}
                          </span>
                        </button>
                      ))}

                      {/* Quadrante (#16 D5) — raspagem/alisamento por quadrante, seleção manual v1 */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex-1 h-px bg-border/60" />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest shrink-0">Ou por quadrante</span>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: QUAD_SUP_DIREITO, label: 'Sup. Direito' },
                          { id: QUAD_SUP_ESQUERDO, label: 'Sup. Esquerdo' },
                          { id: QUAD_INF_DIREITO, label: 'Inf. Direito' },
                          { id: QUAD_INF_ESQUERDO, label: 'Inf. Esquerdo' },
                        ].map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => toggleArch(id)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                              selectedTeeth.includes(id)
                                ? 'bg-teal border-teal text-white'
                                : 'bg-surface-alt border-border text-text-primary hover:border-teal hover:text-teal'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <p className="text-center text-xs text-text-secondary font-medium mt-1">
                        Procedimentos em toda a arcada, quadrante ou boca.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
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

      <div className="relative space-y-14 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border/40">
        {/* Lista cronológica plana — todas as fichas (modelo 1 ficha = 1 tratamento) */}
        {evolutions.length > 0 && (
          <div className="space-y-14">
            {evolutions.map((evo, idx) => {
              const isExpanded = viewingEvo?.id === evo.id;
              const validKeys = evo.teethNotes.flatMap((tn) =>
                tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`)
              );
              const totalProcs = validKeys.length;
              const doneProcs = validKeys.filter((k) => evo.procedimentosStatus[k] === 'concluido').length;
              const allDone = totalProcs > 0 && doneProcs === totalProcs;
              const pct = totalProcs > 0 ? Math.round((doneProcs / totalProcs) * 100) : 0;
              const filteredTeethNotes = isExpanded && filterTooth
                ? evo.teethNotes.filter((tn) => tn.tooth === filterTooth)
                : evo.teethNotes;

              return (
              <motion.div
                key={evo.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="relative pl-10 sm:pl-12 group"
              >
                <div className={`absolute left-0 top-1 w-10 h-10 rounded-full bg-surface border-2 flex items-center justify-center z-10 shadow-sm transition-all ${allDone ? 'border-emerald-500' : 'border-teal'} ${isExpanded ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {allDone
                    ? <Check className="w-4 h-4 text-emerald-500" />
                    : <div className="w-2 h-2 rounded-full bg-teal" />
                  }
                </div>

                <div
                  className={`bg-surface rounded-2xl border transition-all duration-200 ${isExpanded ? 'border-teal/50 shadow-lg' : 'border-border/60 shadow-sm'}`}
                  style={allDone && !isExpanded ? { boxShadow: '-3px 0 0 0 #10b981, 0 1px 3px rgba(0,0,0,0.06)' } : undefined}
                >
                  {/* Header — sempre visível, clicável para expandir */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setFilterTooth(null); setViewingEvo(isExpanded ? null : evo); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilterTooth(null); setViewingEvo(isExpanded ? null : evo); } }}
                    className="p-6 cursor-pointer hover:bg-surface-alt/30 rounded-t-2xl transition-colors"
                  >
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="bg-teal/10 text-teal px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest">
                            {evo.type}
                          </span>
                          <h4 className="text-sm font-bold text-text-primary">{evo.date}</h4>
                          {totalProcs > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${allDone ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                              {allDone ? '✓ Concluído' : `${doneProcs}/${totalProcs} realizados`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text-secondary font-medium">
                          <User className="w-3 h-3" /> {evo.professional}
                          {/* Só marca o que foge do esperado: a ficha do colega. A própria fica
                              discreta como sempre foi, e numa clínica de um dentista o badge
                              nunca aparece. Ausência dos botões de editar não é sinal rápido
                              o bastante — o gate é distinguir sem clicar (spec §9). */}
                          {canWrite && evo.dentistaId !== dentistaId && (
                            <span className="px-1.5 py-0.5 rounded border border-border bg-surface-alt text-[9px] font-bold uppercase tracking-wide">
                              Somente leitura
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Ação principal por estado (#5 + #6) — máx. 2 botões grandes */}
                        {evo.assinadoEm ? (
                          <>
                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold">
                              <Check className="w-3 h-3" />
                              Assinado em {new Date(evo.assinadoEm).toLocaleDateString('pt-BR')}
                            </span>
                            {onGerarOrcamento && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onGerarOrcamento(evo.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-[10px] font-bold bg-teal text-white hover:bg-teal-lt transition-colors shadow-sm"
                              >
                                <CircleDollarSign className="w-3.5 h-3.5" />
                                Gerar orçamento
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {onGerarOrcamento && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onGerarOrcamento(evo.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-[10px] font-bold bg-teal text-white hover:bg-teal-lt transition-colors shadow-sm"
                              >
                                <CircleDollarSign className="w-3.5 h-3.5" />
                                Gerar orçamento
                              </button>
                            )}
                            {/* Assinar escreve na ficha (assinatura_url) — é ESCRITA clínica, só o
                                autor (migration 099). Antes aparecia pra qualquer um: o não-autor (outro
                                dentista ou secretária) assinava, o PNG subia pro storage (bucket por
                                clínica), mas o UPDATE era barrado pela RLS em silêncio → "Assinatura
                                salva" falso + PNG órfão. Gate igual ao editar/excluir. */}
                            {podeEditarFicha(evo) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSigningFichaId(evo.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-[10px] font-bold border border-border text-text-secondary hover:border-teal hover:text-teal transition-colors"
                              >
                                <Signature className="w-3.5 h-3.5" />
                                Assinar
                              </button>
                            )}
                          </>
                        )}

                        {/* Divisor */}
                        <div className="w-px h-6 bg-border/60 mx-0.5" />

                        {/* Ações secundárias — ícones (#5). Editar/Excluir só na ficha própria:
                            a de outro dentista é leitura (migration 099). Baixar o PDF continua
                            liberado — ler é o ponto de abrir o histórico pra clínica. */}
                        {podeEditarFicha(evo) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(evo); }}
                            title="Editar"
                            className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-teal"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`/api/fichas/${evo.id}/pdf`, '_blank'); }}
                          title="Baixar"
                          className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Excluir é escrita clínica — a RLS já barra a secretária e o não-autor;
                            escondemos o botão pra não dar a falsa impressão de que apagou (update otimista). */}
                        {podeEditarFicha(evo) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(evo.id); }}
                            title="Excluir"
                            className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        <div className={`p-1 text-text-secondary/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronRight className="w-4 h-4 -rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview — visível quando recolhido */}
                  {!isExpanded && (
                    <div className="px-6 pb-6">
                      {evo.procedimentos.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60 mb-2">Procedimentos realizados</p>
                          <div className="flex flex-wrap gap-1.5">
                            {evo.procedimentos.map((proc, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium border"
                                style={{
                                  background: 'color-mix(in srgb, var(--color-teal) 8%, transparent)',
                                  color: 'var(--color-teal)',
                                  borderColor: 'color-mix(in srgb, var(--color-teal) 18%, var(--color-border))',
                                }}
                              >
                                {proc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {evo.conduta && (
                        <div className="mb-4 rounded-xl border border-border/50 px-3 py-2.5 bg-surface-alt/60">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/60 mb-1">Conduta</p>
                          <p className="text-xs text-text-secondary leading-relaxed">{evo.conduta}</p>
                        </div>
                      )}

                      {evo.observation && (
                        <p className="text-sm text-text-secondary leading-relaxed mb-4">{evo.observation}</p>
                      )}

                      {evo.teethNotes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {evo.teethNotes.map((tn) => (
                            <span
                              key={tn.tooth}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-teal bg-surface-alt border border-border/40"
                            >
                              {tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : `D${tn.tooth}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {evo.files.length > 0 && (
                        <div className="flex gap-2">
                          {evo.files.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-alt rounded-xl border border-border/40 text-[10px] font-bold text-text-primary">
                              <FileText className="w-3 h-3 text-teal" /> {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expansão inline — tratamento completo */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/40 px-6 pb-6 pt-5 space-y-6">

                          {/* Observações — sempre visível, full-width */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/70 mb-2">Observações gerais</p>
                            <div className="bg-surface-alt rounded-xl border border-border/40 px-4 py-3 flex flex-wrap items-start gap-x-6 gap-y-2">
                              <p className="text-sm leading-relaxed flex-1 min-w-[200px] text-text-secondary">
                                {evo.observation || <span className="italic text-text-secondary/40">Sem observações registradas.</span>}
                              </p>
                              {evo.conduta && (
                                <div className="flex items-center gap-1.5 text-sm text-text-secondary flex-shrink-0">
                                  <FileText className="w-3.5 h-3.5 text-teal flex-shrink-0" />
                                  <span><span className="font-bold text-text-primary">Conduta:</span> {evo.conduta}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* #16 D12 (revisado) — 2 colunas no modo leitura: odontograma 60% esq / progresso+procedimentos 40% dir.
                              Invertido do plano original (40/60): cada dente tem largura fixa em px (min-w-max) — a fileira de
                              16 dentes precisa de ~725px pra não entrar em scroll horizontal, o que só cabe dando 60% à coluna.
                              Empilha abaixo de lg. */}
                          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                            {/* Odontograma — 40% */}
                            <div className="lg:col-span-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/70 mb-3">Odontograma</p>
                              <div className="bg-surface-alt rounded-2xl border border-border/40 px-6 py-5">
                                <p className="text-[11px] text-text-secondary/60 text-center mb-4 flex items-center justify-center gap-1.5">
                                  <ChevronRight className="w-3 h-3" />
                                  Clique em um dente para filtrar os procedimentos
                                </p>
                                <Odontograma
                                  colorMode="status"
                                  statusTeeth={computeToothStatusMap(evo)}
                                  selectedTeeth={filterTooth ? [filterTooth] : []}
                                  onToothToggle={(tooth) => setFilterTooth((prev) => prev === tooth ? null : tooth)}
                                  hideFilters
                                />
                                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-semibold text-text-secondary">
                                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-surface-alt border border-border" /> A fazer</span>
                                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-warning)' }} /> Em andamento</span>
                                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal" /> Concluído</span>
                                </div>
                                {filterTooth && (
                                  <button
                                    onClick={() => setFilterTooth(null)}
                                    className="mt-4 w-full text-center text-xs text-teal hover:underline flex items-center justify-center gap-1"
                                  >
                                    <X className="w-3 h-3" /> Limpar filtro (D{filterTooth})
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Progresso + Procedimentos — 60% */}
                            <div className="lg:col-span-2 space-y-6">

                              {/* Progresso + Apresentar */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/70">Progresso do tratamento</p>
                                  <span className="text-xs text-text-secondary">{doneProcs} de {totalProcs} concluídos</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-surface-alt border border-border/40 overflow-hidden">
                                  <div className="h-2 rounded-full bg-teal transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-teal">{pct}%</span>
                                    <span className="text-sm text-text-secondary">concluído</span>
                                  </div>
                                  <ApresentarPaciente
                                    patientId={patientId}
                                    clinicaId={clinicaId}
                                    patientName={patientName ?? ''}
                                    dentistaId={dentistaId}
                                    fichaId={evo.id}
                                    compact
                                  />
                                </div>
                              </div>

                              {/* Procedimentos com status toggle */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/70">
                                    Procedimentos
                                    {filterTooth && <span className="ml-2 text-teal normal-case font-normal">— D{filterTooth}</span>}
                                  </p>
                                  <p className="text-[10px] text-text-secondary/60">Clique no status para avançar</p>
                                </div>
                                {filteredTeethNotes.length === 0 ? (
                                  <p className="text-sm text-text-secondary/50 italic">Nenhum procedimento registrado.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filteredTeethNotes.map((tn) => {
                                      const label = tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : `D${tn.tooth}`;
                                      return (
                                        <div key={tn.tooth} className="bg-surface-alt rounded-xl border border-border/40 p-4">
                                          <p className="font-mono text-[10px] font-bold text-teal mb-3">{label}</p>
                                          <div className="space-y-2">
                                            {tn.notes.filter(Boolean).map((note, i) => {
                                              const procKey = `${tn.tooth}_${i}`;
                                              const status = evo.procedimentosStatus[procKey] ?? 'nao_iniciado';
                                              const meta = STATUS_META[status] ?? STATUS_META.nao_iniciado;
                                              return (
                                                <div key={i} className="flex items-center gap-2">
                                                  {podeEditarFicha(evo) ? (
                                                    <button
                                                      onClick={() => void updateProcStatus(evo.id, evo.procedimentosStatus, procKey, STATUS_CYCLE[status])}
                                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 transition-all border ${meta.className}`}
                                                    >
                                                      <meta.icon className="w-3 h-3" />
                                                      {meta.label}
                                                    </button>
                                                  ) : (
                                                    // Vê o status, não altera. Vale pra secretária (papel) E pro dentista
                                                    // que não é o autor da ficha (migration 099) — a RLS barra os dois.
                                                    <span
                                                      title={canWrite && evo.dentistaId !== dentistaId ? `Registrado por ${evo.professional}` : undefined}
                                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 border ${meta.className} cursor-default`}
                                                    >
                                                      <meta.icon className="w-3 h-3" />
                                                      {meta.label}
                                                    </span>
                                                  )}
                                                  <span className={`text-xs leading-tight ${status === 'concluido' ? 'line-through text-text-secondary' : 'text-text-primary'}`}>{note}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>
                          </div>

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

