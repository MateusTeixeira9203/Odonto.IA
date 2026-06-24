---
name: saas-patterns
description: SaaS com Next.js + Supabase — multi-tenancy, Stripe billing, onboarding, invite flows, getURL helper, toast redirects via query params. Baseado em vercel/nextjs-subscription-payments.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored baseado em vercel/nextjs-subscription-payments
---

# SaaS Patterns

## Multi-Tenant — Modelo de Dados

```sql
-- Hierarquia: organizations → members → resources
-- Toda tabela de dados leva org_id

CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,  -- para URLs: /org/acme/dashboard
  plan       TEXT NOT NULL DEFAULT 'free',  -- free | starter | pro | enterprise
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_members (
  org_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role    TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member | viewer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Toda tabela tenant-scoped
CREATE TABLE projects (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON projects(org_id);
CREATE INDEX ON org_members(user_id);  -- lookup de todas as orgs do usuário
```

**RLS para multi-tenant:**
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members see org projects"
ON projects FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "admins manage org projects"
ON projects FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
```

---

## URL Helpers (padrão nextjs-subscription-payments)

```typescript
// utils/helpers.ts

// URL base com fallbacks: SITE_URL → VERCEL_URL → localhost
export const getURL = (path: string = '') => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL?.trim() ??
    process?.env?.NEXT_PUBLIC_VERCEL_URL?.trim() ??
    'http://localhost:3000'

  url = url.replace(/\/+$/, '')                         // remover trailing slash
  url = url.includes('http') ? url : `https://${url}`  // garantir https em prod
  path = path.replace(/^\/+/, '')                       // remover leading slash
  return path ? `${url}/${path}` : url
}

// Redirect com toast — feedback sem estado client
export type ToastType = 'error' | 'success' | 'info'

export const getToastRedirect = (
  path: string,
  type: ToastType,
  title: string,
  description = '',
  disableButton = false,
  arbitraryParams = ''
): string => {
  const params = new URLSearchParams({
    [type]: title,
    ...(description && { description }),
    ...(disableButton && { disable_button: 'true' }),
  })
  return `${path}?${params}${arbitraryParams ? '&' + arbitraryParams : ''}`
}

export const getErrorRedirect = (path: string, title: string, description = '') =>
  getToastRedirect(path, 'error', title, description)

export const getSuccessRedirect = (path: string, title: string, description = '') =>
  getToastRedirect(path, 'success', title, description)
```

**Ler toast no componente:**
```tsx
// app/dashboard/page.tsx ou layout.tsx
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function ToastHandler() {
  const params = useSearchParams()
  useEffect(() => {
    const error = params.get('error')
    const success = params.get('success')
    const description = params.get('description') ?? undefined
    if (error) toast.error(error, { description })
    if (success) toast.success(success, { description })
  }, [params])
  return null
}
```

---

## Stripe Billing — Padrão Completo

```typescript
// lib/stripe.ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
})

// Server Action — criar checkout session
export async function createCheckoutSession(priceId: string, orgId: string) {
  'use server'
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Buscar ou criar customer Stripe
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  let customerId = org?.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { orgId, userId: session.user.id },
    })
    customerId = customer.id
    await db.update(organizations)
      .set({ stripeCustomerId: customerId })
      .where(eq(organizations.id, orgId))
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId },
    },
    success_url: getURL(`dashboard?success=Assinatura+ativada!&description=Bem-vindo+ao+plano+Pro`),
    cancel_url: getURL('pricing'),
  })

  redirect(checkoutSession.url!)
}

// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orgId = session.metadata?.orgId
      const subscriptionId = session.subscription as string
      if (orgId && subscriptionId) {
        await activateSubscription(orgId, subscriptionId)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const orgId = sub.metadata?.orgId
      if (orgId) await syncSubscription(orgId, sub)
      break
    }
  }

  return Response.json({ received: true })
}
```

---

## Trial Period

```typescript
// Calcular fim do trial (mínimo 2 dias para segurança)
export const calculateTrialEnd = (trialDays: number | null | undefined) => {
  if (!trialDays || trialDays < 2) return undefined
  const end = new Date()
  end.setDate(end.getDate() + trialDays + 1)  // +1 dia de buffer
  return Math.floor(end.getTime() / 1000)      // Unix timestamp para Stripe
}
```

---

## Invite Flow

```typescript
// Server Action — criar convite
export async function inviteMember(orgId: string, email: string, role: 'admin' | 'member') {
  'use server'
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Verificar permissão do convidante
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, session.user.id)),
  })
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return getErrorRedirect('/settings/members', 'Sem permissão', 'Apenas admins podem convidar.')
  }

  // Criar token de convite
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

  await db.insert(invites).values({ orgId, email, role, token, expiresAt, invitedBy: session.user.id })

  // Enviar email
  await sendEmail({
    to: email,
    subject: 'Você foi convidado',
    html: `<a href="${getURL(`invite/accept?token=${token}`)}">Aceitar convite</a>`,
  })

  return getSuccessRedirect('/settings/members', 'Convite enviado!', `Para ${email}`)
}

// app/invite/accept/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return redirect('/login')

  const invite = await db.query.invites.findFirst({
    where: and(eq(invites.token, token), gt(invites.expiresAt, new Date())),
  })

  if (!invite) return redirect(getErrorRedirect('/login', 'Convite inválido', 'O convite expirou.'))

  const session = await auth()
  if (!session?.user) {
    // Salvar token no cookie e redirecionar para login
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.set('pending_invite', token, { httpOnly: true, maxAge: 3600 })
    return response
  }

  // Aceitar convite
  await db.transaction(async (tx) => {
    await tx.insert(orgMembers).values({
      orgId: invite.orgId,
      userId: session.user.id,
      role: invite.role,
    }).onConflictDoNothing()
    await tx.delete(invites).where(eq(invites.token, token))
  })

  redirect(getSuccessRedirect('/dashboard', 'Bem-vindo!', 'Você entrou para a organização.'))
}
```

---

## Feature Flags por Plano

```typescript
// lib/features.ts
const PLAN_FEATURES = {
  free:       { maxProjects: 3,  maxMembers: 1,  aiEnabled: false, customDomain: false },
  starter:    { maxProjects: 10, maxMembers: 5,  aiEnabled: false, customDomain: false },
  pro:        { maxProjects: 50, maxMembers: 20, aiEnabled: true,  customDomain: true  },
  enterprise: { maxProjects: -1, maxMembers: -1, aiEnabled: true,  customDomain: true  },
} as const

type Plan = keyof typeof PLAN_FEATURES

export function getFeatures(plan: string) {
  return PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.free
}

export function canUseFeature(plan: string, feature: keyof typeof PLAN_FEATURES.free) {
  return getFeatures(plan)[feature]
}

// Uso em Server Component
const org = await getOrg(orgId)
const features = getFeatures(org.plan)

if (!features.aiEnabled) {
  return <UpgradePrompt feature="AI" requiredPlan="pro" />
}
```

---

## Onboarding Flow

```typescript
// Modelo: usuário novo → criar org → configurar → convidar
// Rastrear progresso no banco

const onboardingSteps = ['org_created', 'profile_complete', 'first_project', 'invited_member'] as const

// Middleware — redirecionar para onboarding se incompleto
if (user && !hasCompletedOnboarding(user)) {
  const nextStep = getNextOnboardingStep(user)
  return NextResponse.redirect(new URL(`/onboarding/${nextStep}`, req.url))
}
```

---

## Anti-Padrões

- RLS sem índice em `org_id` → queries lentas em scale
- Webhook sem verificação de assinatura Stripe → vulnerabilidade crítica
- Trial sem validação de `trialDays >= 2` → comportamento Stripe indefinido
- `redirect()` dentro de `try/catch` em Server Actions → move para fora
- Convite sem expiração → tokens eternos são risco de segurança
- `customerId` não persistido após criação → cria customers duplicados no Stripe
- Feature check só no frontend → bypass fácil; sempre verificar no servidor também
