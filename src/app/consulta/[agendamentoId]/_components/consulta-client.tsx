'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Loader2,
  Check, Edit2, Mic, MicOff, Bot, X, AlertTriangle, PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useDexGuide } from '@/hooks/useDexGuide';
import { DexAvatar } from '@/components/ui/dex-avatar';
import { salvarFichaConsulta, iniciarAtendimentoConsulta } from '../actions';
import { ConsultaAssinaturaModal } from './consulta-assinatura-modal';
import { EmitirDocumentoModal } from '@/components/pacientes/EmitirDocumentoModal';
import { ApresentarPaciente } from '@/components/pacientes/ApresentarPaciente';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import type { FocoPrincipal } from '@/lib/persona';
import { ConsultationSidebar } from './consultation-sidebar';
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';
import { VoiceUX } from './voice-ux';
import { DraftPendingCard } from './draft-pending-card';
import { Odontograma } from '@/components/odontograma/Odontograma';
import { ToothDetailPanel } from '@/components/odontograma/ToothDetailPanel';
import { ToothGroupList } from './tooth-group-list';
import { TIPO_LABEL, type OdontogramaEventoDraft } from '@/types/odontograma';
import { ArchChips } from './arch-chips';
import { denteLabel, isArch } from '@/lib/arcadas';

// ── Types ────────────────────────────────────────────────────────────────────

interface Ficha {
  data: string;
  queixa: string;
  anotacoes: string;
  dentes: number[];
  procedimentos: string[];
}

interface Orcamento {
  total: number;
  status: string;
  itens: string[];
}

interface Paciente {
  id: string;
  nome: string;
  idadeStr: string | null;
  observacoes: string | null;
}

interface ConsultaClientProps {
  agendamentoId: string;
  clinicaId: string;
  isDemo?: boolean;
  /** Autor do registro clínico. Obrigatório: a ficha e as seções de planejamento
   *  nascem com este dono (migration 099). No demo é um dentista real — só o paciente
   *  é fictício, e o hook curto-circuita antes de escrever. */
  dentistaId: string;
  paciente: Paciente;
  hora: string;
  observacoesAgendamento: string | null;
  ultimaQueixa: string | null;
  ultimasAnotacoes: string | null;
  fichas: Ficha[];
  orcamentos: Orcamento[];
  agendamentoStatus: string;
  alertasClinicos: string[];
  procedimentosClinica: string[];
  planejamento: {
    id: string;
    titulo: string;
    etapas: { id: string; titulo: string; dente: string | null; descricao_simples: string | null; status: string; ordem: number }[];
  } | null;
  /** Demo dentro do onboarding (?from=onboarding) — troca o CTA final por "voltar pro plano". */
  retornoOnboarding?: boolean;
  /** Persona do dentista — calibra a recompensa pós-ficha (Workstream B1). */
  dentistaFoco?: FocoPrincipal | null;
  /** v3 — paciente já tem eventos de odontograma? Esconde o toggle "Exame inicial" (§Fluxo b). */
  temHistoricoOdontograma?: boolean;
}

/**
 * Fase única da consulta (fix do "flash preto", spec v3 Fatia A): sidebar E chave do
 * AnimatePresence derivam DESTE valor — nunca de booleanos soltos que se movem em
 * renders diferentes. 'organizando' compartilha o bloco visual da captura (overlay).
 */
type FaseConsulta = 'captura' | 'organizando' | 'confirmando' | 'salvo';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normaliza string para comparação: minúsculas, sem acentos, sem pontuação */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Verifica se um procedimento detectado pela IA existe no cadastro da clínica.
 * Usa match por palavras-chave significativas (>3 chars) para lidar com variações de nome.
 */
function procedimentoCadastrado(aiProc: string, clinicaProcs: string[]): boolean {
  if (clinicaProcs.length === 0) return true; // sem tabela cadastrada → não avisar
  const normAI = normalizar(aiProc);
  const palavrasAI = normAI.split(/\s+/).filter(w => w.length > 3);
  return clinicaProcs.some(p => {
    const normClinica = normalizar(p);
    // Match direto ou por palavras-chave
    if (normClinica === normAI) return true;
    if (normClinica.includes(normAI) || normAI.includes(normClinica)) return true;
    return palavrasAI.some(w => normClinica.includes(w));
  });
}

// ── Component ────────────────────────────────────────────────────────────────

// Etapas do feedback progressivo do "Formatar com IA" — fora do componente para não recriar a cada render
const FORMATAR_ETAPAS = [
  { ms: 0,    label: 'Analisando queixa...' },
  { ms: 1800, label: 'Identificando dentes...' },
  { ms: 3800, label: 'Gerando conduta...' },
  { ms: 6500, label: 'Finalizando ficha...' },
] as const;

