import { DashboardSkeleton } from './_components/dentista-dashboard';
import { PageContainer } from '@/components/layout/page-container';

// Exibido durante a navegação para /dashboard enquanto os dados carregam
export default function DashboardLoading() {
  return (
    <PageContainer variant="wide">
      <DashboardSkeleton />
    </PageContainer>
  );
}
