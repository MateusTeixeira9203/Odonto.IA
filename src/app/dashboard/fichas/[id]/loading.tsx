import { Skeleton } from "@/components/ui/skeleton";

export default function FichaLoading(): React.JSX.Element {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-20 rounded-[3px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Layout duas colunas: 280px | 1fr */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "280px 1fr" }}>
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Card Paciente */}
          <div className="rounded border border-border bg-surface p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-full rounded-[3px]" />
          </div>

          {/* Card Ficha */}
          <div className="rounded border border-border bg-surface p-5 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-9 w-full rounded-[3px]" />
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          {/* Tabs skeleton */}
          <div className="flex gap-1 border-b border-border pb-0">
            <Skeleton className="h-9 w-20 rounded-t-[3px]" />
            <Skeleton className="h-9 w-24 rounded-t-[3px]" />
            <Skeleton className="h-9 w-24 rounded-t-[3px]" />
          </div>

          {/* Seção gravação */}
          <div className="rounded border border-border bg-surface p-5 space-y-4">
            <Skeleton className="h-3 w-32" />
            <div className="flex flex-col items-center gap-3 py-4">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>

          {/* Seção documentos */}
          <div className="rounded border border-border bg-surface p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-20 w-full rounded-[3px]" />
          </div>

          {/* Seção transcrição */}
          <div className="rounded border border-border bg-surface p-5 space-y-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-36 w-full rounded-[3px]" />
            <Skeleton className="h-10 w-full rounded-[3px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
