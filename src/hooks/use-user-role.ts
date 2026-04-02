'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DentistaRole } from '@/types/database';

/**
 * Retorna o papel (role) do usuário autenticado atual.
 * Útil em Client Components que não recebem o role via prop.
 * Para Server Components, use getDentistaCached().role.
 */
export function useUserRole(): DentistaRole | null {
  const [role, setRole] = useState<DentistaRole | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from('dentistas')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.role) setRole(data.role as DentistaRole);
        });
    });
  }, []);

  return role;
}
