'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [isLoggingOut]);

  return { logout, isLoggingOut };
}
