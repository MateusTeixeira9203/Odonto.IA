"use client";

import * as React from "react";
import {
  Plus,
  X,
  Mic,
  MicOff,
  Trash2,
  MoreVertical,
  Edit2,
  FileText,
  Upload,
  Check,
  User,
  Loader2,
  Sparkles,
  Lock,
  PenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { criarOrcamento } from "@/app/dashboard/orcamentos/actions";
import { toast } from 'sonner';
import { temFeature, type PlanoId } from "@/lib/planos";
import { SignaturePad } from "@/components/fichas/SignaturePad";
import type SignaturePadLib from 'signature_pad';

interface ToothNote {
  tooth: number;
  notes: string[];
}

type SelectionMode = 'single' | 'multiple' | 'arch';

const ARCH_SUPERIOR = 97;
const ARCH_INFERIOR = 98;
const ARCH_COMPLETA = 99;

const ARCH_LABELS: Record<number, string> = {
  [ARCH_SUPERIOR]: 'Arcada Superior',
  [ARCH_INFERIOR]: 'Arcada Inferior',
  [ARCH_COMPLETA]: 'Boca Toda',
};

interface Evolution {
  id: string;
  date: string;
  type: string;
  observation: string;
  teethNotes: ToothNote[];
  professional: string;
  files: string[];
  procedimentosConcluidos: string[];
  assinaturaUrl: string | null;
  assinadoEm: string | null;
}

type FichaDB = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  status: string;
  dentista?: { nome: string } | null;
  procedimentos_concluidos: string[];
  assinatura_url: string | null;
  assinado_em: string | null;
};

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const ALLOWED_MIME: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
};
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const getCategoria = (mime: string) => (mime.startsWith('image/') ? 'Fotografias' : 'Documentos');

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
  files: [],
  procedimentosConcluidos: f.procedimentos_concluidos ?? [],
  assinaturaUrl: f.assinatura_url ?? null,
  assinadoEm: f.assinado_em ?? null,
});

interface FichasTabProps {
  patientId: string;
  clinicaId: string;
  dentistaId: string;
  plano?: PlanoId;
}