export function ConsultaClient({
  agendamentoId,
  clinicaId,
  isDemo = false,
  dentistaId,
  paciente,
  hora,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  orcamentos,
  agendamentoStatus,
  alertasClinicos,
  procedimentosClinica,
  planejamento,
  retornoOnboarding = false,
  dentistaFoco = null,
  temHistoricoOdontograma = false,
}: ConsultaClientProps) {
  const router = useRouter();
  const [fase, setFase] = useState<FaseConsulta>('captura');
  const [textoLivre, setTextoLivre] = useState('');
  const [formatLabel, setFormatLabel] = useState('Organizar com DEX');
  const formatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoFormatada | null>(null);
  // v3 — rascunho dos eventos do odontograma (a IA propõe; o dentista revisa por toque)
  const [eventosDraft, setEventosDraft] = useState<OdontogramaEventoDraft[]>([]);
  const [denteAberto, setDenteAberto] = useState<number | null>(null);
  const [exameInicial, setExameInicial] = useState(false);
  const [dataProcedimento, setDataProcedimento] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [isSaving, setIsSaving] = useState(false);
  const [savedFichaId, setSavedFichaId] = useState<string | null>(null);
  const isFormatando = fase === 'organizando';
  const [showSignature, setShowSignature] = useState(false);
  const [showEmitir, setShowEmitir] = useState(false);
  const [demoSignOpen, setDemoSignOpen] = useState(false); // assinatura mock da demo (K · spec 3.1/3.2)

  // Destino comum da demo estendida — perfil demo com a ficha + Apresentar (aha 2).
  // Carrega o contexto do onboarding pra o CTA do perfil voltar pro wizard (spec 3.1).
  const irParaPerfilDemo = () =>
    router.push(`/dashboard/pacientes/demo?from=demo${retornoOnboarding ? '&onboarding=1' : ''}`);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aptStatus, setAptStatus] = useState(agendamentoStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  // v3 (unificação 18/07): o dente entra na ficha se tem >=1 evento revisado no
  // odontograma — o painel É a confirmação. Sentinelas de arcada/boca (97/98/99)
  // não têm evento individual; ficam neste estado próprio (chips de arcada).
  const [sentinelasSel, setSentinelasSel] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Detecção ao vivo (copiloto) ──
  // Dentes: regex FDI client-side, instantâneo e grátis — permanentes E decíduos (5x-8x).
  const detectedTeeth = useMemo(() => {
    const matches = textoLivre.match(/\b(?:[1-4][1-8]|[5-8][1-5])\b/g) ?? [];
    return [...new Set(matches.map(Number))].sort((a, b) => a - b);
  }, [textoLivre]);
  // Procedimentos: debounce ~2s na rota leve própria (adendo 13/07 §H) — mesma família
  // de prompt do organizador, pra o preview não divergir da ficha final.
  const [detectedProcs, setDetectedProcs] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const detectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Caminho único de pós-gravação: usado pelo stop manual E pelo corte por silêncio.
  const processarAudio = useCallback(async (blob: Blob | null) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!blob) { setIsTranscribing(false); return; }
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as { transcricao?: string };
      const texto = data.transcricao?.trim();
      if (texto) {
        setLiveTranscript(texto);
        setTextoLivre(prev => prev ? `${prev}\n${texto}` : texto);
      }
    } catch (err) {
      console.error('[consulta] transcrever:', err);
      toast.error('Não foi possível transcrever o áudio. Tente novamente.');
    } finally { setIsTranscribing(false); }
  }, []);

  const { status: micStatus, startRecording, stopRecording } = useAudioRecorder({
    onAutoStop: (blob) => { void processarAudio(blob); },
  });

  // Detecção ao vivo de procedimentos enquanto o dentista escreve (só na fase de captura).
  useEffect(() => {
    // Não roda em demo (sem clínica real) nem fora da fase de captura.
    if (isDemo || fase !== 'captura') { setDetectedProcs([]); setIsDetecting(false); return; }

    const texto = textoLivre.trim();
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    if (texto.length < 20) { setDetectedProcs([]); setIsDetecting(false); return; }

    setIsDetecting(true);
    detectDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/dex/detectar-consulta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto }),
        });
        if (!res.ok) return;
        const data = await res.json() as { procedimentos?: { descricao: string; dentes: number[] }[] };
        setDetectedProcs(
          (data.procedimentos ?? [])
            .filter(p => p?.descricao)
            .map(p => p.dentes.length > 0 ? `${p.descricao} – ${p.dentes.map(denteLabel).join(', ')}` : p.descricao)
            .slice(0, 12)
        );
      } catch (err) {
        console.error('[consulta] detecção ao vivo:', err);
      } finally {
        setIsDetecting(false);
      }
    }, 2000);

    return () => { if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current); };
  }, [textoLivre, isDemo, fase]);

  // Cleanup de timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-inicia o atendimento ao entrar no Modo Consulta (sem precisar de clique)
  useEffect(() => {
    if (isDemo) return;
    if (['in_progress', 'completed', 'cancelled', 'no_show'].includes(aptStatus)) return;
    void iniciarAtendimentoConsulta(agendamentoId).then(result => {
      if (!result.error) setAptStatus('in_progress');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = paciente.nome.split(' ')[0];

  // Marca a conclusão da demo pro DexWidget (libera o FAB e carrega contexto).
  // A orientação do DEX vive no header do card ("Dex · Copiloto") — não há mais
  // balão flutuante: ele duplicava o mascote e cobria o botão "Organizar com DEX".
  const guideId = dentistaId ?? 'guide';
  const { setPhase: setGuidePhase } = useDexGuide(guideId);

  const handleVoice = useCallback(async () => {
    if (micStatus === 'recording') {
      setIsTranscribing(true);
      const blob = await stopRecording();
      await processarAudio(blob);
    } else {
      if (micStatus === 'error') {
        toast.error('Microfone indisponível. Verifique as permissões do navegador e recarregue a página.');
        return;
      }
      setElapsedSeconds(0);
      setLiveTranscript('');
      const started = await startRecording();
      if (!started) {
        toast.error('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
        return;
      }
      // Só inicia o timer após confirmar que a gravação começou
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
  }, [micStatus, startRecording, stopRecording, processarAudio]);

  const handleFormatar = async () => {
    const texto = textoLivre.trim();
    if (!texto) return;

    // Inicia feedback progressivo
    setFase('organizando');
    setFormatLabel(FORMATAR_ETAPAS[0].label);
    formatTimersRef.current.forEach(clearTimeout);
    formatTimersRef.current = FORMATAR_ETAPAS.slice(1).map(({ ms, label }) =>
      setTimeout(() => setFormatLabel(label), ms)
    );

    try {
      const res = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto,
          pacienteNome: paciente.nome,
          modo: exameInicial ? 'exame_inicial' : 'consulta',
        }),
      });
      const data = await res.json() as EvolucaoFormatada & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
      setEvolucao(data);
      // v3 — eventos viram rascunho editável; data clínica default = campo da confirmação
      // (a IA NUNCA propõe data — invariante #13).
      setEventosDraft(
        (data.odontograma_eventos ?? []).map((ev) => ({
          ...ev,
          realizado_em: ev.status === 'realizado' && ev.origem === 'clinica' ? dataProcedimento : null,
        })),
      );
      setDenteAberto(null);
      // Sentinelas de arcada/boca entram auto-confirmadas (têm chip próprio pra remover);
      // dentes individuais entram pela existência de EVENTO (revisável no painel).
      setSentinelasSel(data.dentes_afetados.filter(isArch));
      setFase('confirmando');
    } catch (err) {
      console.error('[consulta] formatar-evolucao:', err);
      toast.error('O Dex não conseguiu organizar as anotações. Tente novamente.');
      setFase('captura');
    } finally {
      formatTimersRef.current.forEach(clearTimeout);
      formatTimersRef.current = [];
      setFormatLabel('Organizar com DEX');
    }
  };

  // Alterna uma sentinela de arcada/boca (97/98/99) nos chips.
  const toggleSentinela = (t: number) =>
    setSentinelasSel(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));

  // v3 — derivações da unificação: dentes com evento + sentinelas = o que entra na ficha.
  const dentesComEvento = useMemo(
    () => [...new Set(eventosDraft.map(e => e.ancora.dente).filter((d): d is number => d != null))].sort((a, b) => a - b),
    [eventosDraft],
  );
  const dentesConfirmados = useMemo(
    () => [...new Set([...dentesComEvento, ...sentinelasSel])].sort((a, b) => a - b),
    [dentesComEvento, sentinelasSel],
  );
  // Citado no relato mas sem evento no desenho — aviso clicável (guard anti-alucinação:
  // sem registro visual revisado, o dente NÃO entra na ficha).
  const dentesSemEvento = useMemo(
    () => (evolucao?.dentes_afetados ?? []).filter(d => !isArch(d) && !dentesComEvento.includes(d)),
    [evolucao, dentesComEvento],
  );
  // v3 §1.10 — o que o paciente atesta ao assinar: realizados + data clínica.
  const procedimentosAssinatura = useMemo(
    () =>
      eventosDraft
        .filter(ev => ev.status === 'realizado')
        .map(ev => ({
          label: `${TIPO_LABEL[ev.tipo]}${ev.ancora.dente != null ? ` — dente ${ev.ancora.dente}` : ''}${(ev.ancora.faces ?? []).length > 0 ? ` (${(ev.ancora.faces ?? []).join('')})` : ''}`,
          data: ev.realizado_em,
        })),
    [eventosDraft],
  );

  // v3 — "Data do procedimento" (§1.10): campo único aplicado a todos os eventos
  // realizado-da-clínica; override por evento no ToothDetailPanel.
  const aplicarDataProcedimento = (d: string) => {
    if (!d) return;
    setDataProcedimento(d);
    setEventosDraft(prev =>
      prev.map(ev => (ev.status === 'realizado' && ev.origem === 'clinica' ? { ...ev, realizado_em: d } : ev)),
    );
  };
  const hoje = new Date().toLocaleDateString('en-CA');

  // Procedimentos por dente — `dentes_observacoes[dente]` guarda "proc1\nproc2..." (\n-separado).
  // A UI edita cada procedimento como uma linha própria e junta com \n ao gravar, mantendo o
  // contrato da coluna e espelhando o editor de ficha (multi-procedimento por dente).
  const getDenteProcs = (dente: number): string[] =>
    (evolucao?.dentes_observacoes[String(dente)] ?? '').split('\n');

  const setDenteProcs = (dente: number, procs: string[]) => {
    setEvolucao(prev =>
      prev
        ? { ...prev, dentes_observacoes: { ...prev.dentes_observacoes, [String(dente)]: procs.join('\n') } }
        : prev,
    );
  };

  const handleSalvar = async () => {
    if (!evolucao) return;
    setIsSaving(true);

    if (isDemo) {
      await new Promise(r => setTimeout(r, 800));
      setFase('salvo');
      setSavedFichaId('demo');
      setIsSaving(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`dex_demo_done_v1_${guideId}`, '1');
      }
      setGuidePhase('done');
      return;
    }

    // Fix #2 (v3): dentes salvos = os com EVENTO revisado + sentinelas confirmadas
    // (derivado acima) — o painel do odontograma é a superfície de confirmação.

    // Fix #1: alerta_novo — incluir nas anotações para não perder dado clínico
    const anotacoesFinais = evolucao.alerta_novo
      ? `${evolucao.anotacoes}\n\n⚠️ Novo alerta detectado: ${evolucao.alerta_novo}`
      : evolucao.anotacoes;

    const result = await salvarFichaConsulta({
      agendamentoId,
      pacienteId:         paciente.id,
      queixa_principal:   evolucao.queixa_principal,
      anotacoes:          anotacoesFinais,
      dentes_afetados:    dentesConfirmados,
      dentes_observacoes: evolucao.dentes_observacoes,
      procedimentos:      evolucao.procedimentos,
      conduta:            evolucao.conduta,
      alerta_novo:        evolucao.alerta_novo,
      odontograma_eventos: eventosDraft,
    });
    if (result.error) { toast.error(result.error); setIsSaving(false); return; }
    if (result.fichaId) setSavedFichaId(result.fichaId);
    setFase('salvo');
  };

  // Recompensa pós-ficha por persona (Workstream B1). Heurística: ~180 caracteres
  // estruturados ≈ 1 min que o dentista não precisou digitar.
  const fichaChars = evolucao
    ? [
        evolucao.queixa_principal,
        evolucao.anotacoes,
        evolucao.conduta,
        ...(evolucao.procedimentos ?? []),
        ...Object.values(evolucao.dentes_observacoes ?? {}),
      ].join(' ').length
    : 0;
  const minutosEconomizados = Math.max(1, Math.round(fichaChars / 180));
  const recompensaPersona =
    dentistaFoco === 'crescer'
      ? 'Pronto pra apresentar ao paciente.'
      : `≈ ${minutosEconomizados} min que você não digitou.`;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-3.5 flex items-center justify-between shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Sair</span>
        </button>

        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full bg-teal"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="font-heading text-lg text-text-primary">
            Modo Consulta — {firstName}
          </span>
          {isDemo ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)', color: 'var(--color-teal)' }}
            >
              Demonstração
            </span>
          ) : (
            <span className="font-mono text-xs text-text-secondary bg-surface-alt px-2 py-0.5 rounded-md">{hora}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <BotaoMensagemIA
            variant="icon"
            pacienteNome={paciente.nome}
            dentistaNome=""
            dataHora={hora}
            defaultTipo="follow_up"
          />
          <div className="w-4" />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">

        {/* ── Coluna esquerda: Sidebar ──────────────────────────────────── */}
        {/* Some na confirmação (adendo 13/07 §I). Visibilidade derivada da MESMA `fase`
            que dirige o AnimatePresence — elimina o frame de tela preta (spec v3 Fatia A). */}
        {fase !== 'confirmando' && (
          <ConsultationSidebar
            agendamentoId={agendamentoId}
            pacienteNome={paciente.nome}
            idadeStr={paciente.idadeStr}
            observacoes={paciente.observacoes}
            observacoesAgendamento={observacoesAgendamento}
            ultimaQueixa={ultimaQueixa}
            ultimasAnotacoes={ultimasAnotacoes}
            fichas={fichas}
            orcamentos={orcamentos}
            alertasClinicos={alertasClinicos}
            planejamento={planejamento}
          />
        )}

        {/* ── Coluna direita: Escrita livre / Evolução ──────────────────── */}
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">

            {/* ── Texto livre (captura + organizando compartilham o bloco; overlay cobre) ── */}
            {(fase === 'captura' || fase === 'organizando') && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full relative"
              >
                {/* ── DEX Processing Overlay (Item 1) ── */}
                <AnimatePresence>
                  {isFormatando && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-bg/90"
                      style={{ backdropFilter: 'blur(10px)' }}
                    >
                      <div className="flex flex-col items-center gap-5 max-w-xs text-center">
                        {/* DEX avatar with pulse rings */}
                        <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
                          {[0, 1].map(i => (
                            <motion.span
                              key={i}
                              className="absolute rounded-full"
                              style={{ width: 72, height: 72, border: '1.5px solid rgba(47,156,133,0.4)' }}
                              animate={{ scale: [1, 1.6 + i * 0.35], opacity: [0.5, 0] }}
                              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.65, ease: 'easeOut' }}
                            />
                          ))}
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
                            style={{ background: 'linear-gradient(135deg, #2f9c85, #1a7a65)', boxShadow: '0 8px 24px rgba(47,156,133,0.35)' }}
                          >
                            <Bot className="w-7 h-7 text-white" />
                          </div>
                        </div>
                        {/* Step label with animated swap */}
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={formatLabel}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.28 }}
                            className="font-heading text-xl text-text-primary"
                          >
                            {formatLabel}
                          </motion.p>
                        </AnimatePresence>
                        {/* Progress dots */}
                        <div className="flex gap-2">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: '#2f9c85' }}
                              animate={{ opacity: [0.25, 1, 0.25] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.35 }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* ── Card de escrita unificado ── */}
                <div className="flex-1 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-sm focus-within:border-teal transition-colors">

                  {/* Header do card: DEX + contador */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <DexAvatar size={32} />
                      <div className="leading-tight min-w-0">
                        <p className="text-sm font-semibold text-text-primary">Dex · Copiloto</p>
                        <p className="text-xs text-text-secondary truncate">Fale ou digite — eu monto a ficha</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* v3 — Exame inicial: só aparece pra paciente sem registro de odontograma (§Fluxo b) */}
                      {!temHistoricoOdontograma && (
                        <button
                          type="button"
                          onClick={() => setExameInicial(v => !v)}
                          aria-pressed={exameInicial}
                          title="Exame inicial: tudo que você narrar entra como PRÉ-EXISTENTE (cinza) — a condição em que o paciente chegou. Narre o exame, desligue, e narre o trabalho de hoje numa segunda passada."
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all outline-none focus-visible:ring-1 focus-visible:ring-teal"
                          style={exameInicial
                            ? { background: 'color-mix(in srgb, var(--color-slate) 18%, var(--color-surface-alt))', borderColor: 'var(--color-slate)', color: 'var(--color-slate)' }
                            : { background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: exameInicial ? 'var(--color-slate)' : 'var(--color-border)' }}
                            aria-hidden="true"
                          />
                          Exame inicial
                        </button>
                      )}
                      <span className="text-xs text-text-secondary font-mono">{textoLivre.length} car.</span>
                    </div>
                  </div>

                {/* ── Detecção ao vivo (chips) ── */}
                <AnimatePresence>
                  {textoLivre.length > 20 && (detectedTeeth.length > 0 || detectedProcs.length > 0 || isDetecting) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-b border-border/50 bg-surface-alt/40 px-5 py-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <DexAvatar size={16} animated={isDetecting} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                            Detectando ao vivo{isDetecting ? '…' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {detectedTeeth.map(d => (
                            <span
                              key={`t${d}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border"
                              style={{ background: 'rgba(47,156,133,0.08)', borderColor: 'rgba(47,156,133,0.25)', color: '#2f9c85' }}
                            >
                              dente {d}
                            </span>
                          ))}
                          {detectedProcs.map((p, i) => (
                            <span
                              key={`p${i}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border"
                              style={{ background: 'rgba(47,156,133,0.08)', borderColor: 'rgba(47,156,133,0.22)', color: '#2f9c85' }}
                            >
                              {p}
                            </span>
                          ))}
                          {detectedTeeth.length === 0 && detectedProcs.length === 0 && isDetecting && (
                            <span className="text-[11px] text-text-secondary italic">Analisando o relato…</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                  {/* Textarea — transparente dentro do card */}
                  <div className="relative flex-1 flex flex-col">
                    <textarea
                      ref={textareaRef}
                      value={textoLivre}
                      onChange={e => setTextoLivre(e.target.value)}
                      placeholder="Ex: Realizei extração do elemento 36 com anestesia local. Paciente sem intercorrências. Orientado sobre cuidados pós-operatórios. Retorno em 7 dias para remoção dos pontos."
                      className="flex-1 w-full px-5 py-4 text-sm leading-relaxed resize-none outline-none bg-transparent text-text-primary placeholder:text-text-secondary/50"
                      style={{ minHeight: '260px' }}
                      autoFocus
                      readOnly={micStatus === 'recording' || isTranscribing}
                    />

                    {/* Indicador de gravação */}
                    <AnimatePresence>
                      {(micStatus === 'recording' || isTranscribing) && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute top-3 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl"
                          style={{ background: micStatus === 'recording' ? 'rgba(239,68,68,0.1)' : 'rgba(47,156,133,0.1)', border: `1px solid ${micStatus === 'recording' ? 'rgba(239,68,68,0.3)' : 'rgba(47,156,133,0.3)'}` }}
                        >
                          <motion.div
                            className="w-2 h-2 rounded-full"
                            style={{ background: micStatus === 'recording' ? '#ef4444' : '#2f9c85' }}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                          <span className="text-xs font-semibold" style={{ color: micStatus === 'recording' ? '#ef4444' : '#2f9c85' }}>
                            {isTranscribing ? 'Transcrevendo...' : 'Gravando...'}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Footer do card: Ditar + Organizar */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-surface-alt/30">
                    <button
                      onClick={() => void handleVoice()}
                      disabled={isTranscribing}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 border ${
                        micStatus === 'recording'
                          ? 'bg-red-500/10 text-red-500 border-red-500/30'
                          : 'bg-surface border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {micStatus === 'recording'
                        ? <><MicOff className="w-4 h-4" /> Parar</>
                        : <><Mic className="w-4 h-4" /> Ditar</>
                      }
                    </button>

                    <button
                      onClick={() => void handleFormatar()}
                      disabled={!textoLivre.trim() || isFormatando || micStatus === 'recording'}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ background: '#2f9c85', color: '#fff', boxShadow: '0 2px 12px rgba(47,156,133,0.30)' }}
                    >
                      {isFormatando
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {formatLabel}</>
                        : <><Bot className="w-4 h-4" /> Organizar com DEX</>
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Salvo — Demo ── */}
            {fase === 'salvo' && isDemo && (
              <motion.div
                key="saved-demo"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full gap-6 text-center px-4"
              >
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#2f9c85', boxShadow: '0 8px 24px rgba(47,156,133,0.35)' }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
                <div>
                  <p className="font-heading text-2xl text-text-primary mb-2">A ficha foi estruturada.</p>
                  <p className="text-sm text-text-secondary leading-relaxed max-w-xs mx-auto">
                    O DEX organizou tudo sozinho. Quer ver o que acontece com ela depois da consulta?
                  </p>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setDemoSignOpen(true)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-6 py-3 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
                >
                  Ver o que acontece com a ficha
                </motion.button>
                <button
                  type="button"
                  onClick={() => irParaPerfilDemo()}
                  className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors"
                >
                  Pular
                </button>
              </motion.div>
            )}

            {/* ── Salvo — Normal ── */}
            {fase === 'salvo' && !isDemo && (
              <motion.div
                key="saved"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full gap-6"
              >
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#2f9c85', boxShadow: '0 8px 24px rgba(47,156,133,0.35)' }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <Check className="w-8 h-8 text-white" />
                </motion.div>
                <div className="text-center">
                  <p className="font-heading text-2xl text-text-primary mb-1">Ficha salva!</p>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm font-semibold mb-1"
                    style={{ color: '#2f9c85' }}
                  >
                    {recompensaPersona}
                  </motion.p>
                  {showSignature && (
                    <p className="text-sm text-text-secondary">Coletando assinatura...</p>
                  )}
                </div>
                {/* CTA primário: gerar o plano enquanto o paciente ainda está na cadeira (spec 2.3) */}
                {!showSignature && savedFichaId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <ApresentarPaciente
                      patientId={paciente.id}
                      clinicaId={clinicaId}
                      patientName={paciente.nome}
                      dentistaId={dentistaId}
                      fichaId={savedFichaId}
                      mode="direct"
                      autoGenerate
                      label="Gerar plano de tratamento"
                    />
                  </motion.div>
                )}
                {!showSignature && savedFichaId && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => setShowSignature(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-colors"
                    style={{ borderColor: 'rgba(47,156,133,0.30)', color: '#2f9c85' }}
                  >
                    <PenLine className="w-4 h-4" />
                    Solicitar assinatura do paciente
                  </motion.button>
                )}
                {/* Saída explícita do fluxo — fecha o ciclo da consulta (spec fase1-5 §E, D8) */}
                {!showSignature && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    onClick={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Concluir consulta
                  </motion.button>
                )}
                {!showSignature && (
                  <button
                    onClick={() => setShowEmitir(true)}
                    className="text-xs text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors"
                  >
                    Emitir documento (receita, atestado, pedido)
                  </button>
                )}
              </motion.div>
            )}

            {/* ── Confirmação / Evolução formatada ── */}
            {fase === 'confirmando' && evolucao && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-5 w-full max-w-6xl mx-auto"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-2xl text-text-primary mb-0.5">Confirmar evolução</h2>
                    <p className="text-sm text-text-secondary">Revise os campos detectados pela IA antes de salvar.</p>
                  </div>
                  <button
                    onClick={() => { setDenteAberto(null); setFase('captura'); }}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Editar relato
                  </button>
                </div>

                {/* Grade 2 colunas (lg+): textos à esquerda; odontograma + procedimentos
                    por dente à direita (adendo 13/07 §I). Mobile: coluna única. */}
                <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                <div className="flex flex-col gap-5">

                {/* Queixa principal */}
                <DraftPendingCard label="Tipo / Queixa principal">
                  <input
                    value={evolucao.queixa_principal}
                    onChange={e => setEvolucao({ ...evolucao, queixa_principal: e.target.value })}
                    className="w-full text-sm font-semibold text-text-primary bg-transparent outline-none border-b border-border focus:border-teal pb-1 transition-colors"
                  />
                </DraftPendingCard>

                {/* Anotações */}
                <DraftPendingCard label="Anotações clínicas">
                  <textarea
                    value={evolucao.anotacoes}
                    onChange={e => setEvolucao({ ...evolucao, anotacoes: e.target.value })}
                    className="w-full text-sm text-text-primary bg-transparent outline-none resize-none leading-relaxed"
                    rows={4}
                  />
                </DraftPendingCard>

                {/* Procedimentos detectados — chips com aviso se não cadastrado na clínica */}
                {evolucao.procedimentos.length > 0 && (
                  <DraftPendingCard label="Procedimentos detectados">
                    <div className="flex flex-wrap gap-2">
                      {evolucao.procedimentos.map((p, i) => {
                        const cadastrado = procedimentoCadastrado(p, procedimentosClinica);
                        return (
                          <div
                            key={i}
                            className="group flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
                            style={cadastrado ? {
                              background: 'rgba(47,156,133,0.08)',
                              borderColor: 'rgba(47,156,133,0.25)',
                              color: 'var(--color-text-primary)',
                            } : {
                              background: 'rgba(245,158,11,0.08)',
                              borderColor: 'rgba(245,158,11,0.35)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {!cadastrado && (
                              <AlertTriangle
                                className="w-3 h-3 shrink-0"
                                style={{ color: '#f59e0b' }}
                              />
                            )}
                            <span>{p}</span>
                            {!cadastrado && (
                              <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>
                                · não cadastrado
                              </span>
                            )}
                            <button
                              onClick={() => setEvolucao({
                                ...evolucao,
                                procedimentos: evolucao.procedimentos.filter((_, idx) => idx !== i),
                              })}
                              title="Remover procedimento"
                              className="ml-0.5 text-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {evolucao.procedimentos.some(p => !procedimentoCadastrado(p, procedimentosClinica)) && (
                      <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                        Procedimentos marcados com ⚠️ não foram encontrados no cadastro da clínica e não serão incluídos automaticamente no orçamento.
                      </p>
                    )}
                  </DraftPendingCard>
                )}

                {/* Conduta — Fix #4: sempre visível para documentação obrigatória */}
                <DraftPendingCard label="Conduta / Orientações">
                  <textarea
                    value={evolucao.conduta}
                    onChange={e => setEvolucao({ ...evolucao, conduta: e.target.value })}
                    placeholder="Orientações ao paciente, cuidados pós-operatórios, prescrições..."
                    className="w-full text-sm text-text-primary bg-transparent outline-none resize-none leading-relaxed placeholder:text-text-secondary"
                    rows={2}
                  />
                </DraftPendingCard>

                {/* Alerta novo — Fix #1: exibir e informar dentista para atualizar cadastro */}
                {evolucao.alerta_novo && (
                  <DraftPendingCard label="⚠️ Novo alerta detectado">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{evolucao.alerta_novo}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Será registrado nas anotações da ficha. Atualize manualmente o cadastro do paciente se necessário.
                    </p>
                  </DraftPendingCard>
                )}

                </div>{/* /coluna esquerda */}
                <div className="flex flex-col gap-5">

                {/* ── v3: o odontograma ÚNICO — pintado pelos eventos, tocar abre o painel ── */}
                {(eventosDraft.length > 0 || dentesSemEvento.length > 0) && (
                  <DraftPendingCard
                    label={
                      dentesConfirmados.length > 0
                        ? `Odontograma — ${dentesConfirmados.map(denteLabel).join(', ')}`
                        : 'Odontograma'
                    }
                  >
                    <Odontograma
                      eventos={eventosDraft}
                      selectedTeeth={[]}
                      onToothToggle={setDenteAberto}
                      compact
                      hideFilters
                    />
                    <ArchChips
                      selected={sentinelasSel}
                      detected={evolucao.dentes_afetados}
                      onToggle={toggleSentinela}
                    />
                    {/* Guard anti-alucinação (Fix #2, v3): citado sem evento NÃO entra na ficha. */}
                    {dentesSemEvento.length > 0 && (
                      <div
                        className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5"
                        style={{
                          background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))',
                          borderColor: 'color-mix(in srgb, var(--color-warning) 35%, var(--color-border))',
                        }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-text-primary mb-1">
                            Citados no relato, sem registro no desenho:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {dentesSemEvento.map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setDenteAberto(d)}
                                className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal"
                                style={{
                                  background: 'var(--color-surface-alt)',
                                  borderColor: 'color-mix(in srgb, var(--color-warning) 45%, var(--color-border))',
                                  color: 'var(--color-warning)',
                                }}
                              >
                                dente {d}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-text-secondary mt-1.5">
                            Toque pra registrar no painel — sem registro, o dente não entra na ficha.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                        Data do procedimento
                      </label>
                      <input
                        type="date"
                        value={dataProcedimento}
                        max={hoje}
                        onChange={e => aplicarDataProcedimento(e.target.value)}
                        className="text-xs font-mono rounded-lg px-2.5 py-1.5 outline-none border bg-surface-alt border-border text-text-primary focus:border-teal transition-colors"
                        aria-label="Data clínica dos procedimentos realizados"
                      />
                      <span className="text-[10px] text-text-secondary">
                        aplica aos realizados · ajuste fino por dente no painel
                      </span>
                    </div>
                  </DraftPendingCard>
                )}

                {denteAberto != null && (
                  <ToothDetailPanel
                    dente={denteAberto}
                    eventos={eventosDraft}
                    onChange={setEventosDraft}
                    onClose={() => setDenteAberto(null)}
                    dataPadrao={dataProcedimento}
                  />
                )}

                {eventosDraft.length > 0 && (
                  <ToothGroupList eventos={eventosDraft} onDenteClick={setDenteAberto} />
                )}

                {/* ── v3: manutenção de orto — chips no lugar de odontograma vazio (§Fluxo d) ── */}
                {evolucao.orto_manutencao && eventosDraft.length === 0 && (
                  <DraftPendingCard label="Manutenção ortodôntica">
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['Arcada', evolucao.orto_manutencao.arcada],
                        ['Arco', evolucao.orto_manutencao.fio],
                        ['Ativação', evolucao.orto_manutencao.ativacao],
                        ['Elástico corrente', evolucao.orto_manutencao.elastico_corrente],
                        ['Intermaxilar', evolucao.orto_manutencao.elastico_intermaxilar],
                      ] as const).map(([rotulo, valor]) =>
                        valor ? (
                          <span
                            key={rotulo}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-surface-alt border-border"
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wide text-text-secondary">{rotulo}</span>
                            <span className="font-semibold text-text-primary">{valor}</span>
                          </span>
                        ) : null,
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary mt-2">
                      Manutenção é registro da arcada — não pinta o odontograma.
                    </p>
                  </DraftPendingCard>
                )}

                {/* Procedimentos por dente — cada procedimento numa linha própria (multi-proc por dente) */}
                {dentesConfirmados.length > 0 && (
                  <div className="bg-surface rounded-2xl border border-border p-5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-3">
                      Procedimentos por dente
                    </label>
                    {/* Grade interna em 2 colunas (md+) quando muitos dentes — corta o paredão de scroll */}
                    <div className={dentesConfirmados.length > 4 ? 'grid gap-4 md:grid-cols-2' : 'space-y-4'}>
                      {dentesConfirmados.map(dente => {
                        const procs = getDenteProcs(dente);
                        return (
                          <div key={dente}>
                            <span className="font-mono text-xs font-bold text-teal block mb-1.5">{denteLabel(dente)}</span>
                            <div className="space-y-1.5">
                              {procs.map((proc, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    value={proc}
                                    onChange={e => {
                                      const next = [...procs];
                                      next[idx] = e.target.value;
                                      setDenteProcs(dente, next);
                                    }}
                                    placeholder="Procedimento neste dente..."
                                    className="flex-1 text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors"
                                  />
                                  {procs.length > 1 && (
                                    <button
                                      onClick={() => setDenteProcs(dente, procs.filter((_, i) => i !== idx))}
                                      title="Remover procedimento"
                                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => setDenteProcs(dente, [...procs, ''])}
                                className="text-[11px] text-teal font-semibold hover:opacity-75 transition-opacity"
                              >
                                + adicionar procedimento
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                </div>{/* /coluna direita */}
                </div>{/* /grade 2 colunas */}

                {/* Botão Confirmar e salvar */}
                <button
                  onClick={() => void handleSalvar()}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 text-white"
                  style={{ background: '#2f9c85', boxShadow: '0 2px 16px rgba(47,156,133,0.30)' }}
                >
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><Check className="w-4 h-4" /> Confirmar e salvar na ficha</>
                  }
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      <VoiceUX
        isRecording={micStatus === 'recording'}
        isTranscribing={isTranscribing}
        liveTranscript={liveTranscript}
        elapsedSeconds={elapsedSeconds}
        onStop={() => void handleVoice()}
      />

      {/* ── Assinatura do paciente (Item 3) ── */}
      {showSignature && savedFichaId && (
        <ConsultaAssinaturaModal
          open={showSignature}
          onClose={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
          fichaId={savedFichaId}
          pacienteId={paciente.id}
          pacienteNome={paciente.nome}
          onSigned={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
          procedimentosRealizados={procedimentosAssinatura}
        />
      )}

      {/* ── Assinatura mock da demo (K · spec 3.1/3.2) — qualquer saída leva ao perfil demo ── */}
      {demoSignOpen && (
        <ConsultaAssinaturaModal
          open={demoSignOpen}
          isDemo
          onClose={() => { setDemoSignOpen(false); irParaPerfilDemo(); }}
          fichaId=""
          pacienteId="demo"
          pacienteNome={paciente.nome}
        />
      )}

      <EmitirDocumentoModal
        open={showEmitir}
        onClose={() => setShowEmitir(false)}
        patientId={paciente.id}
        patientName={paciente.nome}
      />
    </div>
  );
}
