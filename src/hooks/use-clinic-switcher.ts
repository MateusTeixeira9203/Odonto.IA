'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface ClinicaItem {
  id: string;
  nome: string;
  role: string;
}

interface ClinicasApiResponse {
  success: boolean;
  data?: ClinicaItem[];
}

interface SwitchApiResponse {
  success: boolean;
}

export interface UseClinicSwitcherResult {
  clinicas: ClinicaItem[];
  loading: boolean;
  switching: boolean;
  switchClinic: (clinicId: string) => Promise<void>;
  refetch: () => void;
}

export function useClinicSwitcher(): UseClinicSwitcherResult {
  const router = useRouter();
  const [clinicas, setClinitas] = useState<ClinicaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/clinicas');
      const json = (await res.json()) as ClinicasApiResponse;
      if (json.success && json.data) {
        setClinitas(json.data);
      }
    } catch {
      // Network failure — keep empty list, user sees non-interactive display
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClinics();
  }, [fetchClinics]);

  const switchClinic = useCallback(
    async (clinicId: string) => {
      setSwitching(true);
      try {
        const res = await fetch('/api/user/switch-clinic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicId }),
        });
        const json = (await res.json()) as SwitchApiResponse;
        if (json.success) {
          // Revalida todos os Server Components sem reload completo
          router.refresh();
        }
      } catch {
        // Network failure — noop
      } finally {
        setSwitching(false);
      }
    },
    [router],
  );

  return { clinicas, loading, switching, switchClinic, refetch: fetchClinics };
}
