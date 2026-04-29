'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Clock, FileText,
  CreditCard, ChevronDown, ChevronUp, Loader2,
  Check, Edit2, X, Mic, MicOff, Bot, Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';

// ── Odontograma simplificado ─────────────────────────────────────────────────

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function MiniOdontograma({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (teeth: number[]) => void;
}) {
  const toggle = (t: number) =>
    onChange(selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t]);

  const ToothBtn = ({ t }: { t: number }) => {
    const active = selected.includes(t);
    return (
      <button
        onClick={() => toggle(t)}
        className="w-7 h-7 rounded-md text-[10px] font-mono font-semibold transition-all hover:scale-105 active:scale-95"
        style={{
          background: active ? '#2f9c85' : '#f5f3ef',
          color: active ? '#fff' : '#8a8a8a',
          border: `1px solid ${active ? '#2f9c85' : '#d4d1ca'}`,
          boxShadow: active ? '0 2px 6px rgba(47,156,133,0.30)' : 'none',
        }}
      >
        {t}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap justify-center">
        {TEETH_UPPER.map(t => <ToothBtn key={t} t={t} />)}
      </div>
      <div className="h-px bg-border mx-2" />
      <div className="flex gap-1 flex-wrap justify-center">
        {TEETH_LOWER.map(t => <ToothBtn key={t} t={t} />)}
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
  procedimento: string | null;
  observacoesAgendamento: string | null;
  ultimaQueixa: string | null;
  ultimasAnotacoes: string | null;
  fichas: Ficha[];
  orcamentos: Orcamento[];
  dentistaId: string;
  clinicaId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ConsultaClient({
  agendamentoId,
  paciente,
  hora,
  procedimento,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  orcamentos,
  dentistaId,
  clinicaId,
}: ConsultaClientProps) {
  const router = useRouter();
  const [textoLivre, setTextoLivre] = useState('');
  const [isFormatando, setIsFormatando] = useState(false);
  const [evolucao, setEvolucao] = useState<EvolucaoFormatada | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fichasExpanded, setFichasExpanded] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status: micStatus, startRecording, stopRecording } = useAudioRecorder();

  const firstName = paciente.nome.split(' ')[0];

  // Gera briefing IA automaticamente ao entrar no modo consulta
  useEffect(() => {
    setBriefingLoading(true);
    fetch(`/api/dex/briefing?agendamentoId=${agendamentoId}`)
      .then(r => r.json() as Promise<{ briefing?: string }>)
      .then(d => setBriefing(d.briefing ?? null))
      .catch(() => setBriefing(null))
      .finally(() => setBriefingLoading(false));
  }, [agendamentoId]);

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
    try {
      const supabase = createClient();
      const { error } = await supabase.from('fichas').insert({
        clinica_id: clinicaId,
        paciente_id: paciente.id,
        dentista_id: dentistaId,
        queixa_principal: evolucao.queixa_principal,
        anotacoes: evolucao.anotacoes,
        dentes_afetados: evolucao.dentes_afetados,
        dentes_observacoes: evolucao.dentes_observacoes,
        status: 'concluida',
      });
      if (error) throw error;

      await supabase
        .from('agendamentos')
        .update({ status: 'realizado' })
        .eq('id', agendamentoId);

      setSaved(true);
      setTimeout(() => router.push(`/dashboard/pacientes/${paciente.id}`), 1800);
    } catch (err) {
      console.error('[consulta] salvar ficha:', err);
      setIsSaving(false);
    }
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

        <div className="w-24" />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Coluna esquerda: Briefing + dados do paciente ─────────────── */}
        <aside className="w-80 shrink-0 border-r border-border bg-surface overflow-y-auto flex flex-col">

          {/* Paciente */}
          <div className="p-5 border-b border-border">
            <div className="font-heading text-xl text-text-primary mb-0.5">{paciente.nome}</div>
            {paciente.idadeStr && (
              <div className="text-xs text-text-secondary font-medium">{paciente.idadeStr}</div>
            )}
            {procedimento && (
              <div className="mt-2 text-xs bg-teal-pale text-teal px-2.5 py-1 rounded-lg font-semibold w-fit">
                {procedimento}
              </div>
            )}
          </div>

          {/* Última consulta */}
          {(ultimaQueixa || ultimasAnotacoes) && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Última consulta</span>
              </div>
              {ultimaQueixa && (
                <p className="text-xs font-semibold text-text-primary mb-1">{ultimaQueixa}</p>
              )}
              {ultimasAnotacoes && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">{ultimasAnotacoes}</p>
              )}
            </div>
          )}

          {/* Briefing DEX */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#2f9c85' }}>
                <Bot className="w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] font-bold text-teal uppercase tracking-widest flex items-center gap-1">
                Briefing DEX
                {!briefingLoading && briefing && <Sparkles className="w-3 h-3" />}
              </span>
            </div>
            {briefingLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-secondary py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Gerando briefing...
              </div>
            ) : briefing ? (
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{briefing}</p>
            ) : (
              <p className="text-xs text-text-secondary italic">Não foi possível gerar o briefing.</p>
            )}
          </div>

          {/* Motivo da consulta */}
          {observacoesAgendamento && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Motivo</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{observacoesAgendamento}</p>
            </div>
          )}

          {/* Observações do paciente */}
          {paciente.observacoes && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Observações</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{paciente.observacoes}</p>
            </div>
          )}

          {/* Histórico de fichas */}
          <div className="p-4 border-b border-border">
            <button
              onClick={() => setFichasExpanded(v => !v)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Histórico ({fichas.length})
                </span>
              </div>
              {fichasExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-text-secondary" />
                : <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />}
            </button>
            <AnimatePresence>
              {fichasExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    {fichas.length === 0 && (
                      <p className="text-xs text-text-secondary italic">Nenhuma consulta anterior.</p>
                    )}
                    {fichas.map((f, i) => (
                      <div key={i} className="bg-surface-alt rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-text-secondary">{f.data}</span>
                          {f.dentes.length > 0 && (
                            <span className="text-[10px] font-mono text-teal">{f.dentes.join(', ')}</span>
                          )}
                        </div>
                        {f.queixa && <p className="text-xs font-semibold text-text-primary mb-0.5">{f.queixa}</p>}
                        {f.anotacoes && <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{f.anotacoes}</p>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Orçamentos */}
          {orcamentos.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Orçamentos</span>
              </div>
              <div className="space-y-2">
                {orcamentos.map((o, i) => (
                  <div key={i} className="bg-surface-alt rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-bold text-text-primary">
                        R$ {o.total.toFixed(2).replace('.', ',')}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        o.status === 'aprovado' ? 'bg-teal-pale text-teal' : 'bg-surface-alt text-text-secondary border border-border'
                      }`}>
                        {o.status}
                      </span>
                    </div>
                    {o.itens.length > 0 && (
                      <p className="text-xs text-text-secondary line-clamp-2">{o.itens.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Coluna direita: Escrita livre / Evolução ──────────────────── */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto">
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

                {/* Salvar */}
                <button
                  onClick={() => void handleSalvar()}
                  disabled={isSaving}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ background: '#2f9c85', color: '#fff', boxShadow: '0 4px 16px rgba(47,156,133,0.35)' }}
                >
                  {isSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                    : <><Check className="w-4 h-4" /> Salvar na ficha clínica</>
                  }
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
