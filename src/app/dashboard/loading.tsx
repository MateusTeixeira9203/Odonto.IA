import { DashboardSkeleton } from './_components/dentista-dashboard';

// Exibido durante a navegação para /dashboard enquanto os dados carregam
export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      {/* Skeleton do header */}
      <div className="flex items-center justify-between mb-10 animate-pulse">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-surface-alt rounded-xl" />
          <div className="h-4 w-72 bg-surface-alt rounded" />
        </div>
        <div className="hidden sm:block h-10 w-40 bg-surface-alt rounded-2xl" />
      </div>

      {/* Skeleton do conteúdo — assume SOLO (4 cards) como fallback conservador */}
      <DashboardSkeleton canEdit={true} />
    </div>
  );
}
