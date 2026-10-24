'use client';

// R-46g (D6) — a rota vira a porta principal; erro de query não pode mais renderizar como
// "dia vazio" (I5). Escopo de rota (não full-page como app/error.tsx) — a shell do
// dashboard (sidebar, header) continua de pé ao redor.
// C1 — mesmo `PageContainer variant="wide"` de page.tsx/loading.tsx; o cartão de erro em
// si continua estreito e centralizado.

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function MeuDiaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[meu-dia/error]', error);
  }, [error]);

  return (
    <PageContainer variant="wide" className="max-w-[1800px]! px-[30px]! py-6! max-[600px]:px-2.5! max-[600px]:py-[18px]!">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[12px] border border-border bg-surface px-6 py-[25px] text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-pale border border-coral/20">
          <AlertTriangle className="h-7 w-7 text-coral" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-heading text-lg font-semibold text-text-primary">
            Não deu pra carregar o seu dia
          </h1>
          <p className="text-sm text-text-secondary">
            Tente de novo — se persistir, avise a equipe.
          </p>
        </div>
        <Button onClick={reset} size="sm">
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    </PageContainer>
  );
}
