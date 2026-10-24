'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';

export default function DashboardError({ retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <PageContainer variant="tela">
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[12px] border border-border bg-surface px-6 py-[25px] text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-coral-pale">
          <AlertTriangle className="h-7 w-7 text-coral-ink" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-heading text-[18px] font-normal text-text-primary">Não deu pra carregar o Início</h1>
          <p className="text-[13px] text-text-secondary">Tente de novo — se persistir, avise a equipe.</p>
        </div>
        <Button variant="outline" onClick={retry} className="h-10 rounded-[8px] border-border px-[13px] text-[13px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:ring-2 focus-visible:ring-teal/20 max-[600px]:w-full">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
        </Button>
      </div>
    </PageContainer>
  );
}
