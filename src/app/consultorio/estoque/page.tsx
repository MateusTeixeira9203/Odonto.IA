import { StockClient } from '@/components/estoque/stock-client';
import { getStockPageContext } from '@/server/estoque/page-context';

export const metadata = { title: 'Estoque · Minha Clínica · Odonto.IA' };

export default async function NonClinicalStockPage(): Promise<React.JSX.Element> {
  const context = await getStockPageContext();
  return context.ok
    ? <StockClient context={context.data} />
    : <section role="alert" className="rounded-2xl border border-border bg-card p-6"><h1 className="font-heading text-2xl">Estoque indisponível</h1><p className="mt-2 text-sm text-muted-foreground">{context.mensagem}</p></section>
  ;
}
