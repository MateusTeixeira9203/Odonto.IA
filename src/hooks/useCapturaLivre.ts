'use client';

// Orquestração de voz/transcrição/detecção ao vivo da captura livre — extraído do
// consulta-client (Job A Fatia B, §5/§7) pra reusar no campo mágico do FichasTab.
// Extração behavior-preserving: mesma lógica, mesmos endpoints, mesmos gates.

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useAudioRecorder, type RecorderStatus } from '@/hooks/useAudioRecorder';
import { denteLabel } from '@/lib/arcadas';

export interface UseCapturaLivreOptions {
  /** Nome do paciente — reservado pelo contrato da spec; nenhuma rota consumida
   *  pelo hook hoje (transcrever/detectar-consulta) aceita esse campo. */
  pacienteNome?: string;
  /** Desliga a detecção ao vivo (perfil demo / consulta demo não têm clínica real,
   *  ou fase da consulta que não é mais captura). Default true. */
  liveDetection?: boolean;
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
  detectedProcs: string[];
  isDetecting: boolean;
}

export function useCapturaLivre(options: UseCapturaLivreOptions = {}): UseCapturaLivreReturn {
  const { liveDetection = true } = options;

  const [texto, setTexto] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [detectedProcs, setDetectedProcs] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      const novoTexto = data.transcricao?.trim();
      if (novoTexto) {
        setLiveTranscript(novoTexto);
        setTexto(prev => prev ? `${prev}\n${novoTexto}` : novoTexto);
      }
    } catch (err) {
      console.error('[useCapturaLivre] transcrever:', err);
      toast.error('Não foi possível transcrever o áudio. Tente novamente.');
    } finally { setIsTranscribing(false); }
  }, []);

  const { status: micStatus, startRecording, stopRecording } = useAudioRecorder({
    onAutoStop: (blob) => { void processarAudio(blob); },
  });

  // Detecção ao vivo de procedimentos enquanto o dentista escreve.
  useEffect(() => {
    if (!liveDetection) { setDetectedProcs([]); setIsDetecting(false); return; }

    const t = texto.trim();
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    if (t.length < 20) { setDetectedProcs([]); setIsDetecting(false); return; }

    setIsDetecting(true);
    detectDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/dex/detectar-consulta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: t }),
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
        console.error('[useCapturaLivre] detecção ao vivo:', err);
      } finally {
        setIsDetecting(false);
      }
    }, 2000);

    return () => { if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current); };
  }, [texto, liveDetection]);

  // Cleanup do timer ao desmontar.
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const toggleVoz = useCallback(async () => {
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
      // Só inicia o timer após confirmar que a gravação começou.
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
  }, [micStatus, startRecording, stopRecording, processarAudio]);

  return {
    texto,
    setTexto,
    toggleVoz,
    micStatus,
    isTranscribing,
    liveTranscript,
    elapsedSeconds,
    detectedProcs,
    isDetecting,
  };
}
