import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

export default function PacientesLoading(): React.JSX.Element {
  return (
    <PageContainer variant="wide" className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-36 rounded" />
        <Skeleton className="h-10 w-40 rounded" />
      </div>
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
