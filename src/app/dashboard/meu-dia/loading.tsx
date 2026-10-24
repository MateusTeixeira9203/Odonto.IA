// OD-001b — skeleton da mesma superfície e dos mesmos breakpoints da página.

import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/page-container';

export default function MeuDiaLoading(): React.JSX.Element {
  return (
    <PageContainer variant="wide" className="max-w-[1800px]! px-[30px]! py-6! max-[600px]:px-2.5! max-[600px]:py-[18px]!">
      <header>
        <Skeleton className="mb-2 h-3 w-16 rounded" />
        <Skeleton className="h-9 w-64 rounded" />
      </header>

      <div aria-label="Carregando o Meu Dia" role="status" className="flex min-w-0 flex-col">
        <div className="flex gap-6 overflow-hidden py-[11.25px]">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-52 shrink-0 rounded" />
          ))}
        </div>

        <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border px-6 py-[18px] max-[600px]:min-h-[114.4px] max-[600px]:justify-between min-[601px]:flex-row min-[601px]:justify-between">
            <Skeleton className="h-5 w-56 max-w-full rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="border-b border-border px-6 py-3.5">
            <Skeleton className="h-5 w-64 max-w-full rounded" />
            <Skeleton className="mt-2 h-4 w-44 rounded" />
          </div>
          <div className="grid grid-cols-1 min-[1001px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="min-w-0 px-7 py-[25px] max-[600px]:px-3.5">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="mt-[18px] h-64 rounded-lg" />
            </div>
            <div className="min-w-0 border-t border-border px-6 py-[25px] min-[1001px]:border-l min-[1001px]:border-t-0 max-[600px]:px-3.5">
              <Skeleton className="h-72 rounded-lg" />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-6 py-[20.5px] min-[601px]:flex-row min-[601px]:justify-between">
            <Skeleton className="h-10 w-48 max-w-full rounded-lg" />
            <Skeleton className="h-10 w-44 rounded-lg" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
