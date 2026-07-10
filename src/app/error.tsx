'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sem error tracking (Sentry) ainda — ao menos deixa rastro no console do servidor.
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-6 shadow-lg">
          <OdontoIALogo className="w-7 h-7" />
        </div>

        <div className="bg-surface rounded-3xl border border-border shadow-sm p-10 space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-coral-pale border border-coral/20">
            <AlertTriangle className="w-8 h-8 text-coral" />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-semibold text-2xl text-text-primary">
              Algo deu errado
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Encontramos um problema ao carregar esta página. Você pode tentar
              novamente ou voltar ao início.
            </p>
            {error.digest && (
              <p className="text-text-secondary/60 text-xs font-mono pt-1">
                ref: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset} size="lg">
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </Button>
            <Button variant="outline" size="lg" render={<Link href="/dashboard" />}>
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
