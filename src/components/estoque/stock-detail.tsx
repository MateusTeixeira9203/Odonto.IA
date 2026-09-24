'use client';

import { Button } from '@/components/ui/button';
import type { EstoqueAction } from '@/server/estoque/access';
import type { MovimentoResumo } from '@/server/estoque/contracts';
import type { StockMutation, StockPorts } from './stock-ports';
import { formatStockDate, formatStockQuantity, STOCK_UNITS } from './stock-format';

type DetailData = Extract<Awaited<ReturnType<StockPorts['detalharEstoque']>>, { ok: true }>['data'];
const ACTIONS: { action: StockMutation; permission: EstoqueAction; label: string }[] = [
  { action: 'receberMaterial', permission: 'estoque.receber', label: 'Registrar entrada' },
  { action: 'consumirMaterial', permission: 'estoque.consumir', label: 'Registrar consumo' },
  { action: 'descartarMaterial', permission: 'estoque.descartar', label: 'Descartar' },
  { action: 'ajustarContagem', permission: 'estoque.ajustar', label: 'Conferir inventário' },
  { action: 'editarItem', permission: 'estoque.gerir', label: 'Editar material' },
];
const KIND: Record<string, string> = { entrada: 'Entrada', consumo: 'Consumo', descarte: 'Descarte', ajuste: 'Contagem física', reversao: 'Compensação' };

export function StockDetail({ data, permissions, busy, onAction, onClose, onMore }: {
  data: DetailData; permissions: EstoqueAction[]; busy: boolean;
  onAction(action: StockMutation, movement?: MovimentoResumo): void;
  onClose(): void; onMore(): void;
}) {
  return <section aria-label={`Detalhe de ${data.item.nome}`} className="rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h3 className="break-words font-heading text-2xl text-foreground">{data.item.nome}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{data.item.titular.tipo === 'clinica' ? 'Materiais da clínica' : 'Meu estoque'} · Saldo: <span className="font-mono text-foreground">{formatStockQuantity(data.item.saldo)} {STOCK_UNITS[data.item.unidadeBase]}</span></p>
      </div><Button variant="outline" className="min-h-11" onClick={onClose}>Fechar detalhe</Button>
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      {ACTIONS.filter(({ permission, action }) => permissions.includes(permission) && (data.item.ativo || action === 'editarItem')).map(({ action, label }) => <Button key={action} className="min-h-11" variant={action === 'receberMaterial' ? 'default' : 'outline'} disabled={busy || (action !== 'receberMaterial' && action !== 'editarItem' && data.lotes.length === 0)} onClick={() => onAction(action)}>{label}</Button>)}
    </div>
    <h4 className="mt-6 font-semibold text-foreground">Lotes</h4>
    {data.lotes.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhuma entrada registrada para este material.</p> : <ul className="mt-2 divide-y divide-border">
      {data.lotes.map((lot) => <li key={lot.id} className="flex justify-between gap-4 py-4 text-sm"><div className="min-w-0"><p className="break-words font-medium">{lot.codigoFabricante ? `Lote ${lot.codigoFabricante}` : 'Lote sem identificação'}</p><p className="mt-1 text-muted-foreground">{lot.validadeISO ? `Validade ${formatStockDate(lot.validadeISO)}` : 'Validade não informada'}</p><span className="text-xs text-muted-foreground">Referência {lot.id.slice(0, 8)}</span></div><span className="shrink-0 font-mono">{formatStockQuantity(lot.saldo)} {STOCK_UNITS[data.item.unidadeBase]}</span></li>)}
    </ul>}
    <h4 className="mt-6 font-semibold text-foreground">Movimentações</h4>
    {data.movimentos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">O material começa com saldo zero. As movimentações aparecerão aqui.</p> : <ul className="mt-2 divide-y divide-border">
      {data.movimentos.map((movement) => <li key={movement.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
        <div className="min-w-0 flex-1"><p className="font-medium">{KIND[movement.tipo] ?? movement.tipo}{movement.corrigido ? ' · Corrigido' : ''}</p><p className="mt-1 text-muted-foreground">{new Date(movement.ocorridoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {movement.atorNome}</p><p className="mt-1 break-words text-muted-foreground">{movement.motivo}</p></div>
        <span className="font-mono">{formatStockQuantity(movement.quantidade)}</span>
        {permissions.includes('estoque.ajustar') && !movement.corrigido && !movement.reversaoDe && ['entrada', 'consumo', 'descarte'].includes(movement.tipo) && data.item.ativo && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => onAction('corrigirMovimento', movement)} aria-label={`Corrigir ${KIND[movement.tipo]} de ${formatStockQuantity(movement.quantidade)}`}>Corrigir</Button>}
      </li>)}
    </ul>}
    {data.proximoCursor && <Button variant="outline" className="mt-3 min-h-11" disabled={busy} onClick={onMore}>{busy ? 'Carregando…' : 'Mais movimentações'}</Button>}
  </section>;
}
