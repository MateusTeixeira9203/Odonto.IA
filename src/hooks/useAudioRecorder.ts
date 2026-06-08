"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderStatus = "idle" | "recording" | "processing" | "done" | "error";

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  timer: number;
  /** Inicia a gravação. Retorna true se iniciou com sucesso, false se falhou (ex: microfone negado). */
  startRecording: () => Promise<boolean>;
  /** Para a gravação e retorna o Blob do áudio */
  stopRecording: () => Promise<Blob | null>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [timer, setTimer] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Resolve pendente que `stopRecording` aguarda
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Limpa o intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (status === "recording") return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Tenta o codec ideal; cai para padrão do browser se não suportado
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
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

      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [status]);

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
