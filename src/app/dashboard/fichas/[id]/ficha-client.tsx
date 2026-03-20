"use client";

import { useState, useCallback, useRef, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  generateBudgetFromPlanning,
  getProcedimentosClinica,
  updateEtapaProcedimento,
  type ProcedimentoClinica,
} from "./actions";
import { FichaHeader } from "./_components/ficha-header";
import {
  iniciais,
  type EtapaForm,
  type EtapaStatus,
  type OrcamentoStatus,
} from "./_components/ficha-helpers";
import { FichaSidebar } from "./_components/ficha-sidebar";
import { Lightbox } from "./_components/lightbox";
import { ModoApresentacao } from "./_components/modo-apresentacao";
import { TabFicha } from "./_components/tab-ficha";
import { TabOrcamento } from "./_components/tab-orcamento";
import { TabPlanejamento } from "./_components/tab-planejamento";
import type {
  Dentista,
  Ficha,
  FichaArquivo,
  Orcamento,
  OrcamentoItem,
  Paciente,
  Planejamento,
  PlanejamentoEtapa,
} from "@/types/database";

function separador(fonte: string): string {
  return `\n\n--- [${fonte}] ---\n`;
}

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
  const router = useRouter();
  const docInputId = useId();
  const rxInputId = useId();
  const fotoInputId = useId();

  const [ficha, setFicha] = useState(fichaInicial);
  const [anotacoes, setAnotacoes] = useState(fichaInicial.anotacoes ?? "");
  const [arquivos, setArquivos] = useState<FichaArquivo[]>(arquivosIniciais);
  const [activeTab, setActiveTab] = useState("ficha");

  const [queixaPrincipal, setQueixaPrincipal] = useState(fichaInicial.queixa_principal ?? "");
  const [historicoDental, setHistoricoDental] = useState(fichaInicial.historico_dental ?? "");
  const [historicoMedico, setHistoricoMedico] = useState(fichaInicial.historico_medico ?? "");
  const [salvandoAnamnese, setSalvandoAnamnese] = useState(false);

  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>(
    fichaInicial.dentes_afetados ?? []
  );
  const anamneseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const odontogramaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [procedimentos, setProcedimentos] = useState<ProcedimentoClinica[]>([]);

  const [planejamento, setPlanejamento] = useState<Planejamento | null>(planejamentoInicial);
  const [etapas, setEtapas] = useState<PlanejamentoEtapa[]>(etapasIniciais);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);

  const [orcamento, setOrcamento] = useState<Orcamento | null>(orcamentoInicial);
  const [orcamentoItens, setOrcamentoItens] = useState<OrcamentoItem[]>(orcamentoItensIniciais);
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null);
  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [etapaForm, setEtapaForm] = useState<EtapaForm>({
    titulo: "",
    dentes: [],
    observacao: "",
    procedimento_id: null,
  });
  const [vinculandoEtapaId, setVinculandoEtapaId] = useState<string | null>(null);

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false);
  const [processandoTranscricao, setProcessandoTranscricao] = useState(false);
  const [uploadandoDoc, setUploadandoDoc] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const [uploadandoRx, setUploadandoRx] = useState(false);
  const [concluindoFicha, setConcluindoFicha] = useState(false);
  const [gerandoOrcamento, setGerandoOrcamento] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [fotoLightboxOpen, setFotoLightboxOpen] = useState(false);
  const [fotoLightboxIndex, setFotoLightboxIndex] = useState(0);

  const [apresentacaoOpen, setApresentacaoOpen] = useState(false);
  const [apresentacaoIndex, setApresentacaoIndex] = useState(0);

  const anotacoesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status: recorderStatus, timer, startRecording, stopRecording } =
    useAudioRecorder();

  const documentos = arquivos.filter((arquivo) => arquivo.tipo === "documento");
  const fotosficha = arquivos.filter((arquivo) => arquivo.tipo === "foto_ficha");
  const radiografias = arquivos.filter((arquivo) => arquivo.tipo === "radiografia");
  const arquivoNomeById = arquivos.reduce<Record<string, string>>((acc, arquivo) => {
    acc[arquivo.id] = arquivo.nome_original;
    return acc;
  }, {});

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

  useEffect(() => {
    arquivos
      .filter((arquivo) => arquivo.tipo === "foto_ficha" || arquivo.tipo === "radiografia")
      .forEach((arquivo) => carregarSignedUrl(arquivo));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega procedimentos da clínica para o select do planejamento
  useEffect(() => {
    getProcedimentosClinica().then(setProcedimentos).catch(() => {
      // Silencia erros — select ficará vazio, dentista usa modo manual
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleAnotacoesChange(valor: string): void {
    setAnotacoes(valor);
    if (anotacoesTimerRef.current) clearTimeout(anotacoesTimerRef.current);
    anotacoesTimerRef.current = setTimeout(async () => {
      setSalvandoAnotacoes(true);
      await supabase.from("fichas").update({ anotacoes: valor }).eq("id", ficha.id);
      setSalvandoAnotacoes(false);
    }, 2000);
  }

  function handleAnamneseChange(
    campo: string,
    valor: string,
    setter: (valorAtualizado: string) => void
  ): void {
    setter(valor);
    if (anamneseTimerRef.current) clearTimeout(anamneseTimerRef.current);
    anamneseTimerRef.current = setTimeout(async () => {
      setSalvandoAnamnese(true);
      await supabase.from("fichas").update({ [campo]: valor }).eq("id", ficha.id);
      setSalvandoAnamnese(false);
    }, 2000);
  }

  function toggleDente(dente: string): void {
    const novos = dentesSelecionados.includes(dente)
      ? dentesSelecionados.filter((atual) => atual !== dente)
      : [...dentesSelecionados, dente];

    setDentesSelecionados(novos);
    if (odontogramaTimerRef.current) clearTimeout(odontogramaTimerRef.current);
    odontogramaTimerRef.current = setTimeout(async () => {
      await supabase.from("fichas").update({ dentes_afetados: novos }).eq("id", ficha.id);
    }, 500);
  }

  async function handleAlterarStatusFicha(
    novoStatus: "aberta" | "concluida"
  ): Promise<void> {
    if (ficha.status === novoStatus) return;
    setConcluindoFicha(true);

    try {
      const { error } = await supabase
        .from("fichas")
        .update({ status: novoStatus })
        .eq("id", ficha.id);

      if (error) {
        toast.error("Erro ao alterar status da ficha.");
        return;
      }

      setFicha((fichaAtual) => ({ ...fichaAtual, status: novoStatus }));
      toast.success(novoStatus === "concluida" ? "Ficha concluída!" : "Ficha reaberta!");
    } catch {
      toast.error("Erro inesperado ao alterar status.");
    } finally {
      setConcluindoFicha(false);
    }
  }

  const handlePararGravacao = useCallback(async (): Promise<void> => {
    const blob = await stopRecording();
    if (!blob) {
      toast.error("Nenhum áudio gravado.");
      return;
    }

    setProcessandoTranscricao(true);
    try {
      const timestamp = Date.now();
      const audioPath = `${clinicaId}/${ficha.id}/${timestamp}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("audios")
        .upload(audioPath, blob, { contentType: "audio/webm" });

      if (uploadError) {
        toast.error("Erro ao fazer upload do áudio.");
        return;
      }

      await supabase.from("fichas").update({ audio_url: audioPath }).eq("id", ficha.id);

      const response = await fetch("/api/transcricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ficha_id: ficha.id, audio_url: audioPath }),
      });

      if (!response.ok) {
        toast.error("Erro ao transcrever áudio.");
        return;
      }

      const { transcricao: texto } = (await response.json()) as { transcricao: string };
      const novoTexto = anotacoes
        ? anotacoes + separador("Gravação de voz") + texto
        : `--- [Gravação de voz] ---\n${texto}`;

      handleAnotacoesChange(novoTexto);
      setFicha((fichaAtual) => ({ ...fichaAtual, audio_url: audioPath }));
      toast.success("Áudio transcrito e incluído nas anotações!");
    } catch {
      toast.error("Erro ao processar a gravação.");
    } finally {
      setProcessandoTranscricao(false);
    }
  }, [stopRecording, supabase, ficha.id, clinicaId, anotacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function processarArquivosDocumento(files: FileList | File[]): Promise<void> {
    const lista = Array.from(files);
    if (lista.length === 0) return;

    const tiposPermitidos = ["doc", "docx", "pdf", "txt", "pptx"];
    for (const file of lista) {
      const extensao = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!tiposPermitidos.includes(extensao)) {
        toast.error(`Tipo não suportado: ${file.name}`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Muito grande (máx 20MB): ${file.name}`);
        return;
      }
    }

    setUploadandoDoc(true);
    try {
      for (const file of lista) {
        const timestamp = Date.now();
        const storagePath = `${clinicaId}/${ficha.id}/docs/${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(storagePath, file);

        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const response = await fetch("/api/processar-documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ficha_id: ficha.id,
            clinica_id: clinicaId,
            nome_original: file.name,
            storage_url: storagePath,
          }),
        });

        if (!response.ok) {
          toast.error(`Erro ao processar ${file.name}`);
          continue;
        }

        const { ficha_arquivo } = (await response.json()) as {
          ficha_arquivo: FichaArquivo;
          texto: string;
        };
        setArquivos((prev) => [...prev, ficha_arquivo]);
        toast.success(`${file.name} processado!`);
      }
    } catch {
      toast.error("Erro inesperado ao processar documentos.");
    } finally {
      setUploadandoDoc(false);
    }
  }

  function handleDocInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) processarArquivosDocumento(event.target.files);
    event.target.value = "";
  }

  async function handleRemoverDocumento(arquivo: FichaArquivo): Promise<void> {
    try {
      await supabase.storage.from("documentos").remove([arquivo.storage_url]);
      await supabase.from("ficha_arquivos").delete().eq("id", arquivo.id);
      setArquivos((prev) => prev.filter((atual) => atual.id !== arquivo.id));
      toast.success("Documento removido.");
    } catch {
      toast.error("Erro ao remover documento.");
    }
  }

  async function handleUploadFoto(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const extensao = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png", "webp"].includes(extensao)) {
      toast.error("Use jpg, png ou webp.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Máx 10MB.");
      return;
    }

    setUploadandoFoto(true);
    try {
      const timestamp = Date.now();
      const storagePath = `${clinicaId}/${ficha.id}/foto_${timestamp}.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from("fichas")
        .upload(storagePath, file);
      if (uploadError) {
        toast.error("Erro ao enviar foto.");
        return;
      }

      const { data: fichaArquivo, error: insertError } = await supabase
        .from("ficha_arquivos")
        .insert({
          ficha_id: ficha.id,
          clinica_id: clinicaId,
          tipo: "foto_ficha",
          nome_original: file.name,
          storage_url: storagePath,
          texto_extraido: null,
          processado: false,
        })
        .select()
        .single();

      if (insertError || !fichaArquivo) {
        toast.error("Erro ao registrar foto.");
        return;
      }

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
      setArquivos((prev) => prev.filter((atual) => atual.id !== arquivo.id));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[arquivo.id];
        return next;
      });
      toast.success("Foto removida.");
    } catch {
      toast.error("Erro ao remover foto.");
    }
  }

  async function handleUploadRx(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!event.target.files) return;
    const files = Array.from(event.target.files);
    event.target.value = "";

    const tiposPermitidos = ["jpg", "jpeg", "png", "webp", "pdf"];
    for (const file of files) {
      const extensao = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!tiposPermitidos.includes(extensao)) {
        toast.error(`Tipo não suportado: ${file.name}`);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Muito grande (máx 20MB): ${file.name}`);
        return;
      }
    }

    setUploadandoRx(true);
    try {
      for (const file of files) {
        const timestamp = Date.now();
        const extensao = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const storagePath = `${clinicaId}/${ficha.id}/rx_${timestamp}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("radiografias")
          .upload(storagePath, file);
        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: fichaArquivo, error: insertError } = await supabase
          .from("ficha_arquivos")
          .insert({
            ficha_id: ficha.id,
            clinica_id: clinicaId,
            tipo: "radiografia",
            nome_original: file.name,
            storage_url: storagePath,
            texto_extraido: null,
            processado: true,
          })
          .select()
          .single();

        if (insertError || !fichaArquivo) {
          toast.error(`Erro ao registrar ${file.name}`);
          continue;
        }

        const novaRx = fichaArquivo as FichaArquivo;
        setArquivos((prev) => [...prev, novaRx]);
        if (extensao !== "pdf") await carregarSignedUrl(novaRx);
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
      for (const etapa of etapas.filter((atual) => atual.imagem_arquivo_id === arquivo.id)) {
        await supabase
          .from("planejamento_etapas")
          .update({ imagem_arquivo_id: null })
          .eq("id", etapa.id);
      }

      setEtapas((prev) =>
        prev.map((etapa) =>
          etapa.imagem_arquivo_id === arquivo.id
            ? { ...etapa, imagem_arquivo_id: null }
            : etapa
        )
      );

      await supabase.storage.from("radiografias").remove([arquivo.storage_url]);
      await supabase.from("ficha_arquivos").delete().eq("id", arquivo.id);
      setArquivos((prev) => prev.filter((atual) => atual.id !== arquivo.id));
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[arquivo.id];
        return next;
      });
      toast.success("Radiografia removida.");
    } catch {
      toast.error("Erro ao remover radiografia.");
    }
  }

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

    if (error || !data) {
      toast.error("Erro ao criar planejamento.");
      return null;
    }

    const plano = data as Planejamento;
    setPlanejamento(plano);
    return plano;
  }

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

    if (error || !data) {
      toast.error("Erro ao criar orçamento.");
      return null;
    }

    const orc = data as Orcamento;
    setOrcamento(orc);
    return orc;
  }

  async function syncEtapasToItens(orc: Orcamento): Promise<void> {
    const etapasComItem = new Set(orcamentoItens.map((item) => item.etapa_id).filter(Boolean));
    const etapasSemItem = etapas.filter((etapa) => !etapasComItem.has(etapa.id));
    if (etapasSemItem.length === 0) return;

    const novosItens = etapasSemItem.map((etapa) => ({
      clinica_id: clinicaId,
      orcamento_id: orc.id,
      etapa_id: etapa.id,
      descricao: etapa.titulo,
      dente:
        (etapa.dentes ?? []).length > 0
          ? (etapa.dentes ?? []).sort((a, b) => Number(a) - Number(b)).join(", ")
          : null,
      quantidade: 1,
      preco_unitario: null,
      preco_total: null,
    }));

    const { data } = await supabase.from("orcamento_itens").insert(novosItens).select();
    if (data) setOrcamentoItens((prev) => [...prev, ...(data as OrcamentoItem[])]);
  }

  async function handleAbrirAbaOrcamento(): Promise<void> {
    const orc = await getOrCreateOrcamento();
    if (orc) await syncEtapasToItens(orc);
  }

  async function handlePrecoSalvo(
    _etapaId: string,
    itemId: string,
    preco: number | null
  ): Promise<void> {
    const precoTotal = preco;
    await supabase
      .from("orcamento_itens")
      .update({ preco_unitario: preco, preco_total: precoTotal })
      .eq("id", itemId);

    const novosItens = orcamentoItens.map((item) =>
      item.id === itemId ? { ...item, preco_unitario: preco, preco_total: precoTotal } : item
    );
    setOrcamentoItens(novosItens);

    if (orcamento) {
      const total = novosItens
        .filter((item) => item.preco_total != null)
        .reduce((acc, item) => acc + (item.preco_total ?? 0), 0);
      await supabase.from("orcamentos").update({ total }).eq("id", orcamento.id);
      setOrcamento((orcamentoAtual) =>
        orcamentoAtual ? { ...orcamentoAtual, total } : orcamentoAtual
      );
    }

  }

  async function handleStatusOrcamento(novoStatus: OrcamentoStatus): Promise<void> {
    if (!orcamento || orcamento.status === novoStatus) return;

    const { error } = await supabase
      .from("orcamentos")
      .update({ status: novoStatus })
      .eq("id", orcamento.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    setOrcamento((orcamentoAtual) =>
      orcamentoAtual ? { ...orcamentoAtual, status: novoStatus } : orcamentoAtual
    );
  }

  function iniciarNovaEtapa(): void {
    setNovaEtapaOpen(true);
    setEditandoEtapaId(null);
    setEtapaForm({ titulo: "", dentes: [...dentesSelecionados], observacao: "", procedimento_id: null });
  }

  function iniciarEdicaoEtapa(etapa: PlanejamentoEtapa): void {
    setEditandoEtapaId(etapa.id);
    setNovaEtapaOpen(false);
    setEtapaForm({
      titulo: etapa.titulo,
      dentes: etapa.dentes ?? [],
      observacao: etapa.descricao_simples ?? "",
      procedimento_id: etapa.procedimento_id ?? null,
    });
  }

  function cancelarEdicaoEtapa(): void {
    setNovaEtapaOpen(false);
    setEditandoEtapaId(null);
    setEtapaForm({ titulo: "", dentes: [], observacao: "", procedimento_id: null });
  }

  async function handleAdicionarEtapa(): Promise<void> {
    if (!etapaForm.titulo.trim()) {
      toast.error("Informe o procedimento.");
      return;
    }

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
          procedimento_id: etapaForm.procedimento_id ?? null,
        })
        .select()
        .single();

      if (error || !data) {
        toast.error("Erro ao adicionar etapa.");
        return;
      }

      const novaEtapa = data as PlanejamentoEtapa;
      setEtapas((prev) => [...prev, novaEtapa]);

      if (orcamento) {
        // Preenche preço automaticamente se a etapa tem procedimento vinculado
        const procVinculado = procedimentos.find((p) => p.id === etapaForm.procedimento_id);
        const precoAuto = procVinculado?.preco_padrao ?? null;

        const { data: itemData } = await supabase
          .from("orcamento_itens")
          .insert({
            clinica_id: clinicaId,
            orcamento_id: orcamento.id,
            etapa_id: novaEtapa.id,
            procedimento_id: novaEtapa.procedimento_id ?? null,
            descricao: novaEtapa.titulo,
            dente:
              (novaEtapa.dentes ?? []).length > 0
                ? (novaEtapa.dentes ?? []).sort((a, b) => Number(a) - Number(b)).join(", ")
                : null,
            quantidade: 1,
            preco_unitario: precoAuto,
            preco_total: precoAuto,
          })
          .select()
          .single();
        if (itemData) {
          const novoItem = itemData as OrcamentoItem;
          setOrcamentoItens((prev) => [...prev, novoItem]);

          // Recalcula total do orçamento se o preço foi preenchido automaticamente
          if (precoAuto != null) {
            const total = [...orcamentoItens, novoItem]
              .filter((i) => i.preco_total != null)
              .reduce((acc, i) => acc + (i.preco_total ?? 0), 0);
            await supabase.from("orcamentos").update({ total }).eq("id", orcamento.id);
            setOrcamento((prev) => (prev ? { ...prev, total } : prev));
          }
        }
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
          procedimento_id: etapaForm.procedimento_id ?? null,
        })
        .eq("id", editandoEtapaId);

      if (error) {
        toast.error("Erro ao atualizar etapa.");
        return;
      }

      setEtapas((prev) =>
        prev.map((etapa) =>
          etapa.id === editandoEtapaId
            ? {
                ...etapa,
                titulo: etapaForm.titulo.trim(),
                dentes: etapaForm.dentes,
                descricao_simples: etapaForm.observacao.trim() || null,
                procedimento_id: etapaForm.procedimento_id ?? null,
              }
            : etapa
        )
      );

      // Atualiza preço do item do orçamento se procedimento foi vinculado e item já existe
      if (orcamento) {
        const item = orcamentoItens.find((i) => i.etapa_id === editandoEtapaId);
        if (item) {
          const proc = procedimentos.find((p) => p.id === etapaForm.procedimento_id);
          if (proc) {
            await handlePrecoSalvo(editandoEtapaId, item.id, proc.preco_padrao ?? null);
          }
        }
      }

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
      if (error) {
        toast.error("Erro ao remover etapa.");
        return;
      }

      setEtapas((prev) => prev.filter((etapa) => etapa.id !== etapaId));
      const itensRestantes = orcamentoItens.filter((item) => item.etapa_id !== etapaId);
      setOrcamentoItens(itensRestantes);

      if (orcamento) {
        const total = itensRestantes
          .filter((item) => item.preco_total != null)
          .reduce((acc, item) => acc + (item.preco_total ?? 0), 0);
        await supabase.from("orcamentos").update({ total }).eq("id", orcamento.id);
        setOrcamento((orcamentoAtual) =>
          orcamentoAtual ? { ...orcamentoAtual, total } : orcamentoAtual
        );
      }

      toast.success("Etapa removida.");
    } catch {
      toast.error("Erro ao remover etapa.");
    }
  }

  async function handleSetStatus(
    etapa: PlanejamentoEtapa,
    novoStatus: EtapaStatus
  ): Promise<void> {
    try {
      await supabase
        .from("planejamento_etapas")
        .update({ status: novoStatus })
        .eq("id", etapa.id);
      setEtapas((prev) =>
        prev.map((atual) => (atual.id === etapa.id ? { ...atual, status: novoStatus } : atual))
      );
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  }

  async function handleVincularImagem(
    etapaId: string,
    arquivoId: string | null
  ): Promise<void> {
    try {
      await supabase
        .from("planejamento_etapas")
        .update({ imagem_arquivo_id: arquivoId })
        .eq("id", etapaId);
      setEtapas((prev) =>
        prev.map((etapa) =>
          etapa.id === etapaId ? { ...etapa, imagem_arquivo_id: arquivoId } : etapa
        )
      );
      setVinculandoEtapaId(null);
    } catch {
      toast.error("Erro ao vincular imagem.");
    }
  }

  function handleTituloEtapaChange(valor: string): void {
    setEtapaForm((prev) => ({ ...prev, titulo: valor }));
  }

  function handleObservacaoEtapaChange(valor: string): void {
    setEtapaForm((prev) => ({ ...prev, observacao: valor }));
  }

  function handleUsarSelecaoOdontograma(): void {
    setEtapaForm((prev) => ({ ...prev, dentes: [...dentesSelecionados] }));
  }

  function handleRemoverDenteEtapa(dente: string): void {
    setEtapaForm((prev) => ({
      ...prev,
      dentes: prev.dentes.filter((atual) => atual !== dente),
    }));
  }

  function apresentacaoAnterior(): void {
    setApresentacaoIndex((indexAtual) => (indexAtual > 0 ? indexAtual - 1 : etapas.length - 1));
  }

  function apresentacaoProximo(): void {
    setApresentacaoIndex((indexAtual) => (indexAtual < etapas.length - 1 ? indexAtual + 1 : 0));
  }

  async function handleProcedimentoSelecionado(proc: ProcedimentoClinica | null): Promise<void> {
    // Preenche título automaticamente ao selecionar procedimento cadastrado
    setEtapaForm((prev) => ({
      ...prev,
      titulo: proc ? proc.nome : prev.titulo,
      procedimento_id: proc ? proc.id : null,
    }));

    // Atualiza procedimento_id na etapa existente em tempo real (somente no modo edição)
    if (editandoEtapaId) {
      await updateEtapaProcedimento(editandoEtapaId, proc?.id ?? null);

      // Recalcula preço no item do orçamento correspondente, se existir
      if (orcamento) {
        const item = orcamentoItens.find((i) => i.etapa_id === editandoEtapaId);
        if (item) {
          await handlePrecoSalvo(editandoEtapaId, item.id, proc?.preco_padrao ?? null);
        }
      }
    }
  }

  function handleTabChange(tab: string): void {
    setActiveTab(tab);
    if (tab === "orcamento") void handleAbrirAbaOrcamento();
  }

  async function handleGerarOrcamento(): Promise<void> {
    if (etapas.length === 0) {
      toast.error("Adicione etapas no Planejamento antes de gerar o orçamento.");
      return;
    }
    setGerandoOrcamento(true);
    try {
      const result = await generateBudgetFromPlanning(ficha.id);
      if (!result.success || !result.orcamentoId) {
        toast.error(result.error ?? "Erro ao gerar orçamento.");
        return;
      }
      toast.success("Orçamento gerado com sucesso!");
      router.push(`/dashboard/orcamentos?id=${result.orcamentoId}`);
    } catch {
      toast.error("Erro inesperado ao gerar orçamento.");
    } finally {
      setGerandoOrcamento(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setApresentacaoOpen(false);
        setLightboxOpen(false);
        setFotoLightboxOpen(false);
      }

      if (apresentacaoOpen) {
        if (event.key === "ArrowLeft") apresentacaoAnterior();
        if (event.key === "ArrowRight") apresentacaoProximo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [apresentacaoOpen, etapas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-6">
      <FichaHeader
        pacienteId={paciente.id}
        pacienteNome={paciente.nome}
        dataFormatada={dataFormatada}
        status={ficha.status as "aberta" | "concluida"}
        concluindoFicha={concluindoFicha}
        onStatusChange={(status) => void handleAlterarStatusFicha(status)}
      />

      <div className="grid gap-6" style={{ gridTemplateColumns: "280px 1fr" }}>
        <FichaSidebar
          paciente={paciente}
          dentista={dentista}
          dataFormatada={dataFormatada}
          iniciaisPaciente={iniciais(paciente.nome)}
        />

        <div>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4 h-auto w-full justify-start gap-0 rounded-none border-b border-brand-border bg-transparent p-0">
              {(["ficha", "planejamento", "orcamento"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent px-4 py-2.5 font-sans text-sm text-brand-muted transition-colors hover:text-brand-black data-[state=active]:border-teal data-[state=active]:bg-transparent data-[state=active]:text-teal data-[state=active]:shadow-none"
                >
                  {tab === "ficha"
                    ? "Ficha"
                    : tab === "planejamento"
                      ? "Planejamento"
                      : "Orçamento"}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabFicha
              queixaPrincipal={queixaPrincipal}
              historicoDental={historicoDental}
              historicoMedico={historicoMedico}
              anotacoes={anotacoes}
              salvandoAnamnese={salvandoAnamnese}
              salvandoAnotacoes={salvandoAnotacoes}
              estaProcessandoAudio={estaProcessandoAudio}
              estaGravando={estaGravando}
              timerFormatado={formatarTimer(timer)}
              dentesSelecionados={dentesSelecionados}
              documentos={documentos}
              fotosficha={fotosficha}
              signedUrls={signedUrls}
              docInputId={docInputId}
              fotoInputId={fotoInputId}
              uploadandoDoc={uploadandoDoc}
              uploadandoFoto={uploadandoFoto}
              onQueixaPrincipalChange={(valor) =>
                handleAnamneseChange("queixa_principal", valor, setQueixaPrincipal)
              }
              onHistoricoDentalChange={(valor) =>
                handleAnamneseChange("historico_dental", valor, setHistoricoDental)
              }
              onHistoricoMedicoChange={(valor) =>
                handleAnamneseChange("historico_medico", valor, setHistoricoMedico)
              }
              onAnotacoesChange={handleAnotacoesChange}
              onStartRecording={() => void startRecording()}
              onStopRecording={() => void handlePararGravacao()}
              onToggleDente={toggleDente}
              onDocInputChange={handleDocInputChange}
              onUploadFoto={handleUploadFoto}
              onRemoverDocumento={(arquivo) => void handleRemoverDocumento(arquivo)}
              onOpenFotoLightbox={(index) => {
                setFotoLightboxIndex(index);
                setFotoLightboxOpen(true);
              }}
              onRemoverFoto={(arquivo) => void handleRemoverFoto(arquivo)}
            />

            <TabPlanejamento
              etapas={etapas}
              procedimentos={procedimentos}
              onProcedimentoChange={(proc) => void handleProcedimentoSelecionado(proc)}
              etapaForm={etapaForm}
              dentesSelecionados={dentesSelecionados}
              radiografias={radiografias}
              signedUrls={signedUrls}
              arquivoNomeById={arquivoNomeById}
              novaEtapaOpen={novaEtapaOpen}
              editandoEtapaId={editandoEtapaId}
              vinculandoEtapaId={vinculandoEtapaId}
              salvandoEtapa={salvandoEtapa}
              uploadandoRx={uploadandoRx}
              rxInputId={rxInputId}
              onIniciarNovaEtapa={iniciarNovaEtapa}
              onCancelarEdicao={cancelarEdicaoEtapa}
              onAdicionarEtapa={() => void handleAdicionarEtapa()}
              onAtualizarEtapa={() => void handleAtualizarEtapa()}
              onEditarEtapa={iniciarEdicaoEtapa}
              onRemoverEtapa={(etapaId) => void handleRemoverEtapa(etapaId)}
              onStatusEtapaChange={(etapa, status) => void handleSetStatus(etapa, status)}
              onVincularImagem={(etapaId, arquivoId) =>
                void handleVincularImagem(etapaId, arquivoId)
              }
              onAbrirVinculo={setVinculandoEtapaId}
              onFecharVinculo={() => setVinculandoEtapaId(null)}
              onTituloEtapaChange={handleTituloEtapaChange}
              onObservacaoEtapaChange={handleObservacaoEtapaChange}
              onUsarSelecaoOdontograma={handleUsarSelecaoOdontograma}
              onRemoverDenteEtapa={handleRemoverDenteEtapa}
              onUploadRx={handleUploadRx}
              onAbrirApresentacao={() => {
                setApresentacaoIndex(0);
                setApresentacaoOpen(true);
              }}
              onOpenLightbox={(index) => {
                setLightboxIndex(index);
                setLightboxOpen(true);
              }}
              onRemoverRx={(arquivo) => void handleRemoverRx(arquivo)}
            />

            <TabsContent value="orcamento" className="mt-0">
              {etapas.length > 0 && (
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    onClick={() => void handleGerarOrcamento()}
                    disabled={gerandoOrcamento}
                    className="flex items-center gap-2 h-9 px-4 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark disabled:opacity-50 transition-colors"
                  >
                    {gerandoOrcamento ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Gerar Orçamento Automático
                      </>
                    )}
                  </button>
                </div>
              )}
              <TabOrcamento
                etapas={etapas}
                orcamento={orcamento}
                orcamentoItens={orcamentoItens}
                onStatusOrcamento={(status) => void handleStatusOrcamento(status)}
                onStatusChange={handleSetStatus}
                onPrecoSalvo={handlePrecoSalvo}
                onIrParaPlanejamento={() => setActiveTab("planejamento")}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Lightbox
        open={fotoLightboxOpen}
        onClose={() => setFotoLightboxOpen(false)}
        items={fotosficha}
        index={fotoLightboxIndex}
        onIndexChange={setFotoLightboxIndex}
        signedUrls={signedUrls}
        maxWidth="max-w-4xl"
      />

      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        items={radiografias}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        signedUrls={signedUrls}
        maxWidth="max-w-5xl"
      />

      {apresentacaoOpen && (
        <ModoApresentacao
          etapas={etapas}
          index={apresentacaoIndex}
          signedUrls={signedUrls}
          onClose={() => setApresentacaoOpen(false)}
          onAnterior={apresentacaoAnterior}
          onProximo={apresentacaoProximo}
          onIndexChange={setApresentacaoIndex}
        />
      )}
    </div>
  );
}
