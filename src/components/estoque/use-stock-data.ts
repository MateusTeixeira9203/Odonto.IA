'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StockAccessContext } from '@/server/estoque/access';
import type { TitularEstoque } from '@/server/estoque/contracts';
import type { StockPorts } from './stock-ports';

type ListData = Extract<Awaited<ReturnType<StockPorts['listarEstoque']>>, { ok: true }>['data'];
type DetailData = Extract<Awaited<ReturnType<StockPorts['detalharEstoque']>>, { ok: true }>['data'];
export type StockFilter = 'todos' | 'baixo' | 'validade' | 'divergente' | 'arquivados';

export function useStockData(initialContext: StockAccessContext, ports: StockPorts) {
  const [context, setContext] = useState(initialContext);
  const [scope, setScope] = useState<'clinica' | 'dentista'>(initialContext.dentistaId ? 'dentista' : 'clinica');
  const [query, setQuery] = useState({ busca: '', filtro: 'todos' as StockFilter });
  const [list, setList] = useState<ListData | null>(null);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const selectedId = useRef<string | null>(null);
  const scopeDentist = scope === 'dentista' ? context.dentistaId : null;
  const titular: TitularEstoque = scopeDentist ? { tipo: 'dentista', dentistaId: scopeDentist } : { tipo: 'clinica' };

  const load = useCallback(async (cursor: ListData['proximoCursor'] = null) => {
    const sequence = ++listSequence.current;
    setLoading(true); setError(null);
    if (!cursor) setList(null);
    try {
      const fresh = await ports.contexto({ clinicaIdEsperada: initialContext.clinicaId });
      if (sequence !== listSequence.current) return;
      if (!fresh.ok) { setError(fresh.mensagem); setList(null); return; }
      setContext(fresh.data);
      const owner: TitularEstoque = scopeDentist ? { tipo: 'dentista', dentistaId: scopeDentist } : { tipo: 'clinica' };
      const result = await ports.listarEstoque({ clinicaIdEsperada: initialContext.clinicaId, titular: owner, ...query, cursor, limite: 25 });
      if (sequence !== listSequence.current) return;
      if (!result.ok) { setError(result.mensagem); setList(null); return; }
      setList((previous) => ({ ...result.data, itens: cursor && previous ? [...previous.itens, ...result.data.itens] : result.data.itens }));
    } catch { if (sequence === listSequence.current) setError('Não foi possível carregar os materiais. Tente novamente.'); }
    finally { if (sequence === listSequence.current) setLoading(false); }
  }, [ports, initialContext.clinicaId, query, scopeDentist]);

  const invalidateListRequests = useCallback(() => { listSequence.current += 1; }, []);
  useEffect(() => { void load(); return invalidateListRequests; }, [invalidateListRequests, load]);

  async function openDetail(itemId: string, cursor: DetailData['proximoCursor'] = null) {
    const sequence = ++detailSequence.current;
    selectedId.current = itemId;
    setDetailLoading(true); setDetailError(null);
    if (detail?.item.id !== itemId) setDetail(null);
    try {
      const result = await ports.detalharEstoque({ clinicaIdEsperada: initialContext.clinicaId, itemId, cursor, limite: 25 });
      if (sequence !== detailSequence.current) return;
      if (!result.ok) { setDetailError(result.mensagem); setDetail(null); return; }
      setDetail((previous) => ({ ...result.data, movimentos: cursor && previous ? [...previous.movimentos, ...result.data.movimentos] : result.data.movimentos }));
    } catch { if (sequence === detailSequence.current) setDetailError('Não foi possível carregar este material.'); }
    finally { if (sequence === detailSequence.current) setDetailLoading(false); }
  }

  function closeDetail() { detailSequence.current++; selectedId.current = null; setDetail(null); setDetailError(null); setDetailLoading(false); }
  function changeScope(next: 'clinica' | 'dentista') { closeDetail(); setScope(next); }
  async function refresh() {
    await Promise.all([load(), selectedId.current ? openDetail(selectedId.current) : Promise.resolve()]);
  }
  return { context, scope, titular, query, setQuery, changeScope, list, loading, error, load,
    detail, detailLoading, detailError, selectedItemId: selectedId.current, openDetail, closeDetail, refresh };
}
