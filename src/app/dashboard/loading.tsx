import { DashboardSkeleton } from './_components/dentista-dashboard';

// Exibido durante a navegação para /dashboard enquanto os dados carregam
export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
      <DashboardSkeleton />
    </div>
  );
}
