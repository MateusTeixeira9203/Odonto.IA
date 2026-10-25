-- R-157 — fundação operacional de acesso.
-- Somente schema aditivo. Nenhuma policy comercial é aplicada nesta migration e
-- enforcement_enabled permanece semanticamente false enquanto não houver configuração.

alter table public.assinaturas_dentista
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists reconciliation_attempts integer not null default 0
    check (reconciliation_attempts >= 0),
  add column if not exists reconciliation_lease_token uuid,
  add column if not exists reconciliation_lease_until timestamptz,
  add column if not exists last_reconciliation_error text;

create index if not exists assinaturas_dentista_reconciliation_due_idx
  on public.assinaturas_dentista (reconciliation_lease_until, updated_at)
  where status in ('checkout_pendente', 'past_due', 'suspended', 'unpaid');

alter table public.billing_events
  add column if not exists stripe_object_id text,
  add column if not exists livemode boolean;

create index if not exists billing_events_stripe_pending_idx
  on public.billing_events (received_at, processing_lease_until)
  where provider = 'stripe' and outcome in ('pending', 'error');

create table if not exists public.billing_runtime_config (
  id boolean primary key default true check (id),
  enforcement_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.billing_runtime_config enable row level security;
revoke all on table public.billing_runtime_config from public, anon, authenticated;
grant all on table public.billing_runtime_config to service_role;

drop trigger if exists billing_runtime_config_updated_at on public.billing_runtime_config;
create trigger billing_runtime_config_updated_at
  before update on public.billing_runtime_config
  for each row execute function public.update_updated_at();

create table if not exists public.billing_access_overrides (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  usuario_id uuid references public.users(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_until is null or active_until > created_at)
);

create index if not exists billing_access_overrides_active_idx
  on public.billing_access_overrides (clinica_id, usuario_id, active_until);

alter table public.billing_access_overrides enable row level security;
revoke all on table public.billing_access_overrides from public, anon, authenticated;
grant all on table public.billing_access_overrides to service_role;

drop trigger if exists billing_access_overrides_updated_at on public.billing_access_overrides;
create trigger billing_access_overrides_updated_at
  before update on public.billing_access_overrides
  for each row execute function public.update_updated_at();

create table if not exists public.operational_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint) between 8 and 200),
  kind text not null check (char_length(kind) between 3 and 100),
  severity text not null check (severity in ('P1', 'P2', 'P3')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  clinica_id uuid references public.clinicas(id) on delete set null,
  usuario_id uuid references public.users(id) on delete set null,
  occurrences integer not null default 1 check (occurrences > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_notified_at timestamptz,
  resolved_at timestamptz,
  safe_context jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (last_seen_at >= first_seen_at),
  check (resolved_at is null or resolved_at >= first_seen_at)
);

create index if not exists operational_incidents_open_idx
  on public.operational_incidents (severity, last_seen_at desc)
  where status = 'open';

alter table public.operational_incidents enable row level security;
revoke all on table public.operational_incidents from public, anon, authenticated;
grant all on table public.operational_incidents to service_role;

drop trigger if exists operational_incidents_updated_at on public.operational_incidents;
create trigger operational_incidents_updated_at
  before update on public.operational_incidents
  for each row execute function public.update_updated_at();

create or replace function public.claim_billing_reconciliation(
  p_assinatura_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
begin
  if p_assinatura_id is null or p_lease_token is null then
    return false;
  end if;

  update public.assinaturas_dentista
  set reconciliation_lease_token = p_lease_token,
      reconciliation_lease_until = now() + interval '120 seconds',
      reconciliation_attempts = reconciliation_attempts + 1
  where id = p_assinatura_id
    and (reconciliation_lease_until is null or reconciliation_lease_until <= now())
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_billing_reconciliation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_billing_reconciliation(uuid, uuid) to service_role;