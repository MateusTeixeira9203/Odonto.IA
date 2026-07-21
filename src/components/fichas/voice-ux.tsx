'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Loader2, MicOff } from 'lucide-react';

function WaveBar({ delay }: { delay: number }) {
  return (
    <motion.div
      className="w-[3px] rounded-full bg-teal"
      animate={{ height: ['4px', '22px', '8px', '18px', '4px'], opacity: [0.5, 1, 0.65, 1, 0.5] }}
      transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

interface VoiceUXProps {
  isRecording: boolean;
  isTranscribing: boolean;
  liveTranscript: string;
  elapsedSeconds: number;
  onStop: () => void;
}

export function VoiceUX({ isRecording, isTranscribing, liveTranscript, elapsedSeconds, onStop }: VoiceUXProps) {
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AnimatePresence>
      {(isRecording || isTranscribing) && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <div
            className="rounded-3xl p-5 shadow-2xl"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(47,156,133,0.25)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(47,156,133,0.08)',
            }}
          >
            {/* Dex + waveform + timer */}
            <div className="flex items-center gap-3 mb-3">
              {/* Dex pulsando */}
              <motion.div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #2f9c85, #1d7a68)' }}
                animate={isRecording ? {
                  boxShadow: [
                    '0 0 0 0 rgba(47,156,133,0.5)',
                    '0 0 0 10px rgba(47,156,133,0)',
                    '0 0 0 0 rgba(47,156,133,0)',
                  ],
                } : {}}
                transition={{ duration: 1.0, repeat: Infinity }}
              >
                D
              </motion.div>

              {/* Waveform */}
              <div className="flex items-center gap-[3px] flex-1 h-6">
                {isRecording
                  ? Array.from({ length: 9 }).map((_, i) => <WaveBar key={i} delay={i * 0.08} />)
                  : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-teal animate-spin" />
                      <span className="text-xs text-text-secondary">Transcrevendo...</span>
                    </div>
                  )
                }
              </div>

              {/* Timer */}
              {isRecording && (
                <span className="font-mono text-sm font-bold text-teal shrink-0">
                  {fmt(elapsedSeconds)}
                </span>
              )}
            </div>

            {/* Badge ESCUTANDO */}
            {isRecording && (
              <div className="flex items-center gap-2 mb-3">
                <motion.div
                  className="w-2 h-2 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 0.65, repeat: Infinity }}
                />
                <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest">
                  Escutando
                </span>
              </div>
            )}

            {/* Live transcript */}
            {liveTranscript && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3 italic pl-1 border-l-2 border-teal/30">
                {liveTranscript}
              </p>
            )}

            {/* Botão parar */}
            {isRecording && (
              <button
                onClick={onStop}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                }}
              >
                <MicOff className="w-4 h-4" />
                Parar gravação
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
