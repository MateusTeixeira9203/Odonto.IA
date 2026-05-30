'use client';

import { useEffect, useRef, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onClear?: () => void;
  padRef: React.MutableRefObject<SignaturePadLib | null>;
}

export function SignaturePad({ onClear, padRef }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !padRef.current) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
    padRef.current.clear();
  }, [padRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#0d0d0d',
      minWidth: 1.5,
      maxWidth: 3,
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      padRef.current?.off();
    };
  }, [padRef, resizeCanvas]);

  const handleClear = () => {
    padRef.current?.clear();
    onClear?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl border-2 border-border bg-white overflow-hidden"
        style={{ height: 220 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
        />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="w-32 h-px bg-border/60" />
        </div>
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors self-start px-1"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Limpar
      </button>
    </div>
  );
}
