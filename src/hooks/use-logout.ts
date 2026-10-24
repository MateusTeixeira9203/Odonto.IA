'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Remove apenas os dados do Meu Dia desta aba; storage indisponível não impede sair. */
export function limparDadosMeuDiaDaAba(storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
  try {
    const aba = storage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);
    if (!aba) return;
    for (let indice = aba.length - 1; indice >= 0; indice--) {
      const chave = aba.key(indice);
      if (chave?.startsWith('odontoia:meu-dia:')) aba.removeItem(chave);
    }
  } catch { /* Preserva o fluxo de saída quando o navegador bloqueia o storage. */ }
}

/**
 * signOut() dispara o evento SIGNED_OUT do Supabase, que o useSessionGuard escuta e
 * reage com seu próprio router.push('/login?reason=session_expired'). Se este hook
 * também navegasse via router.push/router.refresh, as duas navegações competiam —
 * era a causa do logout "não sair" ou "demorar muito" (App Router preso entre duas
 * transições). Hard navigation sempre vence a corrida: a página recarrega do zero,
 * qualquer push pendente do guard fica irrelevante.
 */
export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    limparDadosMeuDiaDaAba();
    // O pagehide do documento ainda pode gravar o rascunho ao navegar; limpa depois dele.
    window.addEventListener('pagehide', () => limparDadosMeuDiaDaAba(), { once: true });
    const supabase = createClient();
    await supabase.auth.signOut();
    limparDadosMeuDiaDaAba();
    window.location.href = '/login';
  }, [isLoggingOut]);

  return { logout, isLoggingOut };
}
