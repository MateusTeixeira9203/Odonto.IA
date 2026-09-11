'use client';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';

export default function PrecosError({ reset }: { reset: () => void }) {
  return (
    <PageContainer variant="wide">
      <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-6 text-foreground">
        <h1 className="font-heading text-2xl">Não foi possível carregar seus preços</h1>
        <p className="text-sm text-muted-foreground">Tente novamente para consultar seu catálogo.</p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </PageContainer>
  );
}
