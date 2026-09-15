import { notFound } from 'next/navigation';
import { requireOwnerWorkspace } from '@/server/clinica/page-context';
import { FinanceiroContent } from '@/app/dashboard/financeiro/_components/financeiro-content';
export default async function MeusResultadosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { context } = await requireOwnerWorkspace();
  if (!context.dentistaId) notFound();
  return <FinanceiroContent searchParamsPromise={searchParams} basePath="/clinica/meus-resultados" />;
}
