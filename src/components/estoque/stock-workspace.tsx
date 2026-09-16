'use client';

import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StockAccessContext } from '@/server/estoque/access';
import type { MovimentoResumo } from '@/server/estoque/contracts';
import { StockForm, stockSelectClass } from './stock-form';
import { StockDetail } from './stock-detail';
import type { StockMutation, StockPorts } from './stock-ports';
import { useStockData, type StockFilter } from './use-stock-data';
import { compareStockQuantity, formatStockQuantity } from './stock-format';
import { StockKitsPanel } from './stock-kits-panel';

export function StockWorkspace({ initialContext, ports }: { initialContext: StockAccessContext; ports: StockPorts }) {
  const stock = useStockData(initialContext, ports);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<{ action: StockMutation; movement?: MovimentoResumo } | null>(null);
  const [notice, setNotice] = useState('');
  const permissions = stock.scope === 'dentista' ? stock.context.permissoesPessoais : stock.context.permissoesCompartilhadas;
  const scopeName = stock.scope === 'dentista' ? 'Meu estoque' : 'Materiais da clínica';

  return <div>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-heading text-2xl font-bold text-foreground">Estoque</h2><p className="mt-1 text-sm text-muted-foreground">Materiais sob seus cuidados, com cada movimentação registrada.</p></div>
      {permissions.includes('estoque.gerir') && <Button className="min-h-11" onClick={() => setForm({ action: 'cadastrarItem' })}>Novo material</Button>}
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Origem dos materiais">
      {stock.context.dentistaId && <Button variant="outline" className={cn('min-h-11', stock.scope === 'dentista' && 'bg-muted font-semibold')} aria-pressed={stock.scope === 'dentista'} onClick={() => stock.changeScope('dentista')}>Meu estoque</Button>}
      <Button variant="outline" className={cn('min-h-11', stock.scope === 'clinica' && 'bg-muted font-semibold')} aria-pressed={stock.scope === 'clinica'} onClick={() => stock.changeScope('clinica')}>Materiais da clínica</Button>
    </div>
    <form className="my-5 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); stock.closeDetail(); stock.setQuery({ ...stock.query, busca: search }); }}>
      <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar material</span><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input className="min-h-11 pl-10" value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar material" /></label>
      <select aria-label="Filtrar materiais" className={cn(stockSelectClass, 'sm:w-auto')} value={stock.query.filtro} onChange={(e) => { stock.closeDetail(); stock.setQuery({ ...stock.query, filtro: e.target.value as StockFilter }); }}>
        <option value="todos">Todos os materiais</option><option value="baixo">Estoque baixo</option><option value="validade">Próximos do vencimento</option><option value="divergente">Saldo divergente</option><option value="arquivados">Arquivados</option>
      </select><Button type="submit" variant="outline" className="min-h-11" disabled={stock.loading}>Buscar</Button>
    </form>
    <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p>
    {stock.error ? <section role="alert" className="rounded-2xl border border-border bg-card p-6"><p>{stock.error}</p><Button className="mt-4 min-h-11" variant="outline" onClick={() => void stock.load()}>Tentar novamente</Button></section>
      : <section aria-label={`${scopeName}: materiais`} aria-busy={stock.loading} className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_170px_24px] gap-4 bg-muted px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"><span>Material</span><span className="text-right">Saldo</span><span>Situação</span><span /></div>
        {stock.loading && !stock.list ? <div role="status" aria-label="Carregando materiais" className="space-y-4 p-5">{[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />)}</div>
          : !stock.list?.itens.length ? <div className="p-8"><h3 className="font-semibold">{stock.query.busca || stock.query.filtro !== 'todos' ? 'Nenhum material encontrado' : 'Nenhum material neste estoque'}</h3><p className="mt-2 text-sm text-muted-foreground">{stock.query.busca || stock.query.filtro !== 'todos' ? 'Ajuste a busca ou o filtro para consultar outros materiais.' : permissions.includes('estoque.gerir') ? 'Cadastre o primeiro material quando estiver pronto para começar a registrar o estoque.' : 'Os materiais disponíveis neste escopo aparecerão aqui.'}</p></div>
          : stock.list.itens.map((item) => <button key={item.id} type="button" onClick={() => void stock.openDetail(item.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border p-4 text-left last:border-b-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_120px_170px_24px] sm:gap-4 sm:p-5 motion-safe:transition-colors">
            <span className="min-w-0"><span className="block break-words font-semibold text-foreground">{item.nome}</span><span className="mt-1 block text-xs text-muted-foreground">{scopeName} · {item.unidadeBase}</span></span>
            <span className="text-right font-mono text-sm">{formatStockQuantity(item.saldo)}</span>
            <span className="col-start-1 text-sm text-muted-foreground sm:col-start-auto">{!item.ativo ? 'Arquivado' : compareStockQuantity(item.saldo, '0') < 0 ? 'Saldo divergente' : compareStockQuantity(item.saldo, item.minimo) <= 0 ? 'Estoque baixo' : 'Em estoque'}</span>
            <ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />
          </button>)}
      </section>}
    {stock.list && <div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{stock.list.total} {stock.list.total === 1 ? 'material' : 'materiais'}</p>{stock.list.proximoCursor && <Button variant="outline" className="min-h-11" disabled={stock.loading} onClick={() => void stock.load(stock.list?.proximoCursor)}>{stock.loading ? 'Carregando…' : 'Mais materiais'}</Button>}</div>}
    {stock.detailLoading && !stock.detail && <p role="status" className="mt-6 text-sm text-muted-foreground">Carregando detalhe do material…</p>}
    {stock.detailError && <section role="alert" className="mt-6 rounded-2xl border border-border bg-card p-5"><p className="text-sm text-destructive">{stock.detailError}</p>{stock.selectedItemId && <Button type="button" variant="outline" className="mt-4 min-h-11" disabled={stock.detailLoading} onClick={() => { const itemId = stock.selectedItemId; if (itemId) void stock.openDetail(itemId); }}>Tentar novamente</Button>}</section>}
    {stock.detail && <StockDetail data={stock.detail} permissions={permissions} busy={stock.detailLoading} onClose={stock.closeDetail} onAction={(action, movement) => setForm({ action, movement })} onMore={() => { if (stock.detail) void stock.openDetail(stock.detail.item.id, stock.detail.proximoCursor); }} />}
    {permissions.includes('estoque.gerir') && stock.list && <StockKitsPanel clinicaId={stock.context.clinicaId} titular={stock.titular} itens={stock.list.itens} />}
    {form && (form.action === 'cadastrarItem' || stock.detail) && <StockForm action={form.action} clinicId={stock.context.clinicaId} titular={stock.titular} item={form.action === 'cadastrarItem' ? undefined : stock.detail?.item} lots={stock.detail?.lotes ?? []} movement={form.movement} ports={ports} onClose={() => setForm(null)} onRefresh={stock.refresh} onSaved={async () => { setNotice('Registro confirmado.'); await stock.refresh(); }} />}
  </div>;
}
