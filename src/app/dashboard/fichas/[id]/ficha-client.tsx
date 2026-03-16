"use client";

import { useState, useCallback, useRef, useEffect, useId } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Mic,
  Square,
  ArrowLeft,
  X,
  Upload,
  FileText,
  Plus,
  Loader2,
  Image as ImageIcon,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  Presentation,
  Receipt,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/dentai";
import { createClient } from "@/lib/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type {
  Ficha,
  Paciente,
  Dentista,
  FichaArquivo,
  Planejamento,
  PlanejamentoEtapa,
  Orcamento,
  OrcamentoItem,
} from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
      {children}
    </p>
  );
}

function Waveform(): React.JSX.Element {
  return (
    <div className="flex items-center gap-0.5">
      {[4, 7, 5, 8, 4, 6, 3].map((h, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-teal animate-pulse"
          style={{ height: h * 2 }}
        />
      ))}
    </div>
  );
}

function separador(fonte: string): string {
  return `\n\n--- [${fonte}] ---\n`;
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

type EtapaStatus = "aberto" | "pendente" | "concluido";
type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado";

const ETAPA_STATUS_LABEL: Record<EtapaStatus, string> = {
  aberto: "Aberto",
  pendente: "Pendente",
  concluido: "Concluído",
};

const ORC_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const ORC_STATUS_VARIANT: Record<OrcamentoStatus, "gray" | "teal" | "success" | "error"> = {
  rascunho: "gray",
  enviado: "teal",
  aprovado: "success",
  recusado: "error",
};

interface EtapaForm {
  titulo: string;
  dentes: string[];
  observacao: string;
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function etapaStatusClassName(status: EtapaStatus): string {
  if (status === "concluido") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (status === "pendente") return "bg-primary/15 text-primary";
  return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
}

// ── Linha de item do orçamento ────────────────────────────────────────────────

interface OrcamentoItemRowProps {
  etapa: PlanejamentoEtapa;
  item: OrcamentoItem | undefined;
  onStatusChange: (etapa: PlanejamentoEtapa, status: EtapaStatus) => void;
  onPrecoSalvo: (etapaId: string, itemId: string, preco: number | null) => void;
}

function OrcamentoItemRow({ etapa, item, onStatusChange, onPrecoSalvo }: OrcamentoItemRowProps): React.JSX.Element {
  const [preco, setPreco] = useState(item?.preco_unitario != null ? String(item.preco_unitario) : "");
  const s = (etapa.status as EtapaStatus) ?? "aberto";

  function handleBlur(): void {
    if (!item) return;
    const valor = preco.trim() === "" ? null : Number(preco);
    const atual = item.preco_unitario;
    // Só salva se mudou
    if ((valor === null && atual === null) || valor === atual) return;
    onPrecoSalvo(etapa.id, item.id, valor);
  }

  return (
    <div
      className="grid items-center gap-3 rounded border border-brand-border bg-brand-bg px-3 py-2.5"
      style={{ gridTemplateColumns: "1fr 100px 140px 110px" }}
    >
      <div>
        <p className="font-sans text-sm text-brand-black">{etapa.titulo}</p>
        {etapa.descricao_simples && (
          <p className="font-mono text-xs text-brand-muted mt-0.5 truncate">
            {etapa.descricao_simples}
          </p>
        )}
      </div>
      {/* Status interativo */}
      <div className={`relative inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-medium w-fit ${etapaStatusClassName(s)}`}>
        {ETAPA_STATUS_LABEL[s]}
        <select
          value={s}
          onChange={(e) => onStatusChange(etapa, e.target.value as EtapaStatus)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        >
          <option value="aberto">Aberto</option>
          <option value="pendente">Pendente</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>
      <p className="font-mono text-xs text-brand-muted">
        {(etapa.dentes ?? []).length > 0
          ? (etapa.dentes ?? [])
              .sort((a, b) => Number(a) - Number(b))
              .join(", ")
          : "—"}
      </p>
      <div className="flex items-center justify-end">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-brand-muted">
            R$
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onBlur={handleBlur}
            placeholder="0,00"
            className="w-24 rounded border border-brand-border bg-white pl-7 pr-2 py-1.5 font-mono text-xs text-brand-black text-right focus:border-teal focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FichaClientProps {
  ficha: Ficha;
  paciente: Paciente;
  dentista: Pick<Dentista, "id" | "nome" | "especialidade">;
  clinicaId: string;
  arquivosIniciais: FichaArquivo[];
  planejamentoInicial: Planejamento | null;
  etapasIniciais: PlanejamentoEtapa[];
  orcamentoInicial: Orcamento | null;
  orcamentoItensIniciais: OrcamentoItem[];
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FichaClient({
  ficha: fichaInicial,
  paciente,
  dentista,
  clinicaId,
  arquivosIniciais,
  planejamentoInicial,
  etapasIniciais,
  orcamentoInicial,
  orcamentoItensIniciais,
}: FichaClientProps): React.JSX.Element {
  const supabase = createClient();
  const docInputId = useId();
  const rxInputId = useId();
  const fotoInputId = useId();

  // ── Estado principal ──────────────────────────────────────────────
  const [ficha, setFicha] = useState(fichaInicial);
  const [anotacoes, setAnotacoes] = useState(fichaInicial.anotacoes ?? "");
  const [arquivos, setArquivos] = useState<FichaArquivo[]>(arquivosIniciais);
  const [activeTab, setActiveTab] = useState("ficha");

  // ── Anamnese ──────────────────────────────────────────────────────
  const [queixaPrincipal, setQueixaPrincipal] = useState(fichaInicial.queixa_principal ?? "");
  const [historicoDental, setHistoricoDental] = useState(fichaInicial.historico_dental ?? "");
  const [historicoMedico, setHistoricoMedico] = useState(fichaInicial.historico_medico ?? "");
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false);

  // ── Odontograma ───────────────────────────────────────────────────
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>(
    fichaInicial.dentes_afetados ?? []
  );
  const anamneseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const odontogramaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Planejamento ──────────────────────────────────────────────────
  const [planejamento, setPlanejamento] = useState<Planejamento | null>(planejamentoInicial);
  const [etapas, setEtapas] = useState<PlanejamentoEtapa[]>(etapasIniciais);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);

  // ── Orçamento ─────────────────────────────────────────────────────
  const [orcamento, setOrcamento] = useState<Orcamento | null>(orcamentoInicial);
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>(orcamentoItensIniciais);
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [etapaForm, setEtapaForm] = useState<EtapaForm>({
    titulo: "",
    dentes: [],
    observacao: "",
  });
  const [vinculandoEtapaId, setVinculandoEtapaId] = useState<string | null>(null);

  // ── Signed URLs ───────────────────────────────────────────────────
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // ── Estado de UI ──────────────────────────────────────────────────
  const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false);
  const [processandoTranscricao, setProcessandoTranscricao] = useState(false);
  const [uploadandoDoc, setUploadandoDoc] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const [uploadandoRx, setUploadandoRx] = useState(false);
  const [concluindoFicha, setConcluindoFicha] = useState(false);

  // Lightboxes
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fotoLightboxOpen, setFotoLightboxOpen] = useState(false);
  const [fotoLightboxIndex, setFotoLightboxIndex] = useState(0);

  // Apresentação por etapas
  const [apresentacaoOpen, setApresentacaoOpen] = useState(false);
  const [apresentacaoIndex, setApresentacaoIndex] = useState(0);

  const anotacoesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status: recorderStatus, timer, startRecording, stopRecording } =
    useAudioRecorder();

  // Listas derivadas por tipo
  const documentos = arquivos.filter((a) => a.tipo === "documento");
  const fotosficha = arquivos.filter((a) => a.tipo === "foto_ficha");
  const radiografias = arquivos.filter((a) => a.tipo === "radiografia");

  // ── Signed URLs ───────────────────────────────────────────────────
  const carregarSignedUrl = useCallback(
    async (arquivo: FichaArquivo): Promise<string | null> => {
      const bucket =
        arquivo.tipo === "foto_ficha"
          ? "fichas"
          : arquivo.tipo === "radiografia"
          ? "radiografias"
          : "documentos";

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(arquivo.storage_url, 3600);

      if (error || !data?.signedUrl) return null;
      setSignedUrls((prev) => ({ ...prev, [arquivo.id]: data.signedUrl }));
      return data.signedUrl;
    },
    [supabase]
  );

  // Carrega signed URLs ao montar
  useEffect(() => {
    arquivos
      .filter((a) => a.tipo === "foto_ficha" || a.tipo === "radiografia")
      .forEach((a) => carregarSignedUrl(a));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Formatação ────────────────────────────────────────────────────
  function formatarTimer(segundos: number): string {
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = (segundos % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const dataFormatada = format(
    new Date(ficha.created_at),
    "dd 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );

  const estaGravando = recorderStatus === "recording";
  const estaProcessandoAudio = recorderStatus === "processing" || processandoTranscricao;

  // ── Auto-save anotações (debounce 2s) ─────────────────────────────
  function handleAnotacoesChange(valor: string): void {
    setAnotacoes(valor);
    if (anotacoesTimerRef.current) clearTimeout(anotacoesTimerRef.current);
    anotacoesTimerRef.current = setTimeout(async () => {
      setSalvandoAnotacoes(true);
      await supabase.from("fichas").update({ anotacoes: valor }).eq("id", ficha.id);
      setSalvandoAnotacoes(false);
    }, 2000);
  }

  // ── Auto-save anamnese (debounce 2s) ──────────────────────────────
  function handleAnamneseChange(
    campo: string,
    valor: string,
    setter: (v: string) => void
  ): void {
    setter(valor);
    if (anamneseTimerRef.current) clearTimeout(anamneseTimerRef.current);
    anamneseTimerRef.current = setTimeout(async () => {
      setSalvandoAnamnese(true);
      await supabase.from("fichas").update({ [campo]: valor }).eq("id", ficha.id);
      setSalvandoAnamnese(false);
    }, 2000);
  }

  // ── Toggle dente no odontograma ───────────────────────────────────
  function toggleDente(dente: string): void {
    const novos = dentesSelecionados.includes(dente)
      ? dentesSelecionados.filter((d) => d !== dente)
      : [...dentesSelecionados, dente];
    setDentesSelecionados(novos);
    if (odontogramaTimerRef.current) clearTimeout(odontogramaTimerRef.current);
    odontogramaTimerRef.current = setTimeout(async () => {
      await supabase.from("fichas").update({ dentes_afetados: novos }).eq("id", ficha.id);
    }, 500);
  }

  // ── Alterar status da ficha ───────────────────────────────────────
  async function handleAlterarStatusFicha(novoStatus: "aberta" | "concluida"): Promise<void> {
    if (ficha.status === novoStatus) return;
    setConcluindoFicha(true);
    try {
      const { error } = await supabase
        .from("fichas")
        .update({ status: novoStatus })
        .eq("id", ficha.id);

      if (error) { toast.error("Erro ao alterar status da ficha."); return; }
      setFicha((f) => ({ ...f, status: novoStatus }));
      toast.success(novoStatus === "concluida" ? "Ficha concluída!" : "Ficha reaberta!");
    } catch {
      toast.error("Erro inesperado ao alterar status.");
    } finally {
      setConcluindoFicha(false);
    }
  }

  // ── Gravação de voz ───────────────────────────────────────────────
  const handlePararGravacao = useCallback(async (): Promise<void> => {
    const blob = await stopRecording();
    if (!blob) { toast.error("Nenhum áudio gravado."); return; }

    setProcessandoTranscricao(true);
    try {
      const timestamp = Date.now();
      const audioPath = `${clinicaId}/${ficha.id}/${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("audios")
        .upload(audioPath, blob, { contentType: "audio/webm" });

      if (uploadError) { toast.error("Erro ao fazer upload do áudio."); return; }

      await supabase.from("fichas").update({ audio_url: audioPath }).eq("id", ficha.id);

      const resp = await fetch("/api/transcricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha_id: ficha.id, audio_url: audioPath }),
      });

      if (!resp.ok) { toast.error("Erro ao transcrever áudio."); return; }

      const { transcricao: texto } = (await resp.json()) as { transcricao: string };
      const novoTexto = anotacoes
        ? anotacoes + separador("Gravação de voz") + texto
        : `--- [Gravação de voz] ---\n` + texto;
      handleAnotacoesChange(novoTexto);
      setFicha((f) => ({ ...f, audio_url: audioPath }));
      toast.success("Áudio transcrito e incluído nas anotações!");
    } catch {
      toast.error("Erro ao processar a gravação.");
    } finally {
      setProcessandoTranscricao(false);
    }
  }, [stopRecording, supabase, ficha.id, clinicaId, anotacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload de documentos ──────────────────────────────────────────
  async function processarArquivosDocumento(files: FileList | File[]): Promise<void> {
    const lista = Array.from(files);
    if (lista.length === 0) return;

    const tiposPermitidos = ["doc", "docx", "pdf", "txt"];
    for (const file of lista) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!tiposPermitidos.includes(ext)) { toast.error(`Tipo não suportado: ${file.name}`); return; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`Muito grande (máx 20MB): ${file.name}`); return; }
    }

    setUploadandoDoc(true);
    try {
      for (const file of lista) {
        const timestamp = Date.now();
        const storagePath = `${clinicaId}/${ficha.id}/docs/${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos").upload(storagePath, file);
        if (uploadError) { toast.error(`Erro ao enviar ${file.name}`); continue; }

        const resp = await fetch("/api/processar-documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ficha_id: ficha.id, clinica_id: clinicaId,
            nome_original: file.name, storage_url: storagePath,
          }),
        });

        if (!resp.ok) { toast.error(`Erro ao processar ${file.name}`); continue; }
        const { ficha_arquivo } = (await resp.json()) as { ficha_arquivo: FichaArquivo; texto: string };
        setArquivos((prev) => [...prev, ficha_arquivo]);
        toast.success(`${file.name} processado!`);
      }
    } catch {
      toast.error("Erro inesperado ao processar documentos.");
    } finally {
      setUploadandoDoc(false);
    }
  }

  function handleDocInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files) processarArquivosDocumento(e.target.files);
    e.target.value = "";
  }

  async function handleRemoverDocumento(arquivo: FichaArquivo): Promise<void> {
    try {
      await supabase.storage.from("documentos").remove([arquivo.storage_url]);
      await supabase.from("ficha_arquivos").delete().eq("id", arquivo.id);
      setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id));
      toast.success("Documento removido.");
    } catch { toast.error("Erro ao remover documento."); }
  }

  // ── Upload de foto da ficha ───────────────────────────────────────
  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      toast.error("Use jpg, png ou webp."); return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máx 10MB."); return; }

    setUploadandoFoto(true);
    try {
      const timestamp = Date.now();
      const storagePath = `${clinicaId}/${ficha.id}/foto_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("fichas").upload(storagePath, file);
      if (uploadError) { toast.error("Erro ao enviar foto."); return; }

      const { data: fichaArquivo, error: insertError } = await supabase
        .from("ficha_arquivos")
        .insert({
          ficha_id: ficha.id, clinica_id: clinicaId,
          tipo: "foto_ficha", nome_original: file.name,
          storage_url: storagePath, texto_extraido: null, processado: false,
        })
        .select().single();

      if (insertError || !fichaArquivo) { toast.error("Erro ao registrar foto."); return; }

      const novaFoto = fichaArquivo as FichaArquivo;
      setArquivos((prev) => [...prev, novaFoto]);
      await carregarSignedUrl(novaFoto);
      toast.success("Foto enviada!");
    } catch {
      toast.error("Erro ao processar foto.");
    } finally {
      setUploadandoFoto(false);
    }
  }

  async function handleRemoverFoto(arquivo: FichaArquivo): Promise<void> {
    try {
      await supabase.storage.from("fichas").remove([arquivo.storage_url]);
      await supabase.from("ficha_arquivos").delete().eq("id", arquivo.id);
      setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id));
      setSignedUrls((prev) => { const next = { ...prev }; delete next[arquivo.id]; return next; });
      toast.success("Foto removida.");
    } catch { toast.error("Erro ao remover foto."); }
  }

  // ── Upload de radiografias ────────────────────────────────────────
  async function handleUploadRx(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = "";

    const tiposPermitidos = ["jpg", "jpeg", "png", "webp", "pdf"];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!tiposPermitidos.includes(ext)) { toast.error(`Tipo não suportado: ${file.name}`); return; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`Muito grande (máx 20MB): ${file.name}`); return; }
    }

    setUploadandoRx(true);
    try {
      for (const file of files) {
        const timestamp = Date.now();
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const storagePath = `${clinicaId}/${ficha.id}/rx_${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("radiografias").upload(storagePath, file);
        if (uploadError) { toast.error(`Erro ao enviar ${file.name}`); continue; }

        const { data: fichaArquivo, error: insertError } = await supabase
          .from("ficha_arquivos")
          .insert({
            ficha_id: ficha.id, clinica_id: clinicaId,
            tipo: "radiografia", nome_original: file.name,
            storage_url: storagePath, texto_extraido: null, processado: true,
          })
          .select().single();

        if (insertError || !fichaArquivo) { toast.error(`Erro ao registrar ${file.name}`); continue; }

        const novaRx = fichaArquivo as FichaArquivo;
        setArquivos((prev) => [...prev, novaRx]);
        if (ext !== "pdf") await carregarSignedUrl(novaRx);
        toast.success(`${file.name} enviada!`);
      }
    } catch {
      toast.error("Erro ao enviar radiografias.");
    } finally {
      setUploadandoRx(false);
    }
  }

  async function handleRemoverRx(arquivo: FichaArquivo): Promise<void> {
    try {
      // Desvincular de etapas que usam esta imagem
      for (const etapa of etapas.filter((e) => e.imagem_arquivo_id === arquivo.id)) {
        await supabase.from("planejamento_etapas").update({ imagem_arquivo_id: null }).eq("id", etapa.id);
      }
      setEtapas((prev) =>
        prev.map((e) =>
          e.imagem_arquivo_id === arquivo.id ? { ...e, imagem_arquivo_id: null } : e
        )
      );
      await supabase.storage.from("radiografias").remove([arquivo.storage_url]);
      await supabase.from("ficha_arquivos").delete().eq("id", arquivo.id);
      setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id));
      setSignedUrls((prev) => { const next = { ...prev }; delete next[arquivo.id]; return next; });
      toast.success("Radiografia removida.");
    } catch { toast.error("Erro ao remover radiografia."); }
  }

  // ── Planejamento ──────────────────────────────────────────────────
  async function getOrCreatePlanejamento(): Promise<Planejamento | null> {
    if (planejamento) return planejamento;

    const { data, error } = await supabase
      .from("planejamentos")
      .insert({
        clinica_id: clinicaId,
        ficha_id: ficha.id,
        paciente_id: ficha.paciente_id,
        dentista_id: ficha.dentista_id,
      })
      .select()
      .single();

    if (error || !data) { toast.error("Erro ao criar planejamento."); return null; }
    const plano = data as Planejamento;
    setPlanejamento(plano);
    return plano;
  }

  // ── Orçamento: criar / sincronizar ────────────────────────────────
  async function getOrCreateOrcamento(): Promise<Orcamento | null> {
    if (orcamento) return orcamento;

    const { data, error } = await supabase
      .from("orcamentos")
      .insert({
        clinica_id: clinicaId,
        ficha_id: ficha.id,
        paciente_id: ficha.paciente_id,
        dentista_id: ficha.dentista_id,
        status: "rascunho",
        validade_dias: 30,
        total: null,
      })
      .select()
      .single();

    if (error || !data) { toast.error("Erro ao criar orçamento."); return null; }
    const orc = data as Orcamento;
    setOrcamento(orc);
    return orc;
  }

  // Garante que cada etapa tem um item de orçamento correspondente
  async function syncEtapasToItens(orc: Orcamento): Promise<void> {
    const etapasComItem = new Set(orcamentoItens.map((i) => i.etapa_id).filter(Boolean));
    const etapasSemItem = etapas.filter((e) => !etapasComItem.has(e.id));
    if (etapasSemItem.length === 0) return;

    const novosItens = etapasSemItem.map((e) => ({
      clinica_id: clinicaId,
      orcamento_id: orc.id,
      etapa_id: e.id,
      descricao: e.titulo,
      dente: (e.dentes ?? []).length > 0 ? (e.dentes ?? []).sort((a, b) => Number(a) - Number(b)).join(", ") : null,
      quantidade: 1,
      preco_unitario: null,
      preco_total: null,
    }));

    const { data } = await supabase.from("orcamento_itens").insert(novosItens).select();
    if (data) setOrcamentoItens((prev) => [...prev, ...(data as OrcamentoItem[])]);
  }

  // Chamado quando muda para a aba de orçamento
  async function handleAbrirAbaOrcamento(): Promise<void> {
    const orc = await getOrCreateOrcamento();
    if (orc) await syncEtapasToItens(orc);
  }

  // Salva preço de um item ao sair do campo
  async function handlePrecoSalvo(etapaId: string, itemId: string, preco: number | null): Promise<void> {
    const precoTotal = preco; // quantidade === 1
    await supabase
      .from("orcamento_itens")
      .update({ preco_unitario: preco, preco_total: precoTotal })
      .eq("id", itemId);

    const novosItens = orcamentoItens.map((i) =>
      i.id === itemId ? { ...i, preco_unitario: preco, preco_total: precoTotal } : i
    );
    setOrcamentoItens(novosItens);

    // Recalcula total do orçamento
    if (orcamento) {
      const total = novosItens
        .filter((i) => i.preco_total != null)
        .reduce((acc, i) => acc + (i.preco_total ?? 0), 0);
      await supabase.from("orcamentos").update({ total }).eq("id", orcamento.id);
      setOrcamento((o) => (o ? { ...o, total } : o));
    }
  }

  // Muda status do orçamento
  async function handleStatusOrcamento(novoStatus: OrcamentoStatus): Promise<void> {
    if (!orcamento || orcamento.status === novoStatus) return;
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: novoStatus })
      .eq("id", orcamento.id);
    if (error) { toast.error("Erro ao atualizar status."); return; }
    setOrcamento((o) => (o ? { ...o, status: novoStatus } : o));
  }

  function iniciarNovaEtapa(): void {
    setNovaEtapaOpen(true);
    setEditandoEtapaId(null);
    // Pré-popula com dentes do odontograma
    setEtapaForm({ titulo: "", dentes: [...dentesSelecionados], observacao: "" });
  }

  function iniciarEdicaoEtapa(etapa: PlanejamentoEtapa): void {
    setEditandoEtapaId(etapa.id);
    setNovaEtapaOpen(false);
    setEtapaForm({
      titulo: etapa.titulo,
      dentes: etapa.dentes ?? [],
      observacao: etapa.descricao_simples ?? "",
    });
  }

  function cancelarEdicaoEtapa(): void {
    setNovaEtapaOpen(false);
    setEditandoEtapaId(null);
    setEtapaForm({ titulo: "", dentes: [], observacao: "" });
  }

  async function handleAdicionarEtapa(): Promise<void> {
    if (!etapaForm.titulo.trim()) { toast.error("Informe o procedimento."); return; }

    setSalvandoEtapa(true);
    try {
      const plano = await getOrCreatePlanejamento();
      if (!plano) return;

      const { data, error } = await supabase
        .from("planejamento_etapas")
        .insert({
          clinica_id: clinicaId,
          planejamento_id: plano.id,
          ordem: etapas.length + 1,
          titulo: etapaForm.titulo.trim(),
          dentes: etapaForm.dentes,
          descricao_simples: etapaForm.observacao.trim() || null,
          status: "aberto",
        })
        .select()
        .single();

      if (error || !data) { toast.error("Erro ao adicionar etapa."); return; }
      const novaEtapa = data as PlanejamentoEtapa;
      setEtapas((prev) => [...prev, novaEtapa]);

      // Cria item no orçamento se já existir
      if (orcamento) {
        const { data: itemData } = await supabase
          .from("orcamento_itens")
          .insert({
            clinica_id: clinicaId,
            orcamento_id: orcamento.id,
            etapa_id: novaEtapa.id,
            descricao: novaEtapa.titulo,
            dente: (novaEtapa.dentes ?? []).length > 0
              ? (novaEtapa.dentes ?? []).sort((a, b) => Number(a) - Number(b)).join(", ")
              : null,
            quantidade: 1,
            preco_unitario: null,
            preco_total: null,
          })
          .select()
          .single();
        if (itemData) setOrcamentoItens((prev) => [...prev, itemData as OrcamentoItem]);
      }

      cancelarEdicaoEtapa();
      toast.success("Etapa adicionada!");
    } catch {
      toast.error("Erro ao adicionar etapa.");
    } finally {
      setSalvandoEtapa(false);
    }
  }

  async function handleAtualizarEtapa(): Promise<void> {
    if (!editandoEtapaId || !etapaForm.titulo.trim()) return;

    setSalvandoEtapa(true);
    try {
      const { error } = await supabase
        .from("planejamento_etapas")
        .update({
          titulo: etapaForm.titulo.trim(),
          dentes: etapaForm.dentes,
          descricao_simples: etapaForm.observacao.trim() || null,
        })
        .eq("id", editandoEtapaId);

      if (error) { toast.error("Erro ao atualizar etapa."); return; }
      setEtapas((prev) =>
        prev.map((e) =>
          e.id === editandoEtapaId
            ? {
                ...e,
                titulo: etapaForm.titulo.trim(),
                dentes: etapaForm.dentes,
                descricao_simples: etapaForm.observacao.trim() || null,
              }
            : e
        )
      );
      cancelarEdicaoEtapa();
      toast.success("Etapa atualizada!");
    } catch {
      toast.error("Erro ao atualizar etapa.");
    } finally {
      setSalvandoEtapa(false);
    }
  }

  async function handleRemoverEtapa(etapaId: string): Promise<void> {
    try {
      const { error } = await supabase.from("planejamento_etapas").delete().eq("id", etapaId);
      if (error) { toast.error("Erro ao remover etapa."); return; }
      setEtapas((prev) => prev.filter((e) => e.id !== etapaId));
      // Remove o item do orçamento do state local (banco já fez CASCADE)
      const itensRestantes = orcamentoItens.filter((i) => i.etapa_id !== etapaId);
      setOrcamentoItens(itensRestantes);
      // Recalcula total
      if (orcamento) {
        const total = itensRestantes
          .filter((i) => i.preco_total != null)
          .reduce((acc, i) => acc + (i.preco_total ?? 0), 0);
        await supabase.from("orcamentos").update({ total }).eq("id", orcamento.id);
        setOrcamento((o) => (o ? { ...o, total } : o));
      }
      toast.success("Etapa removida.");
    } catch { toast.error("Erro ao remover etapa."); }
  }

  async function handleSetStatus(etapa: PlanejamentoEtapa, novoStatus: EtapaStatus): Promise<void> {
    try {
      await supabase.from("planejamento_etapas").update({ status: novoStatus }).eq("id", etapa.id);
      setEtapas((prev) => prev.map((e) => e.id === etapa.id ? { ...e, status: novoStatus } : e));
    } catch { toast.error("Erro ao atualizar status."); }
  }

  async function handleVincularImagem(etapaId: string, arquivoId: string | null): Promise<void> {
    try {
      await supabase
        .from("planejamento_etapas")
        .update({ imagem_arquivo_id: arquivoId })
        .eq("id", etapaId);
      setEtapas((prev) =>
        prev.map((e) => e.id === etapaId ? { ...e, imagem_arquivo_id: arquivoId } : e)
      );
      setVinculandoEtapaId(null);
    } catch { toast.error("Erro ao vincular imagem."); }
  }

  // ── Navegação lightbox / apresentação ─────────────────────────────
  function lightboxAnterior(): void {
    setLightboxIndex((i) => (i > 0 ? i - 1 : radiografias.length - 1));
  }
  function lightboxProximo(): void {
    setLightboxIndex((i) => (i < radiografias.length - 1 ? i + 1 : 0));
  }
  function apresentacaoAnterior(): void {
    setApresentacaoIndex((i) => (i > 0 ? i - 1 : etapas.length - 1));
  }
  function apresentacaoProximo(): void {
    setApresentacaoIndex((i) => (i < etapas.length - 1 ? i + 1 : 0));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        setApresentacaoOpen(false);
        setLightboxOpen(false);
        setFotoLightboxOpen(false);
      }
      if (apresentacaoOpen) {
        if (e.key === "ArrowLeft") apresentacaoAnterior();
        if (e.key === "ArrowRight") apresentacaoProximo();
      }
      if (lightboxOpen) {
        if (e.key === "ArrowLeft") lightboxAnterior();
        if (e.key === "ArrowRight") lightboxProximo();
      }
      if (fotoLightboxOpen) {
        if (e.key === "ArrowLeft")
          setFotoLightboxIndex((i) => (i > 0 ? i - 1 : fotosficha.length - 1));
        if (e.key === "ArrowRight")
          setFotoLightboxIndex((i) => (i < fotosficha.length - 1 ? i + 1 : 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [apresentacaoOpen, lightboxOpen, fotoLightboxOpen, etapas.length, radiografias.length, fotosficha.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Formulário de etapa (reutilizado em nova e edição) ────────────
  function EtapaFormFields(): React.JSX.Element {
    return (
      <>
        {/* Dentes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
              Dentes
            </p>
            {dentesSelecionados.length > 0 && (
              <button
                className="font-mono text-xs text-teal hover:underline"
                onClick={() =>
                  setEtapaForm((f) => ({ ...f, dentes: [...dentesSelecionados] }))
                }
              >
                Usar seleção do odontograma ({dentesSelecionados.length})
              </button>
            )}
          </div>
          {etapaForm.dentes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {[...etapaForm.dentes]
                .sort((a, b) => Number(a) - Number(b))
                .map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 font-mono text-xs text-teal"
                  >
                    {d}
                    <button
                      onClick={() =>
                        setEtapaForm((f) => ({
                          ...f,
                          dentes: f.dentes.filter((x) => x !== d),
                        }))
                      }
                      className="text-teal/60 hover:text-teal"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
            </div>
          ) : (
            <p className="font-sans text-xs text-brand-muted">Nenhum dente selecionado</p>
          )}
        </div>

        {/* O que será feito */}
        <div className="space-y-1.5">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
            O que será feito
          </p>
          <Input
            placeholder="Ex: Canal radicular, Extração, Restauração..."
            value={etapaForm.titulo}
            onChange={(e) => setEtapaForm((f) => ({ ...f, titulo: e.target.value }))}
            className="font-sans text-sm border-brand-border bg-brand-bg focus:border-teal"
          />
        </div>

        {/* Observação */}
        <div className="space-y-1.5">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
            Observação
          </p>
          <Textarea
            placeholder="Detalhes adicionais..."
            value={etapaForm.observacao}
            onChange={(e) => setEtapaForm((f) => ({ ...f, observacao: e.target.value }))}
            className="font-sans text-sm resize-none min-h-[60px] border-brand-border bg-brand-bg focus:border-teal rounded p-3"
          />
        </div>
      </>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/pacientes">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={15} />
            Pacientes
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-2xl text-brand-black">
            Ficha de {paciente.nome}
          </h1>
          <p className="font-mono text-xs text-brand-muted mt-0.5">{dataFormatada}</p>
        </div>
        <div className="relative inline-flex" title="Clique para alterar o status">
          <Badge variant={ficha.status === "aberta" ? "warning" : "success"}>
            {ficha.status === "aberta" ? "Aberta" : "Concluída"}
          </Badge>
          <select
            value={ficha.status}
            onChange={(e) => void handleAlterarStatusFicha(e.target.value as "aberta" | "concluida")}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            disabled={concluindoFicha}
          >
            <option value="aberta">Aberta</option>
            <option value="concluida">Concluída</option>
          </select>
        </div>
      </div>

      {/* ── Layout duas colunas: 280px | 1fr ── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "280px 1fr" }}>

        {/* ════════════════════════
            COLUNA ESQUERDA — sticky
        ════════════════════════ */}
        <div className="space-y-4 sticky top-6 self-start">

          {/* Card Paciente */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal/10 font-mono text-sm font-medium text-teal select-none">
                  {iniciais(paciente.nome)}
                </div>
                <p className="font-serif text-[1.05rem] leading-tight text-brand-black truncate">
                  {paciente.nome}
                </p>
              </div>

              {paciente.telefone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-brand-muted shrink-0" />
                  <span className="font-mono text-sm text-brand-muted">{paciente.telefone}</span>
                </div>
              )}

              {paciente.whatsapp && (
                <div className="flex items-center gap-2">
                  <MessageCircle size={13} className="text-teal shrink-0" />
                  <a
                    href={`https://wa.me/55${paciente.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-teal hover:underline"
                  >
                    {paciente.whatsapp}
                  </a>
                </div>
              )}

              <Link href={`/dashboard/pacientes/${paciente.id}`}>
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  Ver perfil completo
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════
            COLUNA DIREITA — Tabs
        ════════════════════════ */}
        <div>
          <Tabs value={activeTab} onValueChange={(tab) => {
            setActiveTab(tab);
            if (tab === "orcamento") void handleAbrirAbaOrcamento();
          }}>
            <TabsList className="bg-transparent border-b border-brand-border rounded-none w-full justify-start gap-0 h-auto p-0 mb-4">
              {(["ficha", "planejamento", "orcamento"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="font-sans text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-teal data-[state=active]:text-teal data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-brand-muted hover:text-brand-black transition-colors"
                >
                  {tab === "ficha" ? "Ficha" : tab === "planejamento" ? "Planejamento" : "Orçamento"}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ══════════════════════════════
                TAB: FICHA
            ══════════════════════════════ */}
            <TabsContent value="ficha" className="mt-0">
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>

                {/* ── COLUNA ESQUERDA: Anamnese ── */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="pt-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionLabel>Anamnese</SectionLabel>
                        {salvandoAnamnese && (
                          <span className="font-mono text-xs text-brand-muted">✓ Salvo</span>
                        )}
                      </div>

                      {/* Queixa principal */}
                      <div className="space-y-1.5">
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                          Queixa Principal
                        </p>
                        <Textarea
                          value={queixaPrincipal}
                          onChange={(e) =>
                            handleAnamneseChange("queixa_principal", e.target.value, setQueixaPrincipal)
                          }
                          placeholder="Descreva a queixa principal do paciente..."
                          className="font-sans text-sm resize-none min-h-[80px] border-brand-border bg-brand-bg focus:border-teal rounded p-3"
                        />
                      </div>

                      {/* Histórico dental + médico */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                            Histórico Dental
                          </p>
                          <Textarea
                            value={historicoDental}
                            onChange={(e) =>
                              handleAnamneseChange("historico_dental", e.target.value, setHistoricoDental)
                            }
                            placeholder="Tratamentos anteriores, problemas recorrentes..."
                            className="font-sans text-sm resize-none min-h-[90px] border-brand-border bg-brand-bg focus:border-teal rounded p-3"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                            Histórico Médico
                          </p>
                          <Textarea
                            value={historicoMedico}
                            onChange={(e) =>
                              handleAnamneseChange("historico_medico", e.target.value, setHistoricoMedico)
                            }
                            placeholder="Doenças, cirurgias, condições crônicas..."
                            className="font-sans text-sm resize-none min-h-[90px] border-brand-border bg-brand-bg focus:border-teal rounded p-3"
                          />
                        </div>
                      </div>

                      {/* Anotações + Gravar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                              Anotações
                            </p>
                            {salvandoAnotacoes && (
                              <span className="font-mono text-xs text-brand-muted">✓ Salvo</span>
                            )}
                          </div>
                          {estaProcessandoAudio ? (
                            <div className="flex items-center gap-2 rounded border border-brand-border bg-brand-bg px-3 py-1.5">
                              <Waveform />
                              <span className="font-mono text-xs text-brand-muted">Transcrevendo...</span>
                            </div>
                          ) : estaGravando ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1.5 animate-record-pulse"
                              onClick={handlePararGravacao}
                            >
                              <Square size={13} />
                              Parar
                              <span className="font-mono ml-0.5">{formatarTimer(timer)}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={startRecording}
                            >
                              <Mic size={14} />
                              Gravar
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={anotacoes}
                          onChange={(e) => handleAnotacoesChange(e.target.value)}
                          placeholder="Anote os procedimentos, observações e o que o paciente relatou. Você também pode gravar sua voz."
                          className="font-sans text-sm resize-none min-h-[120px] border-brand-border bg-brand-bg focus:border-teal rounded p-3"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ── COLUNA DIREITA: Odontograma + Anexos ── */}
                <div className="space-y-4">
                  <div className="sticky top-6 self-start space-y-4">
                    <Card>
                      <CardContent className="pt-5 space-y-4">
                        <SectionLabel>Odontograma</SectionLabel>

                        {/* Arcada Superior */}
                        <div className="space-y-2">
                          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-brand-muted text-center">
                            Arcada Superior
                          </p>
                          <div className="flex justify-center gap-1 flex-wrap">
                            {["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"].map((dente) => (
                              <button
                                key={dente}
                                onClick={() => toggleDente(dente)}
                                className={`flex size-8 items-center justify-center rounded text-xs font-mono font-medium transition-colors border ${
                                  dentesSelecionados.includes(dente)
                                    ? "bg-teal text-white border-teal"
                                    : "bg-brand-bg text-brand-muted border-brand-border hover:border-teal/50 hover:text-brand-black"
                                }`}
                              >
                                {dente}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Separador */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-brand-border" />
                          <span className="font-mono text-[0.6rem] text-brand-muted">↑ sup · inf ↓</span>
                          <div className="flex-1 h-px bg-brand-border" />
                        </div>

                        {/* Arcada Inferior */}
                        <div className="space-y-2">
                          <div className="flex justify-center gap-1 flex-wrap">
                            {["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"].map((dente) => (
                              <button
                                key={dente}
                                onClick={() => toggleDente(dente)}
                                className={`flex size-8 items-center justify-center rounded text-xs font-mono font-medium transition-colors border ${
                                  dentesSelecionados.includes(dente)
                                    ? "bg-teal text-white border-teal"
                                    : "bg-brand-bg text-brand-muted border-brand-border hover:border-teal/50 hover:text-brand-black"
                                }`}
                              >
                                {dente}
                              </button>
                            ))}
                          </div>
                          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-brand-muted text-center">
                            Arcada Inferior
                          </p>
                        </div>

                        {/* Dentes selecionados */}
                        {dentesSelecionados.length > 0 && (
                          <div className="space-y-2 pt-1 border-t border-brand-border">
                            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                              Dentes Afetados
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {[...dentesSelecionados].sort((a, b) => Number(a) - Number(b)).map((dente) => (
                                <span
                                  key={dente}
                                  className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 font-mono text-xs text-teal"
                                >
                                  Dente {dente}
                                  <button
                                    onClick={() => toggleDente(dente)}
                                    className="ml-0.5 text-teal/60 hover:text-teal transition-colors"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {dentesSelecionados.length === 0 && (
                          <p className="font-sans text-xs text-brand-muted text-center py-2">
                            Clique nos dentes para selecionar
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Anexos */}
                    <Card>
                      <CardContent className="pt-5 space-y-3">
                        <SectionLabel>Anexos</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => document.getElementById(docInputId)?.click()}
                            disabled={uploadandoDoc}
                          >
                            {uploadandoDoc ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            {uploadandoDoc ? "Processando..." : "Documento"}
                          </Button>
                          <input
                            id={docInputId}
                            type="file"
                            multiple
                            accept=".doc,.docx,.pdf,.txt,.pptx"
                            className="hidden"
                            onChange={handleDocInputChange}
                            disabled={uploadandoDoc}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => document.getElementById(fotoInputId)?.click()}
                            disabled={uploadandoFoto}
                          >
                            {uploadandoFoto ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                            {uploadandoFoto ? "Enviando..." : "Foto da ficha"}
                          </Button>
                          <input
                            id={fotoInputId}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleUploadFoto}
                            disabled={uploadandoFoto}
                          />
                        </div>

                        {documentos.length > 0 && (
                          <div className="space-y-1.5">
                            {documentos.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center gap-3 rounded border border-brand-border bg-brand-bg px-3 py-2"
                              >
                                <FileText className="size-4 text-brand-muted shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-sm text-brand-black truncate">{doc.nome_original}</p>
                                </div>
                                <button
                                  className="flex size-7 items-center justify-center rounded text-brand-muted hover:text-red-500 transition-colors"
                                  onClick={() => handleRemoverDocumento(doc)}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {fotosficha.length > 0 && (
                          <div className="space-y-2">
                            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                              Fotos da ficha ({fotosficha.length})
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                              {fotosficha.map((foto, idx) => (
                                <div
                                  key={foto.id}
                                  className="group relative overflow-hidden rounded border border-brand-border bg-brand-bg aspect-square cursor-pointer"
                                  onClick={() => { setFotoLightboxIndex(idx); setFotoLightboxOpen(true); }}
                                >
                                  {signedUrls[foto.id] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={signedUrls[foto.id]}
                                      alt={foto.nome_original}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <ImageIcon className="size-5 text-brand-muted/30" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <ZoomIn size={16} className="text-white" />
                                  </div>
                                  <button
                                    className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); handleRemoverFoto(foto); }}
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

              </div>
            </TabsContent>

            {/* ══════════════════════════════
                TAB: PLANEJAMENTO
            ═════════════════��════════════ */}
            <TabsContent value="planejamento" className="mt-0 space-y-4">

              {/* ── Etapas do Procedimento ── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <SectionLabel>Etapas do Procedimento</SectionLabel>
                    {!novaEtapaOpen && !editandoEtapaId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={iniciarNovaEtapa}
                      >
                        <Plus size={13} />
                        Nova Etapa
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">

                  {/* Formulário: nova etapa */}
                  {novaEtapaOpen && (
                    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 space-y-3">
                      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-teal">
                        Nova Etapa
                      </p>
                      {EtapaFormFields()}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAdicionarEtapa} disabled={salvandoEtapa}>
                          {salvandoEtapa && <Loader2 size={12} className="animate-spin" />}
                          {salvandoEtapa ? "Adicionando..." : "Adicionar"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelarEdicaoEtapa}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Vazio */}
                  {etapas.length === 0 && !novaEtapaOpen && (
                    <div className="flex h-24 items-center justify-center rounded border-2 border-dashed border-brand-border">
                      <p className="font-sans text-sm text-brand-muted">
                        Nenhuma etapa adicionada ainda
                      </p>
                    </div>
                  )}

                  {/* Lista de etapas */}
                  {etapas.map((etapa, idx) => (
                    <div key={etapa.id}>
                      {/* Modo edição */}
                      {editandoEtapaId === etapa.id ? (
                        <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 space-y-3">
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-teal">
                            Editando Etapa {idx + 1}
                          </p>
                          {EtapaFormFields()}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleAtualizarEtapa} disabled={salvandoEtapa}>
                              {salvandoEtapa && <Loader2 size={12} className="animate-spin" />}
                              {salvandoEtapa ? "Salvando..." : "Salvar"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelarEdicaoEtapa}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Modo visualização */
                        <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
                          <div className="flex items-start gap-3">
                            {/* Número */}
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-surface font-mono text-xs text-brand-muted mt-0.5">
                              {idx + 1}
                            </span>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Status + dentes */}
                              <div className="flex items-center flex-wrap gap-2">
                                <div
                                  title="Clique para alterar o status"
                                  className={`relative inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-medium cursor-pointer ${etapaStatusClassName((etapa.status as EtapaStatus) ?? "aberto")}`}
                                >
                                  {ETAPA_STATUS_LABEL[(etapa.status as EtapaStatus) ?? "aberto"]}
                                  <select
                                    value={(etapa.status as EtapaStatus) ?? "aberto"}
                                    onChange={(e) => void handleSetStatus(etapa, e.target.value as EtapaStatus)}
                                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <option value="aberto">Aberto</option>
                                    <option value="pendente">Pendente</option>
                                    <option value="concluido">Concluído</option>
                                  </select>
                                </div>
                                {(etapa.dentes ?? []).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {[...(etapa.dentes ?? [])]
                                      .sort((a, b) => Number(a) - Number(b))
                                      .map((d) => (
                                        <span
                                          key={d}
                                          className="inline-flex items-center rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[0.65rem] text-teal"
                                        >
                                          {d}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>

                              {/* Título */}
                              <p className="font-sans text-sm font-medium text-brand-black">
                                {etapa.titulo}
                              </p>

                              {/* Observação */}
                              {etapa.descricao_simples && (
                                <p className="font-sans text-xs text-brand-muted">
                                  {etapa.descricao_simples}
                                </p>
                              )}

                              {/* Imagem vinculada */}
                              {etapa.imagem_arquivo_id && (
                                <div className="flex items-center gap-1.5">
                                  <ImageIcon size={11} className="text-brand-muted" />
                                  <span className="font-mono text-[0.65rem] text-brand-muted">
                                    {arquivos.find((a) => a.id === etapa.imagem_arquivo_id)?.nome_original ?? "Imagem vinculada"}
                                  </span>
                                  <button
                                    className="text-brand-muted/50 hover:text-red-400 transition-colors"
                                    onClick={() => handleVincularImagem(etapa.id, null)}
                                    title="Desvincular imagem"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Ações */}
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Vincular radiografia */}
                              {vinculandoEtapaId === etapa.id ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    className="text-xs border border-brand-border rounded px-1.5 py-1 bg-white font-sans"
                                    defaultValue={etapa.imagem_arquivo_id ?? ""}
                                    onChange={(e) =>
                                      handleVincularImagem(etapa.id, e.target.value || null)
                                    }
                                    autoFocus
                                  >
                                    <option value="">Sem imagem</option>
                                    {radiografias.map((rx) => (
                                      <option key={rx.id} value={rx.id}>
                                        {rx.nome_original}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="text-brand-muted hover:text-brand-black"
                                    onClick={() => setVinculandoEtapaId(null)}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                radiografias.length > 0 && (
                                  <button
                                    className="flex size-7 items-center justify-center rounded text-brand-muted hover:text-teal transition-colors"
                                    onClick={() => setVinculandoEtapaId(etapa.id)}
                                    title="Vincular radiografia"
                                  >
                                    <ImageIcon size={13} />
                                  </button>
                                )
                              )}
                              <button
                                className="flex size-7 items-center justify-center rounded text-brand-muted hover:text-brand-black transition-colors"
                                onClick={() => iniciarEdicaoEtapa(etapa)}
                                title="Editar"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                className="flex size-7 items-center justify-center rounded text-brand-muted hover:text-red-500 transition-colors"
                                onClick={() => handleRemoverEtapa(etapa.id)}
                                title="Remover"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* ── Radiografias ── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <SectionLabel>Radiografias</SectionLabel>
                    <div className="flex items-center gap-2">
                      {etapas.length > 0 && radiografias.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => { setApresentacaoIndex(0); setApresentacaoOpen(true); }}
                        >
                          <Presentation size={13} />
                          Apresentar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => document.getElementById(rxInputId)?.click()}
                      >
                        {uploadandoRx ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        Adicionar
                      </Button>
                      <input
                        id={rxInputId}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,.pdf"
                        className="hidden"
                        onChange={handleUploadRx}
                        disabled={uploadandoRx}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {radiografias.length === 0 ? (
                    <div className="flex h-28 items-center justify-center rounded border-2 border-dashed border-brand-border font-sans text-sm text-brand-muted">
                      Nenhuma radiografia adicionada ainda
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {radiografias.map((rx, idx) => (
                        <div
                          key={rx.id}
                          className="group relative overflow-hidden rounded border border-brand-border bg-brand-bg"
                        >
                          {signedUrls[rx.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={signedUrls[rx.id]}
                              alt={rx.nome_original}
                              className="h-36 w-full object-cover cursor-pointer"
                              onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                            />
                          ) : (
                            <div
                              className="flex h-36 cursor-pointer items-center justify-center bg-brand-surface"
                              onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                            >
                              <ImageIcon className="size-8 text-brand-muted/30" />
                            </div>
                          )}

                          {/* Overlay hover */}
                          <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                            <div className="flex justify-end">
                              <button
                                className="flex size-6 items-center justify-center rounded-full bg-white/90 text-red-500 hover:bg-red-50"
                                onClick={() => handleRemoverRx(rx)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                className="flex flex-1 items-center justify-center gap-1 rounded bg-white/90 px-1 py-1.5 text-xs font-medium text-brand-black hover:bg-white"
                                onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                              >
                                <ZoomIn size={11} /> Ampliar
                              </button>
                            </div>
                          </div>

                          <p className="truncate px-2 py-1.5 font-mono text-xs text-brand-muted">
                            {rx.nome_original}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ══════════════════════════════
                TAB: ORÇAMENTO
            ══════════════════════════════ */}
            <TabsContent value="orcamento" className="mt-0">
              {etapas.length > 0 ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <SectionLabel>Orçamento</SectionLabel>
                      <div className="flex items-center gap-3">
                        {/* Status do orçamento — clicável */}
                        {orcamento && (
                          <div className="relative inline-flex" title="Clique para alterar o status">
                            <Badge variant={ORC_STATUS_VARIANT[orcamento.status as OrcamentoStatus] ?? "gray"}>
                              {ORC_STATUS_LABEL[orcamento.status as OrcamentoStatus] ?? orcamento.status}
                            </Badge>
                            <select
                              value={orcamento.status}
                              onChange={(e) => void handleStatusOrcamento(e.target.value as OrcamentoStatus)}
                              className="absolute inset-0 w-full opacity-0 cursor-pointer"
                            >
                              <option value="rascunho">Rascunho</option>
                              <option value="enviado">Enviado</option>
                              <option value="aprovado">Aprovado</option>
                              <option value="recusado">Recusado</option>
                            </select>
                          </div>
                        )}
                        <p className="font-mono text-xs text-brand-muted">
                          {etapas.length} etapa{etapas.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Cabeçalho */}
                    <div
                      className="grid font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted px-3 pb-1"
                      style={{ gridTemplateColumns: "1fr 100px 140px 110px" }}
                    >
                      <span>Procedimento</span>
                      <span>Status</span>
                      <span>Dentes</span>
                      <span className="text-right">Valor (R$)</span>
                    </div>
                    {/* Itens */}
                    {etapas.map((etapa) => (
                      <OrcamentoItemRow
                        key={etapa.id}
                        etapa={etapa}
                        item={orcamentoItens.find((i) => i.etapa_id === etapa.id)}
                        onStatusChange={handleSetStatus}
                        onPrecoSalvo={handlePrecoSalvo}
                      />
                    ))}
                    {/* Total */}
                    <div className="flex items-center justify-between pt-3 border-t border-brand-border">
                      <p className="font-mono text-xs text-brand-muted">
                        {orcamentoItens.some((i) => i.preco_total == null)
                          ? "Preencha os valores para calcular o total"
                          : "Total calculado automaticamente"}
                      </p>
                      <p className="font-mono text-sm font-semibold text-brand-black">
                        {orcamento?.total != null
                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orcamento.total)
                          : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <Receipt size={40} className="text-brand-muted/30" />
                    <p className="font-serif text-lg text-brand-black">
                      Nenhum orçamento gerado
                    </p>
                    <p className="font-sans text-sm text-brand-muted max-w-xs">
                      Adicione etapas no Planejamento para gerar um orçamento automaticamente
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => setActiveTab("planejamento")}
                    >
                      Ir para Planejamento
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          LIGHTBOX — FOTOS DA FICHA
      ════════════════════════════════════════════════════════════ */}
      {fotoLightboxOpen && fotosficha[fotoLightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoLightboxOpen(false)}
        >
          <div
            className="relative max-h-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -right-3 -top-3 z-10 flex size-7 items-center justify-center rounded-full bg-white text-brand-black shadow"
              onClick={() => setFotoLightboxOpen(false)}
            >
              <X size={14} />
            </button>

            {signedUrls[fotosficha[fotoLightboxIndex].id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls[fotosficha[fotoLightboxIndex].id]}
                alt={fotosficha[fotoLightboxIndex].nome_original}
                className="max-h-[88vh] max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex h-64 w-96 items-center justify-center rounded bg-zinc-800">
                <ImageIcon className="size-12 text-zinc-500" />
              </div>
            )}

            <p className="mt-2 text-center font-mono text-xs text-white/50">
              {fotosficha[fotoLightboxIndex].nome_original}
              {" "}·{" "}
              {fotoLightboxIndex + 1} / {fotosficha.length}
            </p>

            {fotosficha.length > 1 && (
              <>
                <button
                  className="absolute -left-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                  onClick={() => setFotoLightboxIndex((i) => (i > 0 ? i - 1 : fotosficha.length - 1))}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="absolute -right-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                  onClick={() => setFotoLightboxIndex((i) => (i < fotosficha.length - 1 ? i + 1 : 0))}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          LIGHTBOX — RADIOGRAFIAS
      ════════════════════════════════════════════════════════════ */}
      {lightboxOpen && radiografias[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-h-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -right-3 -top-3 z-10 flex size-7 items-center justify-center rounded-full bg-white text-brand-black shadow"
              onClick={() => setLightboxOpen(false)}
            >
              <X size={14} />
            </button>

            {signedUrls[radiografias[lightboxIndex].id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedUrls[radiografias[lightboxIndex].id]}
                alt={radiografias[lightboxIndex].nome_original}
                className="max-h-[90vh] max-w-full rounded object-contain"
              />
            ) : (
              <div className="flex h-64 w-96 items-center justify-center rounded bg-zinc-800">
                <ImageIcon className="size-12 text-zinc-500" />
              </div>
            )}

            <p className="mt-2 text-center font-mono text-xs text-white/50">
              {radiografias[lightboxIndex].nome_original}
            </p>

            {radiografias.length > 1 && (
              <>
                <button
                  className="absolute -left-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                  onClick={lightboxAnterior}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="absolute -right-12 top-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                  onClick={lightboxProximo}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════���═════════════════════════════
          MODO APRESENTAÇÃO — por etapas, z-[9999] fullscreen
      ════════════════════════════════════════════════════════════ */}
      {apresentacaoOpen && etapas[apresentacaoIndex] && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          {/* Barra superior */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs text-white/30">
                Etapa {apresentacaoIndex + 1} / {etapas.length}
              </p>
              <p className="font-sans text-sm text-white/60">
                {etapas[apresentacaoIndex].titulo}
              </p>
            </div>
            <button
              className="flex size-8 items-center justify-center rounded text-white/60 hover:text-white transition-colors"
              onClick={() => setApresentacaoOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="flex flex-1 overflow-hidden">
            {/* Painel esquerdo: info da etapa */}
            <div className="flex flex-col justify-center px-12 py-8 w-80 shrink-0 border-r border-white/10 space-y-4">
              <p className="font-mono text-[0.6rem] uppercase tracking-widest text-white/30">
                Etapa {apresentacaoIndex + 1}
              </p>
              <p className="font-serif text-xl text-white leading-snug">
                {etapas[apresentacaoIndex].titulo}
              </p>

              {(etapas[apresentacaoIndex].dentes ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...(etapas[apresentacaoIndex].dentes ?? [])]
                    .sort((a, b) => Number(a) - Number(b))
                    .map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-teal/20 px-2.5 py-0.5 font-mono text-xs text-teal"
                      >
                        Dente {d}
                      </span>
                    ))}
                </div>
              )}

              {etapas[apresentacaoIndex].descricao_simples && (
                <p className="font-sans text-sm text-white/50">
                  {etapas[apresentacaoIndex].descricao_simples}
                </p>
              )}

              <span
                className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-mono text-xs ${
                  (etapas[apresentacaoIndex].status as EtapaStatus) === "concluido"
                    ? "bg-green-500/20 text-green-400"
                    : (etapas[apresentacaoIndex].status as EtapaStatus) === "pendente"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {ETAPA_STATUS_LABEL[(etapas[apresentacaoIndex].status as EtapaStatus) ?? "aberto"]}
              </span>
            </div>

            {/* Painel direito: imagem */}
            <div className="flex flex-1 items-center justify-center p-8">
              {etapas[apresentacaoIndex].imagem_arquivo_id &&
              signedUrls[etapas[apresentacaoIndex].imagem_arquivo_id!] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrls[etapas[apresentacaoIndex].imagem_arquivo_id!]}
                  alt={etapas[apresentacaoIndex].titulo}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <ImageIcon className="size-16 text-white/10" />
                  <p className="font-mono text-xs text-white/20">Sem imagem vinculada</p>
                </div>
              )}
            </div>
          </div>

          {/* Navegação lateral */}
          {etapas.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                onClick={apresentacaoAnterior}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                onClick={apresentacaoProximo}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Dots de navegação */}
          <div className="flex items-center justify-center gap-2 py-4">
            {etapas.map((_, i) => (
              <button
                key={i}
                className={`rounded-full transition-all ${
                  i === apresentacaoIndex
                    ? "size-2.5 bg-white"
                    : "size-1.5 bg-white/30 hover:bg-white/50"
                }`}
                onClick={() => setApresentacaoIndex(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
