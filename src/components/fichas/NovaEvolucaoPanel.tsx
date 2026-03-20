'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Plus, X, Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ARCADA_SUPERIOR, ARCADA_INFERIOR } from '@/app/dashboard/fichas/[id]/_components/ficha-helpers';
import { criarFichaInline } from '@/app/dashboard/pacientes/[id]/actions';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const TIPOS_CONSULTA = [
  'Consulta de rotina',
  'Urgência / dor',
  'Retorno',
  'Procedimento',
  'Avaliação inicial',
  'Outro',
];

interface Props {
  patientId: string;
  onClose?: () => void;
  onSaved?: (fichaId: string) => void;
}

function formatTimer(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function NovaEvolucaoPanel({ patientId, onClose, onSaved }: Props): React.JSX.Element {
  const router = useRouter();
  const [tipo, setTipo] = useState(TIPOS_CONSULTA[0]);
  const [observacoes, setObservacoes] = useState('');
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);

  const { status: recStatus, timer, startRecording, stopRecording } = useAudioRecorder();
  const isGravando = recStatus === 'recording';
  const isProcessando = recStatus === 'processing' || transcrevendo;

  function toggleDente(dente: string): void {
    setDentesSelecionados((prev) =>
      prev.includes(dente) ? prev.filter((d) => d !== dente) : [...prev, dente]
    );
  }

  async function handleToggleGravacao(): Promise<void> {
    if (isGravando) {
      const blob = await stopRecording();
      if (!blob) { toast.error('Erro ao capturar o áudio'); return; }
      setTranscrevendo(true);
      try {
        const fd = new FormData();
        fd.append('audio', new File([blob], 'audio.webm', { type: blob.type }));
        const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
        const data = await res.json() as { transcricao?: string; error?: string };
        if (data.error) { toast.error(data.error); }
        else if (data.transcricao) {
          setObservacoes((prev) => (prev ? `${prev}\n${data.transcricao}` : (data.transcricao ?? '')));
          toast.success('Transcrição concluída');
        }
      } catch { toast.error('Erro ao transcrever'); }
      finally { setTranscrevendo(false); }
    } else {
      await startRecording();
    }
  }

  async function handleSalvar(): Promise<void> {
    if (!observacoes.trim() && dentesSelecionados.length === 0) {
      toast.error('Preencha ao menos o tipo ou observações');
      return;
    }
    setSalvando(true);
    const result = await criarFichaInline({
      pacienteId: patientId,
      queixaPrincipal: tipo,
      anotacoes: observacoes,
      dentesAfetados: dentesSelecionados,
    });
    setSalvando(false);
    if (result.error) {
      toast.error('Erro ao criar ficha');
    } else {
      toast.success('Ficha criada!');
      if (onSaved && result.id) onSaved(result.id);
      router.refresh();
    }
  }

  const inputClass =
    'w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors';

  function renderArcada(dentes: readonly string[]): React.JSX.Element {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {dentes.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDente(d)}
            className={`w-8 h-8 flex items-center justify-center rounded border text-xs font-mono font-medium transition-colors ${
              dentesSelecionados.includes(d)
                ? 'border-teal bg-teal text-white'
                : 'border-border bg-surface-alt text-text-secondary hover:border-teal/50 hover:text-text-primary'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-surface rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface-alt/40">
        <div>
          <p className="font-sans text-sm font-semibold text-text-primary">Nova Evolução Clínica</p>
          <p className="font-sans text-xs text-text-secondary mt-0.5">Registre a consulta atual</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão gravar */}
          <button
            type="button"
            onClick={handleToggleGravacao}
            disabled={isProcessando && !isGravando}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              isGravando
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : isProcessando
                ? 'bg-surface-alt text-text-secondary cursor-not-allowed'
                : 'bg-teal/10 text-teal hover:bg-teal/20'
            }`}
          >
            {isProcessando && !isGravando ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Transcrevendo…</>
            ) : isGravando ? (
              <><Square className="w-3.5 h-3.5 fill-current" />{formatTimer(timer)}</>
            ) : (
              <><Mic className="w-3.5 h-3.5" />Gravar voz</>
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Coluna esquerda — campos */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Tipo de consulta</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
              {TIPOS_CONSULTA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
              Observações / Evolução
              {isGravando && <span className="text-red-500 animate-pulse">● Gravando…</span>}
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={isProcessando ? 'Transcrevendo áudio…' : 'Descreva a evolução clínica, procedimentos realizados…'}
              rows={6}
              disabled={isProcessando}
              className={inputClass + ' resize-none disabled:opacity-60'}
            />
          </div>

          {dentesSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...dentesSelecionados].sort((a, b) => Number(a) - Number(b)).map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-0.5 font-mono text-xs text-teal">
                  {d}
                  <button type="button" onClick={() => toggleDente(d)}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            {onClose && (
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              {salvando ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando…</>
              ) : (
                <><Plus className="w-3.5 h-3.5" />Salvar Ficha</>
              )}
            </button>
          </div>
        </div>

        {/* Coluna direita — odontograma */}
        <div className="p-5 space-y-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary text-center">
            Odontograma ISO
          </p>
          <div className="space-y-2">
            <p className="text-center font-mono text-[0.6rem] text-text-muted">Arcada Superior</p>
            {renderArcada(ARCADA_SUPERIOR)}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[0.6rem] text-text-secondary">↑ sup · inf ↓</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {renderArcada(ARCADA_INFERIOR)}
            <p className="text-center font-mono text-[0.6rem] text-text-muted">Arcada Inferior</p>
          </div>
          {dentesSelecionados.length === 0 && (
            <p className="text-center font-sans text-xs text-text-muted pt-1">
              Clique nos dentes para marcar
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
