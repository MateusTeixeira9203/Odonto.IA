'use client';

// Campo mágico do perfil (Job A Fatia B, §8): relato livre (digitado, colado ou
// ditado) + anexo (áudio/pdf/docx/txt) → "Organizar com Dex" → preenche o form
// existente. Não salva nada — quem salva é o FichasTab, dono do formData.

import { useRef, useState } from 'react';
import { Mic, MicOff, Paperclip, Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useCapturaLivre } from '@/hooks/useCapturaLivre';
import { VoiceUX } from './voice-ux';
import { DexAvatar } from '@/components/ui/dex-avatar';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';

const AUDIO_EXTS = ['mp3', 'm4a', 'opus', 'wav', 'webm', 'ogg'];
const DOC_EXTS = ['pdf', 'docx', 'doc', 'txt'];

// Etapas do feedback progressivo — mesmo texto/timing do modo consulta (§8).
const ETAPAS = [
  { ms: 0,    label: 'Analisando queixa...' },
  { ms: 1800, label: 'Identificando dentes...' },
  { ms: 3800, label: 'Gerando conduta...' },
  { ms: 6500, label: 'Finalizando ficha...' },
] as const;

export interface CapturaLivreCardProps {
  pacienteNome: string;
  /** Form já tem conteúdo? Gate de confirmação antes de sobrescrever (§8 fluxo, passo 4). */
  formDirty: boolean;
  onOrganizado: (evolucao: EvolucaoFormatada) => void;
}

export function CapturaLivreCard({ pacienteNome, formDirty, onOrganizado }: CapturaLivreCardProps) {
  const {
    texto,
    setTexto,
    toggleVoz,
    micStatus,
    isTranscribing,
    liveTranscript,
    elapsedSeconds,
    detectedProcs,
    isDetecting,
  } = useCapturaLivre({ pacienteNome });

  const [isOrganizando, setIsOrganizando] = useState(false);
  const [organizarLabel, setOrganizarLabel] = useState('Organizar com Dex');
  const [processandoArquivo, setProcessandoArquivo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleOrganizar = async () => {
    const relato = texto.trim();
    if (!relato) return;
    // §8 passo 4 — form já preenchido pede confirmação antes de sobrescrever.
    if (formDirty && !window.confirm('Substituir o que já está no formulário?')) return;

    setIsOrganizando(true);
    setOrganizarLabel(ETAPAS[0].label);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = ETAPAS.slice(1).map(({ ms, label }) => setTimeout(() => setOrganizarLabel(label), ms));

    try {
      const res = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: relato, pacienteNome }),
      });
      const data = await res.json() as EvolucaoFormatada & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
      onOrganizado(data);
    } catch (err) {
      console.error('[captura-livre] formatar-evolucao:', err);
      toast.error('O Dex não conseguiu organizar as anotações. Tente novamente.');
    } finally {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setIsOrganizando(false);
      setOrganizarLabel('Organizar com Dex');
    }
  };

  const handleArquivo = async (file: File) => {
    setProcessandoArquivo(file.name);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const isAudio = file.type.startsWith('audio/') || AUDIO_EXTS.includes(ext);

      if (isAudio) {
        const fd = new FormData();
        fd.append('audio', file);
        const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
        const data = await res.json() as { transcricao?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao transcrever o áudio.');
        if (data.transcricao) {
          const novo = data.transcricao;
          setTexto(prev => prev ? `${prev}\n${novo}` : novo);
        }
      } else if (DOC_EXTS.includes(ext)) {
        const fd = new FormData();
        fd.append('arquivo', file);
        const res = await fetch('/api/extrair-texto', { method: 'POST', body: fd });
        const data = await res.json() as { texto?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao extrair texto do arquivo.');
        if (data.texto) {
          const novo = data.texto;
          setTexto(prev => prev ? `${prev}\n${novo}` : novo);
        }
      } else {
        throw new Error('Formato não suportado. Envie áudio, .pdf, .docx, .doc ou .txt.');
      }
    } catch (err) {
      console.error('[captura-livre] anexo:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
    } finally {
      setProcessandoArquivo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-teal/30 bg-surface-alt/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <DexAvatar size={18} animated={isDetecting || isOrganizando} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-teal-ink">Campo mágico</span>
        <span className="text-xs text-text-secondary ml-1">Fale, cole ou anexe — o Dex monta a ficha</span>
      </div>

      {/* Detecção ao vivo */}
      <AnimatePresence>
        {texto.length > 20 && (detectedProcs.length > 0 || isDetecting) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {detectedProcs.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border bg-teal/10 border-teal/25 text-teal-ink"
                >
                  {p}
                </span>
              ))}
              {detectedProcs.length === 0 && isDetecting && (
                <span className="text-[11px] text-text-secondary italic">Analisando o relato…</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex: Paciente relatou dor no dente 36, fiz restauração com resina composta. Orientei sobre cuidados pós-procedimento."
        className="w-full px-4 py-3 text-sm leading-relaxed resize-none outline-none bg-transparent text-text-primary placeholder:text-text-secondary/50 min-h-[100px]"
      />

      {processandoArquivo && (
        <div className="flex items-center gap-2 px-4 pb-2 text-xs text-text-secondary">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-ink" />
          Processando {processandoArquivo}...
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleVoz()}
            disabled={isTranscribing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              micStatus === 'recording'
                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                : 'bg-teal/10 text-teal-ink hover:bg-teal/20'
            }`}
          >
            {micStatus === 'recording' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {micStatus === 'recording' ? 'Parar' : 'Gravar voz'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleArquivo(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processandoArquivo !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Anexar
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleOrganizar()}
          disabled={!texto.trim() || isOrganizando}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal hover:bg-teal-lt text-white text-sm font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(47,156,133,0.3)]"
        >
          {isOrganizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {isOrganizando ? organizarLabel : 'Organizar com Dex'}
        </button>
      </div>

      <VoiceUX
        isRecording={micStatus === 'recording'}
        isTranscribing={isTranscribing}
        liveTranscript={liveTranscript}
        elapsedSeconds={elapsedSeconds}
        onStop={() => void toggleVoz()}
      />
    </div>
  );
}
