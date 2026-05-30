'use client';

/**
 * Session resilience guard for long-running browser sessions.
 *
 * Problems solved:
 *   1. User opens the app and leaves it open for hours — session expires silently.
 *   2. Background tab becomes active again with stale auth state.
 *   3. Server actions start returning 401 with no user feedback.
 *
 * Strategy:
 *   - Listen for Supabase auth state changes (handles token refresh automatically).
 *   - On visibility change (tab focus), re-validate the session.
 *   - On SIGNED_OUT or SESSION_EXPIRED event, call onExpired().
 *
 * Usage:
 *   // In a root layout or dashboard shell component:
 *   useSessionGuard({
 *     onExpired: () => router.push('/login?reason=session_expired'),
 *   });
 */

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type SessionGuardOptions = {
  /** Called when the session is detected as expired or signed out. */
  onExpired: () => void;
  /**
   * Minimum seconds between re-validation checks on tab focus.
   * Prevents hammering the auth endpoint on rapid tab switches.
   * Default: 60 seconds.
   */
  recheckIntervalSeconds?: number;
};

export function useSessionGuard({
  onExpired,
  recheckIntervalSeconds = 60,
}: SessionGuardOptions): void {
  const lastCheckRef    = useRef<number>(0);
  const onExpiredRef    = useRef(onExpired);
  onExpiredRef.current  = onExpired;

  useEffect(() => {
    const supabase = createClient();

    // ── 1. Subscribe to Supabase auth state changes ────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') {
          onExpiredRef.current();
        }
        // TOKEN_REFRESHED = session is healthy, update last check
        lastCheckRef.current = Date.now();
      }
    });

    // ── 2. Re-validate on tab focus (guards long background sessions) ──────────
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      const now          = Date.now();
      const elapsedMs    = now - lastCheckRef.current;
      const thresholdMs  = recheckIntervalSeconds * 1_000;

      if (elapsedMs < thresholdMs) return;

      lastCheckRef.current = now;

      supabase.auth.getUser().then(({ data, error }) => {
        if (error || !data.user) {
          onExpiredRef.current();
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recheckIntervalSeconds]);
}
