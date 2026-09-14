'use client';

// Orquestração de voz/transcrição/detecção ao vivo da captura livre — extraído do
// consulta-client (Job A Fatia B, §5/§7) pra reusar no campo mágico do FichasTab.
// Extração behavior-preserving: mesma lógica, mesmos endpoints, mesmos gates.

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useAudioRecorder, type RecorderStatus, type MicErro } from '@/hooks/useAudioRecorder';
import { extensaoDoMime } from '@/lib/audio-mime';
import { mensagemErroTranscricao, parseDexErrorCode, type DexErrorResponse } from '@/lib/dex/transcricao';

// R-48 §5 — mensagens que dizem a verdade: cada motivo tem o texto certo, nunca
// culpa permissão quando a permissão foi concedida (I4).
const MSG_POR_MOTIVO: Record<MicErro, string> = {
  permissao: 'Microfone bloqueado. Libere o acesso nas permissões do navegador.',
  'sem-suporte': 'Este navegador não consegue gravar áudio. Tente o Safari (iPhone/iPad) ou o Chrome atualizado.',
  hardware: 'Não foi possível acessar o microfone. Tente de novo.',
};

export interface UseCapturaLivreOptions {
  /** Nome do paciente — reservado pelo contrato da spec; nenhuma rota consumida
   *  pelo hook hoje (transcrever/detectar-consulta) aceita esse campo. */
  pacienteNome?: string;
  /** R169 — recupera um relato local antes de montar a captura. */
  textoInicial?: string;
}

export interface UseCapturaLivreReturn {
  texto: string;
  setTexto: (t: string | ((prev: string) => string)) => void;
  /** Toggle: inicia gravação (com timer) ou para e transcreve. */
  toggleVoz: () => Promise<void>;
  micStatus: RecorderStatus;
  isTranscribing: boolean;
  liveTranscript: string;
  elapsedSeconds: number;
  retryTranscription: () => Promise<void>;
  discardPendingAudio: () => void;
  hasPendingAudio: boolean;
  transcriptionError: boolean;
  silenceWarning: boolean;
  continueRecording: () => void;
}

export function useCapturaLivre(options: UseCapturaLivreOptions = {}): UseCapturaLivreReturn {
  const [texto, setTexto] = useState(() => options.textoInicial ?? '');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [hasPendingAudio, setHasPendingAudio] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingAudioRef = useRef<Blob | null>(null);
  const transcriptionInFlightRef = useRef(false);
  // Latest-ref pro mimeType negociado pelo gravador — processarAudio precisa dele (I2),
  // mas é declarado antes de useAudioRecorder existir (evita ciclo de dependência).
  const mimeTypeRef = useRef<string | null>(null);

  // Caminho único de pós-gravação: usado pelo stop manual E pelo corte por silêncio.
  const processarAudio = useCallback(async (blob: Blob | null) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!blob) { setIsTranscribing(false); return; }
    if (transcriptionInFlightRef.current) return;
    transcriptionInFlightRef.current = true;
    pendingAudioRef.current = blob;
    setHasPendingAudio(true);
    setTranscriptionError(false);
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      // R-48 (D/I2) — o nome tem que bater com o formato real do blob: o Groq infere
      // o formato pelo nome do arquivo, não pelo Content-Type do FormData.
      fd.append('audio', blob, `audio.${extensaoDoMime(blob.type || mimeTypeRef.current || '')}`);
      const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
      let data: DexErrorResponse & { transcricao?: string } = {};
      try {
        data = await res.json() as DexErrorResponse & { transcricao?: string };
      } catch {
        if (!res.ok) throw new Error(mensagemErroTranscricao(undefined, res.status));
      }
      if (!res.ok) {
        throw new Error(mensagemErroTranscricao(parseDexErrorCode(data.code), res.status));
      }
      const novoTexto = data.transcricao?.trim();
      if (!novoTexto) throw new Error('Transcrição vazia');
      setLiveTranscript(novoTexto);
      setTexto(prev => prev ? `${prev}\n${novoTexto}` : novoTexto);
      pendingAudioRef.current = null;
      setHasPendingAudio(false);
    } catch (err) {
      console.error('[useCapturaLivre] transcrever:', err);
      setTranscriptionError(true);
      toast.error(err instanceof Error ? err.message : mensagemErroTranscricao(undefined));
    } finally {
      transcriptionInFlightRef.current = false;
      setIsTranscribing(false);
    }
  }, []);

  const { status: micStatus, startRecording, stopRecording, resetError, mimeType, silenceWarning, continueRecording } = useAudioRecorder({
    onAutoStop: (blob) => { void processarAudio(blob); },
    onError: (motivo, blobParcial) => {
      // R-48 (C/D2/I3) — falha DURANTE a gravação: nunca mais silenciosa, e o áudio
      // já capturado é aproveitado em vez de descartado.
      void motivo; // sempre 'hardware' neste caminho — o texto de "meio" é o certo aqui
      if (blobParcial) {
        toast.error('A gravação falhou no meio. Transcrevendo o que deu tempo de capturar.');
        void processarAudio(blobParcial);
      } else {
        toast.error('A gravação falhou no meio e não deu tempo de capturar nada.');
      }
    },
  });

  useEffect(() => { mimeTypeRef.current = mimeType; }, [mimeType]);

  // Cleanup do timer ao desmontar.
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const toggleVoz = useCallback(async () => {
    if (micStatus === 'recording') {
      setIsTranscribing(true);
      const blob = await stopRecording();
      await processarAudio(blob);
      return;
    }

    // R-48 (B/I5) — depois de um erro, o próximo clique TENTA GRAVAR de novo em vez de
    // só repetir o toast; o texto já digitado no painel nunca é tocado aqui.
    if (micStatus === 'error') resetError();

    setElapsedSeconds(0);
    setLiveTranscript('');
    const result = await startRecording();
    if (!result.ok) {
      toast.error(MSG_POR_MOTIVO[result.motivo]);
      return;
    }
    // Só inicia o timer após confirmar que a gravação começou.
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  }, [micStatus, startRecording, stopRecording, processarAudio, resetError]);

  const retryTranscription = useCallback(async () => {
    await processarAudio(pendingAudioRef.current);
  }, [processarAudio]);

  const discardPendingAudio = useCallback(() => {
    if (transcriptionInFlightRef.current) return;
    pendingAudioRef.current = null;
    setHasPendingAudio(false);
    setTranscriptionError(false);
  }, []);

  return {
    texto,
    setTexto,
    toggleVoz,
    micStatus,
    isTranscribing,
    liveTranscript,
    elapsedSeconds,
    retryTranscription,
    discardPendingAudio,
    hasPendingAudio,
    transcriptionError,
    silenceWarning,
    continueRecording,
  };
}