export function FichasTab({ patientId, clinicaId, dentistaId, plano }: FichasTabProps) {
  const router = useRouter();
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [signingFichaId, setSigningFichaId] = React.useState<string | null>(null);
  const [isSavingSignature, setIsSavingSignature] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadLib | null>(null);
  const [uploadedFiles, setUploadedFiles] = React.useState<
    Array<{ name: string; url: string; docId: string; storagePath: string }>
  >([]);
  const [isUploading, setIsUploading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    type: "Evolução",
    observation: "",
    teethNotes: [] as ToothNote[],
  } as { type: string; observation: string; teethNotes: ToothNote[] });

  // ── Orçamento sugerido pela IA ────────────────────────────────────────────
  type ItemSugerido = { descricao: string; quantidade: number; preco: number };
  const [isDexAnalyzing, setIsDexAnalyzing] = React.useState(false);
  const [orcamentoSugerido, setOrcamentoSugerido] = React.useState<ItemSugerido[] | null>(null);
  const [criandoOrcamento, setCriandoOrcamento] = React.useState(false);
  const dexDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listener DEX com debounce de 2 s — analisa o texto enquanto o dentista digita
  React.useEffect(() => {
    // Geração de orçamento por IA não disponível no plano Solo
    if (!temFeature(plano, 'orcamentoIA')) return;

    const texto = formData.observation.trim();

    // Só analisa novas fichas (não edições) com texto mínimo e painel aberto
    if (!isPanelOpen || editingId || texto.length < 30) {
      setIsDexAnalyzing(false);
      if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
      return;
    }

    // Mostra indicador após 300 ms de pausa (feedback visual imediato)
    if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
    setIsDexAnalyzing(true);

    dexDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/sugerir-orcamento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto, clinicaId }),
        });
        if (!res.ok) return;
        const data = await res.json() as {
          itens?: Array<{ descricao: string; quantidade: number; precoSugerido: number | null }>;
        };
        if (data.itens && data.itens.length > 0) {
          setOrcamentoSugerido(
            data.itens.map((i) => ({
              descricao: i.descricao,
              quantidade: i.quantidade,
              preco: i.precoSugerido ?? 0,
            })),
          );
        }
      } catch (err) {
        console.error('[DEX] Erro ao analisar evolução:', err);
      } finally {
        setIsDexAnalyzing(false);
      }
    }, 2000);

    return () => {
      if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.observation, isPanelOpen, editingId]);

  // Busca fichas do Supabase
  const fetchFichas = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fichas")
        .select("id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, assinatura_url, assinado_em, dentista:dentistas(nome)")
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
  }, [patientId, clinicaId]);

  React.useEffect(() => {
    if (patientId && clinicaId) {
      void fetchFichas();
    }
  }, [patientId, clinicaId, fetchFichas]);

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
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
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
      const data = await response.json() as { texto?: string };
      if (data.texto) {
        setFormData((f) => ({
          ...f,
          observation: f.observation ? `${f.observation}\n${data.texto}` : (data.texto ?? ""),
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

  const handleToggleProcedimento = async (fichaId: string, key: string, current: string[]): Promise<void> => {
    const supabase = createClient();
    const newConcluidos = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];

    const { error } = await supabase
      .from('fichas')
      .update({ procedimentos_concluidos: newConcluidos })
      .eq('id', fichaId)
      .eq('clinica_id', clinicaId);

    if (!error) {
      setEvolutions((prev) =>
        prev.map((e) =>
          e.id === fichaId ? { ...e, procedimentosConcluidos: newConcluidos } : e
        )
      );
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const isNovaFicha = !editingId;

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
      if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
      setIsDexAnalyzing(false);

      // Auto-gera orçamento se houver procedimentos sugeridos pelo DEX
      const itensValidos = (orcamentoSugerido ?? []).filter((i) => i.descricao.trim() && i.preco > 0);
      if (itensValidos.length > 0) {
        try {
          const result = await criarOrcamento({
            pacienteId: patientId,
            itens: itensValidos.map((i) => ({
              procedimentoId: null,
              descricao: i.descricao,
              quantidade: i.quantidade,
              precoUnitario: i.preco,
            })),
          });
          if (!result.error) {
            setOrcamentoSugerido(null);
            toast.success('Orçamento gerado automaticamente', {
              description: 'Revise e confirme na aba Orçamentos para enviar à secretaria.',
              duration: 5000,
            });
          }
        } catch (err) {
          console.error('Erro ao gerar orçamento automático:', err);
        }
      }

      closePanel();
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmarOrcamento = async () => {
    if (!orcamentoSugerido) return;
    const itensValidos = orcamentoSugerido.filter((i) => i.descricao.trim() && i.preco > 0);
    if (itensValidos.length === 0) return;
    setCriandoOrcamento(true);
    try {
      const result = await criarOrcamento({
        pacienteId: patientId,
        itens: itensValidos.map((i) => ({
          procedimentoId: null,
          descricao: i.descricao,
          quantidade: i.quantidade,
          precoUnitario: i.preco,
        })),
      });
      if (!result.error) {
        setOrcamentoSugerido(null);
        router.push('/dashboard/orcamentos');
      }
    } catch (err) {
      console.error('Erro ao criar orçamento:', err);
    } finally {
      setCriandoOrcamento(false);
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

      const { data: urlData } = supabase.storage.from('fichas').getPublicUrl(storagePath);
      const assinadoEm = new Date().toISOString();

      const { error: dbErr } = await supabase
        .from('fichas')
        .update({ assinatura_url: urlData.publicUrl, assinado_em: assinadoEm })
        .eq('id', signingFichaId)
        .eq('clinica_id', clinicaId);
      if (dbErr) throw dbErr;

      setEvolutions((prev) =>
        prev.map((e) =>
          e.id === signingFichaId
            ? { ...e, assinaturaUrl: urlData.publicUrl, assinadoEm: assinadoEm }
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
    setUploadedFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!ALLOWED_MIME[file.type]) {
      alert('Tipo não permitido. Use JPG, PNG, WEBP, PDF ou DOCX.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      alert('Arquivo muito grande. Máximo 10 MB.');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const storagePath = `${clinicaId}/${patientId}/${Date.now()}_${file.name}`;

      const { error: storageErr } = await supabase.storage
        .from('fichas')
        .upload(storagePath, file, { upsert: false });
      if (storageErr) throw storageErr;

      const { data: urlData } = supabase.storage.from('fichas').getPublicUrl(storagePath);

      const { data: doc, error: dbErr } = await supabase
        .from('paciente_documentos')
        .insert({
          paciente_id: patientId,
          clinica_id: clinicaId,
          nome: file.name,
          url: urlData.publicUrl,
          categoria: getCategoria(file.type),
        })
        .select('id')
        .single();
      if (dbErr) throw dbErr;

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, url: urlData.publicUrl, docId: doc.id as string, storagePath },
      ]);
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro ao fazer upload. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async (docId: string, storagePath: string) => {
    try {
      const supabase = createClient();
      await Promise.all([
        supabase.from('paciente_documentos').delete().eq('id', docId),
        supabase.storage.from('fichas').remove([storagePath]),
      ]);
      setUploadedFiles((prev) => prev.filter((f) => f.docId !== docId));
    } catch (err) {
      console.error('Erro ao remover arquivo:', err);
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
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-2xl text-foreground">Histórico Clínico</h2>
        {!isPanelOpen && (
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
            <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 md:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
              {/* Coluna Esquerda */}
              <div className="flex-[3] flex flex-col gap-6">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">
                    Tipo de Registro
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground outline-none focus:border-teal transition-colors"
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
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center">
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-muted text-muted-foreground cursor-not-allowed select-none"
                      >
                        <Lock className="w-3.5 h-3.5" /> Gravar Voz (IA)
                      </span>
                    )}
                  </div>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Descreva os procedimentos realizados, queixas do paciente, etc..."
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground outline-none focus:border-teal transition-colors min-h-[120px] resize-y"
                  />
                  {/* Indicador do DEX escutando */}
                  <AnimatePresence>
                    {isDexAnalyzing && !editingId && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-1.5 text-[11px] mt-1"
                        style={{ color: 'rgba(47,156,133,0.7)' }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        DEX analisando procedimentos...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Seção de procedimentos — sempre visível, sem layout shift */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                    Procedimentos
                  </label>

                  {selectedTeeth.length === 0 && sharedTeeth.length === 0 ? (
                    <div className="min-h-[88px] flex items-center justify-center text-xs text-muted-foreground bg-background rounded-xl border border-dashed border-border/60">
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
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Individuais</span>
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
                                  <div className="shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-[10px] font-bold shadow-sm mt-0.5 px-2 py-2 whitespace-nowrap">
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
                                        className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground outline-none focus:border-teal transition-colors"
                                      />
                                      {notes.length > 1 && (
                                        <button type="button" onClick={() => removeToothNote(tooth, idx)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
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
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">Grupo</span>
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
                            <div className="min-h-[60px] flex items-center justify-center text-xs text-muted-foreground bg-background rounded-xl border border-dashed border-border/60">
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
                                    className="flex-1 bg-background border border-teal/30 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground outline-none focus:border-teal transition-colors"
                                  />
                                  {sharedNotes.length > 1 && (
                                    <button type="button" onClick={() => removeSharedNote(idx)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
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

                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] mb-2">
                    Anexos
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => void handleFileSelect(e)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border-2 border-dashed border-border hover:border-teal bg-background rounded-xl py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                    <span className="text-sm font-medium">
                      {isUploading ? 'Enviando...' : 'Clique para fazer upload de imagens ou raio-x'}
                    </span>
                  </button>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedFiles.map((f) => (
                        <div
                          key={f.docId}
                          className="flex items-center justify-between px-3 py-2 bg-muted rounded-xl border border-border/40"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-foreground min-w-0">
                            <FileText className="w-3.5 h-3.5 text-teal shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </div>
                          <button
                            onClick={() => void handleRemoveFile(f.docId, f.storagePath)}
                            className="p-1 text-muted-foreground hover:text-red-500 transition-colors shrink-0 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                  <button
                    onClick={closePanel}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
              <div className="flex-[2] bg-background rounded-xl border border-border/60 p-4 md:p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-lg text-foreground flex items-center">
                    Odontograma
                    <HelpTooltip content="Escolha o tipo de seleção e marque os dentes ou arcadas afetados." />
                  </h3>
                  {selectionMode !== 'arch' && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-sm bg-teal" /> Selecionado
                    </div>
                  )}
                </div>

                {/* Seletor de modo */}
                <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
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
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {selectionMode !== 'arch' ? (
                  <div className="flex-1 flex flex-col justify-center gap-8">
                    <div className="flex justify-center gap-1 md:gap-1.5 flex-wrap">
                      {TEETH_UPPER.map((tooth) => (
                        <ToothButton
                          key={tooth}
                          num={tooth}
                          isSelected={selectedTeeth.includes(tooth) || sharedTeeth.includes(tooth)}
                          isShared={sharedTeeth.includes(tooth)}
                          isUpper={true}
                          showCheckbox={selectionMode === 'multiple'}
                          onClick={() => toggleTooth(tooth)}
                        />
                      ))}
                    </div>
                    <div className="flex justify-center gap-1 md:gap-1.5 flex-wrap">
                      {TEETH_LOWER.map((tooth) => (
                        <ToothButton
                          key={tooth}
                          num={tooth}
                          isSelected={selectedTeeth.includes(tooth) || sharedTeeth.includes(tooth)}
                          isShared={sharedTeeth.includes(tooth)}
                          isUpper={false}
                          showCheckbox={selectionMode === 'multiple'}
                          onClick={() => toggleTooth(tooth)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    <p className="text-xs text-muted-foreground text-center mb-1">
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
                            : 'bg-muted border-border text-foreground hover:border-teal hover:text-teal'
                        }`}
                      >
                        <span>{label}</span>
                        <span className={`text-[10px] font-normal ${selectedTeeth.includes(id) ? 'text-white/70' : 'text-muted-foreground'}`}>
                          {sub}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-6 text-center text-xs text-muted-foreground font-medium">
                  {selectionMode === 'single' && 'Clique em um dente para adicionar observações.'}
                  {selectionMode === 'multiple' && 'Clique em vários dentes para marcar juntos.'}
                  {selectionMode === 'arch' && 'Procedimentos em toda a arcada ou boca.'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {evolutions.length === 0 && !isPanelOpen && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            Nenhuma evolução registrada. Clique em &ldquo;Nova Evolução&rdquo; para começar.
          </p>
        </div>
      )}

      <div className="relative space-y-8 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border/40">
        {evolutions.map((evo, idx) => {
          const validKeys = evo.teethNotes.flatMap((tn) =>
            tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`)
          );
          const totalProcs = validKeys.length;
          const doneProcs = evo.procedimentosConcluidos.filter((k) => validKeys.includes(k)).length;
          const allDone = totalProcs > 0 && doneProcs === totalProcs;

          return (
          <motion.div
            key={evo.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="relative pl-12 group"
          >
            <div className={`absolute left-0 top-1 w-10 h-10 rounded-full bg-card border-2 flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform ${allDone ? 'border-emerald-500' : 'border-teal'}`}>
              {allDone
                ? <Check className="w-4 h-4 text-emerald-500" />
                : <div className="w-2 h-2 rounded-full bg-teal" />
              }
            </div>

            <div
              className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 hover:shadow-md transition-all"
              style={allDone ? { boxShadow: '-3px 0 0 0 #10b981, 0 1px 3px rgba(0,0,0,0.06)' } : undefined}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="bg-teal/10 text-teal px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest">
                      {evo.type}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{evo.date}</h4>
                    {totalProcs > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${allDone ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                        {allDone ? '✓ Concluído' : `${doneProcs}/${totalProcs} realizados`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                    <User className="w-3 h-3" /> {evo.professional}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {evo.assinadoEm ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold">
                      <Check className="w-3 h-3" />
                      Assinado em {new Date(evo.assinadoEm).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <button
                      onClick={() => setSigningFichaId(evo.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-border text-muted-foreground hover:border-teal hover:text-teal transition-colors"
                    >
                      <PenLine className="w-3 h-3" />
                      Assinar
                    </button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(evo)}>
                        <Edit2 className="w-3 h-3" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(evo.id)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {evo.observation && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {evo.observation}
                </p>
              )}

              {evo.teethNotes.length > 0 && (
                <div className="flex flex-col gap-2 mb-4">
                  {evo.teethNotes.map((tn) => (
                    <div
                      key={tn.tooth}
                      className="bg-muted rounded-lg border border-border/40 px-3 py-2"
                    >
                      <span className="font-mono text-[10px] font-bold text-teal block mb-1.5">
                        {tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : `D${tn.tooth}`}
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {tn.notes.filter(Boolean).map((n, i) => {
                          const procKey = `${tn.tooth}_${i}`;
                          const done = evo.procedimentosConcluidos.includes(procKey);
                          return (
                            <button
                              key={i}
                              onClick={() => void handleToggleProcedimento(evo.id, procKey, evo.procedimentosConcluidos)}
                              className="flex items-center gap-2 text-left group/proc w-full"
                            >
                              <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border group-hover/proc:border-teal'}`}>
                                {done && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className={`text-[11px] font-medium transition-all ${done ? 'line-through text-muted-foreground' : 'text-foreground group-hover/proc:text-teal'}`}>
                                {n}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {evo.files.length > 0 && (
                <div className="flex gap-2">
                  {evo.files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl border border-border/40 text-[10px] font-bold text-foreground"
                    >
                      <FileText className="w-3 h-3 text-teal" /> {f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          );
        })}
      </div>

      {/* Modal: Orçamento sugerido pela IA */}
      <Dialog
        open={isDexAnalyzing || !!orcamentoSugerido}
        onOpenChange={(open) => {
          if (!open) {
            setOrcamentoSugerido(null);
            setIsDexAnalyzing(false);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal" />
              Orçamento sugerido pela IA
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Com base na evolução registrada, identifiquei os seguintes procedimentos.
              Ajuste os valores e confirme para criar o rascunho de orçamento.
            </DialogDescription>
          </DialogHeader>

          {isDexAnalyzing ? (
            <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-teal" />
              <p className="text-sm font-medium">Analisando procedimentos...</p>
            </div>
          ) : orcamentoSugerido && (
            <div className="space-y-3 my-2">
              {orcamentoSugerido.map((item, idx) => (
                <div key={idx} className="bg-muted rounded-xl border border-border/60 p-3 space-y-2">
                  <input
                    type="text"
                    value={item.descricao}
                    onChange={(e) =>
                      setOrcamentoSugerido((prev) =>
                        prev?.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it) ?? null
                      )
                    }
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-teal transition-colors"
                  />
                  <div className="flex gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        Qtd
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) =>
                          setOrcamentoSugerido((prev) =>
                            prev?.map((it, i) =>
                              i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it
                            ) ?? null
                          )
                        }
                        className="w-16 bg-background border border-border rounded-lg px-2 py-2 text-sm font-mono text-foreground outline-none focus:border-teal"
                      />
                    </div>
                    <div className="space-y-0.5 flex-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        Valor (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.preco}
                        onChange={(e) =>
                          setOrcamentoSugerido((prev) =>
                            prev?.map((it, i) =>
                              i === idx ? { ...it, preco: parseFloat(e.target.value) || 0 } : it
                            ) ?? null
                          )
                        }
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-teal"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-teal/10 rounded-xl p-3 flex justify-between items-center border border-teal/20">
                <span className="text-sm font-bold text-foreground">Total estimado</span>
                <span className="font-mono font-bold text-teal">
                  {orcamentoSugerido
                    .reduce((s, i) => s + i.quantidade * i.preco, 0)
                    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setOrcamentoSugerido(null)}
              disabled={criandoOrcamento || isDexAnalyzing}
              className="rounded-xl border-border text-foreground hover:bg-muted"
            >
              Ignorar
            </Button>
            <Button
              onClick={() => void handleConfirmarOrcamento()}
              disabled={criandoOrcamento || !orcamentoSugerido}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl"
            >
              {criandoOrcamento ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Criando...</>
              ) : (
                'Criar Orçamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Assinatura do Paciente */}
      <Dialog open={!!signingFichaId} onOpenChange={(open) => { if (!open) setSigningFichaId(null); }}>
        <DialogContent className="max-w-md rounded-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
              <PenLine className="w-5 h-5 text-teal" />
              Assinatura do Paciente
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Vire a tela para o paciente e peça que assine com o dedo ou mouse.
            </DialogDescription>
          </DialogHeader>

          <SignaturePad padRef={signaturePadRef} />

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setSigningFichaId(null)}
              disabled={isSavingSignature}
              className="rounded-xl border-border text-foreground hover:bg-muted"
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
              className="relative bg-card rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-border/40"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-heading text-2xl text-foreground mb-2">Excluir Evolução?</h3>
              <p className="text-muted-foreground text-sm mb-8">
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

function ToothButton({
  num,
  isSelected,
  isShared,
  isUpper,
  showCheckbox,
  onClick,
}: {
  num: number;
  isSelected: boolean;
  isShared: boolean;
  isUpper: boolean;
  showCheckbox: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-9 h-11 md:w-10 md:h-12 border-2 flex items-center justify-center font-mono text-[10px] md:text-xs font-bold transition-all active:scale-95 ${
        isUpper ? "rounded-t-md rounded-b-sm" : "rounded-b-md rounded-t-sm"
      } ${
        isShared
          ? "bg-teal/20 border-teal text-teal shadow-md scale-110 z-10"
          : isSelected
          ? "bg-teal border-teal text-white shadow-md scale-110 z-10"
          : "bg-muted border-border text-muted-foreground hover:border-teal hover:text-teal"
      }`}
    >
      {num}
      {showCheckbox && (
        <div
          className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-sm border transition-all ${
            isShared ? 'bg-teal border-teal' : isSelected ? 'bg-white border-white' : 'border-muted-foreground/50'
          }`}
        />
      )}
    </button>
  );
}
