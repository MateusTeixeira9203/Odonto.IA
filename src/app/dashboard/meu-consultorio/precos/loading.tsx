import { PageContainer } from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';

export default function PrecosLoading() {
  return (
    <PageContainer variant="wide">
      <div role="status" aria-label="Carregando preços" className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </PageContainer>
  );
}
