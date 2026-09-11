import { FinanceiroContent } from '@/app/dashboard/financeiro/_components/financeiro-content';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';

export const metadata = { title: 'Financeiro · Meu Consultório · Odonto.IA' };

export default async function ConsultorioFinanceiroPage({ searchParams }: {
  searchParams: Promise<{ mes?: string; dentista?: string }>;
}) {
  await requirePersonalConsultorio();
  return (
    <FinanceiroContent
      searchParamsPromise={searchParams}
      basePath="/dashboard/meu-consultorio/financeiro"
    />
  );
}
