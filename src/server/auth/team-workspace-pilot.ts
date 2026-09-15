export { getPilotEntryMembership } from '@/lib/auth/entry-membership';

type PilotEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  STRIPE_BILLING_ENABLED?: string;
};

/** Piloto isolado; não define cobertura comercial para gestores em produção. */
export function isTeamWorkspaceEnabled(environment: PilotEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  STRIPE_BILLING_ENABLED: process.env.STRIPE_BILLING_ENABLED,
}): boolean {
  if (environment.STRIPE_BILLING_ENABLED === 'true') return false;
  try {
    const url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'https:'
      && url.hostname === 'etlqznuoxiilvxzygpat.supabase.co'
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
