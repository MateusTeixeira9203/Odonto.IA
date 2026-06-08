'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Loader2,
  Check, Edit2, Mic, MicOff, Bot, Play, X, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { salvarFichaConsulta, iniciarAtendimentoConsulta } from '../actions';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import { ConsultationSidebar } from './consultation-sidebar';
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';
import { VoiceUX } from './voice-ux';
import { DraftPendingCard } from './draft-pending-card';
import { MiniOdontograma } from './mini-odontograma';

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
}

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
}: ConsultaClientProps) {
  const router = useRouter();
  const [textoLivre, setTextoLivre] = useState('');
  const [isFormatando, setIsFormatando] = useState(false);
  const [formatLabel, setFormatLabel] = useState('Organizar com DEX');
  const formatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [evolucao, setEvolucao] = useState<EvolucaoFormatada | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aptStatus, setAptStatus] = useState(agendamentoStatus);
  const [isIniciando, setIsIniciando] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [confirmedTeeth, setConfirmedTeeth] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status: micStatus, startRecording, stopRecording } = useAudioRecorder();

  // Fix: cleanup timer ao desmontar para evitar memory leak se usuário sair durante gravação
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const firstName = paciente.nome.split(' ')[0];

  const handleVoice = useCallback(async () => {
    if (micStatus === 'recording') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsTranscribing(true);
      const blob = await stopRecording();
      if (!blob) { setIsTranscribing(false); return; }
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
  }, [micStatus, startRecording, stopRecording]);

  const handleFormatar = async () => {
    const texto = textoLivre.trim();
    if (!texto) return;

    // Inicia feedback progressivo
    setIsFormatando(true);
    setFormatLabel(FORMATAR_ETAPAS[0].label);
    formatTimersRef.current.forEach(clearTimeout);
    formatTimersRef.current = FORMATAR_ETAPAS.slice(1).map(({ ms, label }) =>
      setTimeout(() => setFormatLabel(label), ms)
    );

    try {
      const res = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, pacienteNome: paciente.nome }),
      });
      const data = await res.json() as EvolucaoFormatada & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
      setEvolucao(data);
      // Auto-confirma dentes detectados pela IA — dentista pode desselecionar manualmente se necessário
      setConfirmedTeeth(data.dentes_afetados);
    } catch (err) {
      console.error('[consulta] formatar-evolucao:', err);
      toast.error('O Dex não conseguiu organizar as anotações. Tente novamente.');
    } finally {
      formatTimersRef.current.forEach(clearTimeout);
      formatTimersRef.current = [];
      setIsFormatando(false);
      setFormatLabel('Organizar com DEX');
    }
  };

  const handleSalvar = async () => {
    if (!evolucao) return;
    setIsSaving(true);

    // Fix #2: usa só dentes confirmados pelo dentista (não union com IA)
    // Dentista DEVE confirmar clicando — amber não confirmado = não salvo
    const dentesConfirmados = confirmedTeeth;

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
      retorno_sugerido:   evolucao.retorno_sugerido,
      alerta_novo:        evolucao.alerta_novo,
    });
    if (result.error) { toast.error(result.error); setIsSaving(false); return; }
    setSaved(true);
    setTimeout(() => router.push(`/dashboard/pacientes/${paciente.id}`), 1800);
  };

  const handleIniciarAtendimento = async () => {
    setIsIniciando(true);
    const result = await iniciarAtendimentoConsulta(agendamentoId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setAptStatus('in_progress');
      toast.success('Atendimento iniciado!');
    }
    setIsIniciando(false);
  };

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
          <span className="font-mono text-xs text-text-secondary bg-surface-alt px-2 py-0.5 rounded-md">{hora}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Iniciar Atendimento — dentista/admin only, only when not yet in_progress */}
          {aptStatus !== 'in_progress' && aptStatus !== 'completed' && (
            <button
              onClick={() => void handleIniciarAtendimento()}
              disabled={isIniciando}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2"
              style={{ background: '#2f9c85', boxShadow: '0 2px 12px rgba(47,156,133,0.25)' }}
            >
              {isIniciando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Iniciar Atendimento
            </button>
          )}
          {aptStatus === 'in_progress' && (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-teal text-white uppercase tracking-wider">
              Em Atendimento
            </span>
          )}
          {(aptStatus === 'in_progress' || aptStatus === 'completed') && (
            <BotaoMensagemIA
              variant="icon"
              pacienteNome={paciente.nome}
              dentistaNome=""
              dataHora={hora}
              defaultTipo="follow_up"
            />
          )}
          <div className="w-4" />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">

        {/* ── Coluna esquerda: Sidebar ──────────────────────────────────── */}
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

        {/* ── Coluna direita: Escrita livre / Evolução ──────────────────── */}
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">

            {/* ── Texto livre ── */}
            {!evolucao && !saved && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-text-secondary font-medium">{firstName} · {hora}</span>
                  <span className="text-xs text-text-secondary font-mono">{textoLivre.length} car.</span>
                </div>

                <div className="relative flex-1 flex flex-col">
                  <textarea
                    ref={textareaRef}
                    value={textoLivre}
                    onChange={e => setTextoLivre(e.target.value)}
                    placeholder={`Ex: Realizei extração do elemento 36 com anestesia local. Paciente sem intercorrências. Orientado sobre cuidados pós-operatórios. Retorno em 7 dias para remoção dos pontos.`}
                    className="flex-1 w-full rounded-2xl p-5 text-sm leading-relaxed resize-none outline-none bg-surface border border-border focus:border-teal transition-colors text-text-primary placeholder:text-text-secondary"
                    style={{ minHeight: '300px' }}
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
                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl"
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

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    {/* Botão de voz */}
                    <button
                      onClick={() => void handleVoice()}
                      disabled={isTranscribing}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                      style={{
                        background: micStatus === 'recording' ? 'rgba(239,68,68,0.1)' : '#f5f3ef',
                        color: micStatus === 'recording' ? '#ef4444' : '#8a8a8a',
                        border: `1px solid ${micStatus === 'recording' ? 'rgba(239,68,68,0.4)' : '#d4d1ca'}`,
                      }}
                    >
                      {micStatus === 'recording'
                        ? <><MicOff className="w-4 h-4" /> Parar</>
                        : <><Mic className="w-4 h-4" /> Ditar</>
                      }
                    </button>
                  </div>

                  <button
                    onClick={() => void handleFormatar()}
                    disabled={!textoLivre.trim() || isFormatando || micStatus === 'recording'}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: '#2f9c85', color: '#fff', boxShadow: '0 2px 12px rgba(47,156,133,0.30)' }}
                  >
                    {isFormatando
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {formatLabel}</>
                      : <><Bot className="w-4 h-4" /> Organizar com DEX</>
                    }
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Salvo ── */}
            {saved && (
              <motion.div
                key="saved"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#2f9c85', boxShadow: '0 8px 24px rgba(47,156,133,0.35)' }}>
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-heading text-2xl text-text-primary mb-1">Ficha salva!</p>
                  <p className="text-sm text-text-secondary">Redirecionando para o perfil de {firstName}...</p>
                </div>
              </motion.div>
            )}

            {/* ── Confirmação / Evolução formatada ── */}
            {evolucao && !saved && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-2xl text-text-primary mb-0.5">Confirmar evolução</h2>
                    <p className="text-sm text-text-secondary">Revise os campos detectados pela IA antes de salvar.</p>
                  </div>
                  <button
                    onClick={() => setEvolucao(null)}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Editar relato
                  </button>
                </div>

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

                {/* Retorno sugerido */}
                {evolucao.retorno_sugerido && (
                  <DraftPendingCard label="Retorno sugerido">
                    <input
                      value={evolucao.retorno_sugerido}
                      onChange={e => setEvolucao({ ...evolucao, retorno_sugerido: e.target.value })}
                      className="w-full text-sm font-semibold text-text-primary bg-transparent outline-none border-b border-border focus:border-teal pb-1 transition-colors"
                    />
                  </DraftPendingCard>
                )}

                {/* Odontograma — Fix #2: salva só confirmedTeeth; botão "Confirmar todos" */}
                <DraftPendingCard label={
                  confirmedTeeth.length > 0
                    ? `Dentes confirmados — ${confirmedTeeth.join(', ')}`
                    : evolucao.dentes_afetados.length > 0
                      ? `Dentes detectados — ${evolucao.dentes_afetados.length} aguardando confirmação`
                      : 'Dentes afetados'
                }>
                  <MiniOdontograma
                    selected={confirmedTeeth}
                    aiDetected={evolucao.dentes_afetados.filter(t => !confirmedTeeth.includes(t))}
                    onChange={setConfirmedTeeth}
                  />
                  {/* Atalho para confirmar todos os dentes detectados */}
                  {evolucao.dentes_afetados.filter(t => !confirmedTeeth.includes(t)).length > 0 && (
                    <button
                      onClick={() => setConfirmedTeeth([...new Set([...confirmedTeeth, ...evolucao.dentes_afetados])])}
                      className="mt-3 text-[11px] text-teal font-semibold hover:opacity-75 transition-opacity"
                    >
                      ✓ Confirmar todos os dentes detectados
                    </button>
                  )}
                </DraftPendingCard>

                {/* Obs por dente — Fix #2: itera só confirmedTeeth */}
                {confirmedTeeth.length > 0 && (
                  <div className="bg-surface rounded-2xl border border-border p-5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-3">
                      Observações por dente
                    </label>
                    <div className="space-y-2">
                      {confirmedTeeth.map(dente => (
                        <div key={dente} className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-teal w-8 shrink-0">{dente}</span>
                          <input
                            value={evolucao.dentes_observacoes[String(dente)] ?? ''}
                            onChange={e => setEvolucao({
                              ...evolucao,
                              dentes_observacoes: { ...evolucao.dentes_observacoes, [String(dente)]: e.target.value },
                            })}
                            placeholder="Observação para este dente..."
                            className="flex-1 text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
    </div>
  );
}
