"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderStatus = "idle" | "recording" | "processing" | "done" | "error";

// ── Corte automático por silêncio (spec fase1-5 §B) ──────────────────────────
// Depois de detectar fala, ~4s de silêncio contínuo param a gravação sozinhos
// (dentista de luva não precisa tocar na tela). Nunca re-inicia sozinho — sem
// microfone sempre-aberto por decisão de privacidade do consultório.
const SILENCE_MS = 4_000;
// RMS normalizado (0-1). Fala fica tipicamente em 0.05-0.3; ruído de sala ~0.005-0.02.
// Calibrado empiricamente — consultório muito barulhento pode desligar via flag.
const SILENCE_RMS_THRESHOLD = 0.02;
const MONITOR_INTERVAL_MS = 100;
// 32kbps é sobra pra voz (Whisper) e mantém 10min de áudio em ~2,4MB — folga
// contra o limite de 4,5MB de upload da Vercel (spec fase1-5 §B).
const AUDIO_BITS_PER_SECOND = 32_000;

interface UseAudioRecorderOptions {
  /** Chamado quando a gravação para sozinha por silêncio (blob pronto pra transcrever). */
  onAutoStop?: (blob: Blob | null) => void;
  /** Desliga o corte automático por silêncio (default: ligado). */
  silenceAutoStop?: boolean;
}

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  timer: number;
  /** Inicia a gravação. Retorna true se iniciou com sucesso, false se falhou (ex: microfone negado). */
  startRecording: () => Promise<boolean>;
  /** Para a gravação e retorna o Blob do áudio */
  stopRecording: () => Promise<Blob | null>;
}

export function useAudioRecorder(options?: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [timer, setTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Resolve pendente que `stopRecording` aguarda
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);
  // Monitor de silêncio
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest-ref: callbacks sempre atuais sem re-criar a gravação
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const limparMonitor = useCallback(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Limpa intervalos e AudioContext ao desmontar
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      limparMonitor();
    };
  }, [limparMonitor]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (status === "recording") return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Tenta o codec ideal; cai para padrão do browser se não suportado
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Para todas as tracks do microfone
        stream.getTracks().forEach((t) => t.stop());
        limparMonitor();

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Resolve a promise que stopRecording está aguardando
        if (resolveStopRef.current) {
          resolveStopRef.current(blob);
          resolveStopRef.current = null;
        }

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setTimer(0);
        setStatus("done");
      };

      recorder.onerror = () => {
        limparMonitor();
        setStatus("error");
        if (resolveStopRef.current) {
          resolveStopRef.current(null);
          resolveStopRef.current = null;
        }
      };

      recorder.start(250); // coleta chunks a cada 250ms
      setStatus("recording");
      setTimer(0);

      // Timer em segundos
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);

      // ── Monitor de silêncio ──
      if (optionsRef.current?.silenceAutoStop !== false) {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const amostra = new Uint8Array(analyser.fftSize);

        let houveFala = false;
        let ultimoSomEm = Date.now();

        monitorIntervalRef.current = setInterval(() => {
          if (recorder.state !== "recording") return;
          analyser.getByteTimeDomainData(amostra);
          let somaQuadrados = 0;
          for (const v of amostra) {
            const norm = (v - 128) / 128;
            somaQuadrados += norm * norm;
          }
          const rms = Math.sqrt(somaQuadrados / amostra.length);

          if (rms >= SILENCE_RMS_THRESHOLD) {
            houveFala = true;
            ultimoSomEm = Date.now();
            return;
          }
          if (houveFala && Date.now() - ultimoSomEm >= SILENCE_MS) {
            // Auto-stop: reusa o mesmo caminho do stop manual; blob sai via onAutoStop.
            if (monitorIntervalRef.current) {
              clearInterval(monitorIntervalRef.current);
              monitorIntervalRef.current = null;
            }
            resolveStopRef.current = (blob) => optionsRef.current?.onAutoStop?.(blob);
            setStatus("processing");
            recorder.stop();
          }
        }, MONITOR_INTERVAL_MS);
      }

      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [status, limparMonitor]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      setStatus("processing");
      resolveStopRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { status, timer, startRecording, stopRecording };
}
