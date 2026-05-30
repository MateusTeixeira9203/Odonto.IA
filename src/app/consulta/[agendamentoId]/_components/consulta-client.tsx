'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Loader2,
  Check, Edit2, X, Mic, MicOff, Bot, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { salvarFichaConsulta, iniciarAtendimentoConsulta, finalizarConsulta } from '../actions';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import { ConsultationSidebar } from './consultation-sidebar';
import { FinalizeConsultationDialog } from './finalize-consultation-dialog';
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';

// ── Odontograma premium ──────────────────────────────────────────────────────

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const TOOTH_W: Record<number, string> = {
  1: 'w-6', 2: 'w-6', 3: 'w-6', 4: 'w-7', 5: 'w-7', 6: 'w-8', 7: 'w-8', 8: 'w-8',
};
const tw = (t: number) => TOOTH_W[t % 10] ?? 'w-7';

function MiniOdontograma({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (teeth: number[]) => void;
}) {
  const toggle = (t: number) =>
    onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]);

  return (
    <div className="space-y-1">
      {/* Upper row */}
      <div className="flex justify-center items-end gap-0.5">
        {TEETH_UPPER.map((t, i) => {
          const active = selected.includes(t);
          return (
            <div key={t} className="flex items-end">
              {i === 8 && <div className="w-px h-6 bg-border mx-0.5 self-stretch" />}
              <button
                onClick={() => toggle(t)}
                title={`Dente ${t}`}
                className={`${tw(t)} h-8 rounded-t-md rounded-b-[2px] border text-[9px] font-mono font-bold transition-all hover:scale-105 active:scale-95 ${
                  active
                    ? 'bg-teal border-teal text-white -translate-y-1 shadow-[0_3px_8px_rgba(47,156,133,0.4)]'
                    : 'bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5'
                }`}
              >{t}</button>
            </div>
          );
        })}
      </div>
      <div className="h-px bg-border/60" />
      {/* Lower row */}
      <div className="flex justify-center items-start gap-0.5">
        {TEETH_LOWER.map((t, i) => {
          const active = selected.includes(t);
          return (
            <div key={t} className="flex items-start">
              {i === 8 && <div className="w-px h-6 bg-border mx-0.5 self-stretch" />}
              <button
                onClick={() => toggle(t)}
                title={`Dente ${t}`}
                className={`${tw(t)} h-8 rounded-b-md rounded-t-[2px] border text-[9px] font-mono font-bold transition-all hover:scale-105 active:scale-95 ${
                  active
                    ? 'bg-teal border-teal text-white translate-y-1 shadow-[0_-3px_8px_rgba(47,156,133,0.4)]'
                    : 'bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5'
                }`}
              >{t}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Ficha {
  data: string;
  queixa: string;
  anotacoes: string;
  dentes: number[];
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
  planejamento: {
    id: string;
    titulo: string;
    etapas: { id: string; titulo: string; dente: string | null; descricao_simples: string | null; status: string; ordem: number }[];
  } | null;
}

// ── Component ────────────────────────────────────────────────────────────────

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
  planejamento,
}: ConsultaClientProps) {
  const router = useRouter();
  const [textoLivre, setTextoLivre] = useState('');
  const [isFormatando, setIsFormatando] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoFormatada | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [aptStatus, setAptStatus] = useState(agendamentoStatus);
  const [isIniciando, setIsIniciando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status: micStatus, startRecording, stopRecording } = useAudioRecorder();

  const firstName = paciente.nome.split(' ')[0];

  const handleVoice = useCallback(async () => {
    if (micStatus === 'recording') {
      setIsTranscribing(true);
      const blob = await stopRecording();
      if (!blob) { setIsTranscribing(false); return; }
      try {
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        const res  = await fetch('/api/transcrever', { method: 'POST', body: fd });
        const data = await res.json() as { transcricao?: string };
        const texto = data.transcricao?.trim();
        if (texto) {
          setTextoLivre(prev => prev ? `${prev}\n${texto}` : texto);
        }
      } catch { /* silencioso */ } finally { setIsTranscribing(false); }
    } else {
      await startRecording();
    }
  }, [micStatus, startRecording, stopRecording]);

  const handleFormatar = async () => {
    const texto = textoLivre.trim();
    if (!texto) return;
    setIsFormatando(true);
    try {
      const res = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, pacienteNome: paciente.nome }),
      });
      const data = await res.json() as EvolucaoFormatada & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
      setEvolucao(data);
    } catch (err) {
      console.error('[consulta] formatar-evolucao:', err);
    } finally {
      setIsFormatando(false);
    }
  };

  const handleSalvar = async () => {
    if (!evolucao) return;
    setIsSaving(true);
    const result = await salvarFichaConsulta({
      agendamentoId,
      pacienteId: paciente.id,
      queixa_principal: evolucao.queixa_principal,
      anotacoes: evolucao.anotacoes,
      dentes_afetados: evolucao.dentes_afetados,
      dentes_observacoes: evolucao.dentes_observacoes,
    });
    if (result.error) {
      toast.error(result.error);
      setIsSaving(false);
      return;
    }
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

  const handleFinalizar = async (wizardData: {
    resumo: string;
    conduta: string;
    proximosPassos: string;
    followUpData: string;
  }) => {
    if (!evolucao) return;
    setIsFinalizando(true);
    const result = await finalizarConsulta({
      agendamentoId,
      pacienteId: paciente.id,
      queixa_principal: evolucao.queixa_principal,
      anotacoes: evolucao.anotacoes,
      dentes_afetados: evolucao.dentes_afetados,
      dentes_observacoes: evolucao.dentes_observacoes,
      ...wizardData,
    });
    if (result.error) {
      toast.error(result.error);
      setIsFinalizando(false);
      return;
    }
    setWizardOpen(false);
    setSaved(true);
    setTimeout(() => router.push(`/dashboard/pacientes/${paciente.id}`), 1800);
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
                <div className="mb-4">
                  <h2 className="font-heading text-2xl text-text-primary mb-1">O que foi feito hoje?</h2>
                  <p className="text-sm text-text-secondary">
                    Descreva livremente ou use o microfone para ditar. O DEX vai organizar nos campos da ficha.
                  </p>
                </div>

                <div className="relative flex-1 flex flex-col">
                  <textarea
                    ref={textareaRef}
                    value={micStatus === 'recording' ? textoLivre : isTranscribing ? textoLivre : textoLivre}
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
                    <span className="text-xs text-text-secondary font-mono">
                      {textoLivre.length} caracteres
                    </span>
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
                        : isTranscribing
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo...</>
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
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Organizando...</>
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
                    <p className="text-sm text-text-secondary">Revise e edite antes de salvar na ficha clínica.</p>
                  </div>
                  <button
                    onClick={() => setEvolucao(null)}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Editar relato
                  </button>
                </div>

                {/* Queixa principal */}
                <div className="bg-surface rounded-2xl border border-border p-5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2">
                    Tipo / Queixa principal
                  </label>
                  <input
                    value={evolucao.queixa_principal}
                    onChange={e => setEvolucao({ ...evolucao, queixa_principal: e.target.value })}
                    className="w-full text-sm font-semibold text-text-primary bg-transparent outline-none border-b border-border focus:border-teal pb-1 transition-colors"
                  />
                </div>

                {/* Anotações */}
                <div className="bg-surface rounded-2xl border border-border p-5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-2">
                    Anotações clínicas
                  </label>
                  <textarea
                    value={evolucao.anotacoes}
                    onChange={e => setEvolucao({ ...evolucao, anotacoes: e.target.value })}
                    className="w-full text-sm text-text-primary bg-transparent outline-none resize-none leading-relaxed"
                    rows={5}
                  />
                </div>

                {/* Odontograma */}
                <div className="bg-surface rounded-2xl border border-border p-5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-3">
                    Dentes afetados{evolucao.dentes_afetados.length > 0 && (
                      <span className="text-teal ml-2 font-mono normal-case text-[11px]">
                        {evolucao.dentes_afetados.join(', ')}
                      </span>
                    )}
                  </label>
                  <MiniOdontograma
                    selected={evolucao.dentes_afetados}
                    onChange={dentes => setEvolucao({ ...evolucao, dentes_afetados: dentes })}
                  />
                </div>

                {/* Observações por dente */}
                {evolucao.dentes_afetados.length > 0 && (
                  <div className="bg-surface rounded-2xl border border-border p-5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-3">
                      Observações por dente
                    </label>
                    <div className="space-y-2">
                      {evolucao.dentes_afetados.map(dente => (
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
                          <button
                            onClick={() => {
                              const obs = { ...evolucao.dentes_observacoes };
                              delete obs[String(dente)];
                              setEvolucao({
                                ...evolucao,
                                dentes_afetados: evolucao.dentes_afetados.filter(d => d !== dente),
                                dentes_observacoes: obs,
                              });
                            }}
                            className="text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Finalizar Consulta */}
                <button
                  onClick={() => setWizardOpen(true)}
                  disabled={isSaving || isFinalizando}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: '#2f9c85', color: '#fff', boxShadow: '0 2px 12px rgba(47,156,133,0.30)' }}
                >
                  {(isSaving || isFinalizando)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><Check className="w-4 h-4" /> Finalizar Consulta</>
                  }
                </button>

                {/* Salvar simples (fallback) */}
                <button
                  onClick={() => void handleSalvar()}
                  disabled={isSaving || isFinalizando}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-text-secondary hover:text-text-primary border border-border bg-transparent"
                >
                  Salvar sem resumo
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      <FinalizeConsultationDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onFinalize={handleFinalizar}
        isSaving={isFinalizando}
      />
    </div>
  );
}
