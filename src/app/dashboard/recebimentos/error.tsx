'use client';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';

export default function RecebimentosError({ reset }: { reset: () => void }) {
  return (
    <PageContainer variant="wide">
      <section role="alert" className="space-y-3 rounded-xl border border-border bg-card p-6 text-foreground">
        <h1 className="font-heading text-2xl">Não foi possível carregar os recebimentos</h1>
        <p className="text-sm text-muted-foreground">Tente novamente. Nenhuma cobrança foi alterada.</p>
        <Button onClick={reset}>Tentar novamente</Button>
      </section>
    </PageContainer>
  );
}
