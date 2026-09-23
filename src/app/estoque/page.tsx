import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';
import { StockClient } from '@/components/estoque/stock-client';
import { getStockPageContext } from '@/server/estoque/page-context';

export const metadata = { title: 'Estoque da clínica · Odonto.IA' };
export default async function SharedStockPage() {
  const context = await getStockPageContext();
  return <main className="min-h-dvh bg-background text-foreground"><PageContainer variant="wide">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1 className="font-heading text-3xl font-bold md:text-4xl">Minha Clínica</h1><Link className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href={context.ok && context.data.dentistaId ? '/dashboard/meu-consultorio/estoque' : '/consultorio'}>Voltar</Link></header>
    {context.ok ? <StockClient context={context.data} /> : <p role="alert">{context.mensagem}</p>}
  </PageContainer></main>;
}
