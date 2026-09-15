'use client';

import { useRef, useState } from 'react';
import type { EstoqueResult } from '@/server/estoque/contracts';

/** Mantém a mesma chave e payload enquanto a resposta de uma gravação é incerta. */
export function useStockMutation(run: (input: unknown) => Promise<EstoqueResult<unknown>>) {
  const inFlight = useRef(false);
  const attempt = useRef<unknown>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Extract<EstoqueResult<unknown>, { ok: false }> | null>(null);
  const uncertain = failure?.codigo === 'INDISPONIVEL';
  const blocked = failure?.codigo === 'SEM_ACESSO' || failure?.codigo === 'CONTEXTO_ALTERADO';

  async function submit(payload: Record<string, unknown>): Promise<boolean> {
    if (inFlight.current || blocked) return false;
    inFlight.current = true;
    setPending(true);
    if (!attempt.current) attempt.current = { ...payload, chaveIdempotencia: crypto.randomUUID() };
    let result: EstoqueResult<unknown>;
    try {
      result = await run(attempt.current);
    } catch {
      result = { ok: false, codigo: 'INDISPONIVEL', mensagem: 'A resposta não chegou. Confira novamente esta mesma operação.' };
    }
    inFlight.current = false;
    setPending(false);
    if (result.ok) { attempt.current = null; setFailure(null); return true; }
    setFailure(result);
    if (result.codigo !== 'INDISPONIVEL') attempt.current = null;
    return false;
  }

  return { submit, pending, failure, uncertain, blocked, clearFailure: () => setFailure(null) };
}
