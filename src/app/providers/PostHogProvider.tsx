'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import PostHogPageView from './PostHogPageView';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Em desenvolvimento não inicializa PostHog — evita o overhead de analytics enquanto se testa.
    if (process.env.NODE_ENV !== 'production') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      // Session recording (rrweb) grava as mutações de DOM do framer-motion/ParticleNetwork
      // a cada frame → trava a página inteira. Desligado.
      disable_session_recording: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
