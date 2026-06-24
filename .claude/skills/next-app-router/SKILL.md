---
name: next-app-router
description: Next.js 14+ App Router — Server Components, Server Actions com useActionState, Route Handlers, Middleware, streaming e data fetching. Baseado em padrões reais da Vercel (next-learn, nextjs-subscription-payments).
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored baseado em vercel/next-learn e vercel/nextjs-subscription-payments
---

# Next.js App Router

## Server vs Client — Regra de Decisão

**Padrão: Server Component.** `"use client"` apenas quando necessário.

| Precisa de | Solução |
|---|---|
| `useState`, `useEffect`, hooks | `"use client"` |
| Event handlers (`onClick`, `onChange`) | `"use client"` |
| Browser APIs (`window`, `localStorage`) | `"use client"` |
| Fetch/DB/secrets | Server Component (NUNCA `"use client"`) |

Empurre `"use client"` o mais para baixo na árvore. Server Component pode importar Client; Client NÃO pode importar Server Component.

---

## Server Actions — Padrão Completo

```typescript
// lib/actions/invoice.ts
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const Schema = z.object({
  customerId: z.string({ invalid_type_error: 'Selecione um cliente.' }),
  amount: z.coerce.number().gt(0, { message: 'Valor deve ser maior que 0.' }),
  status: z.enum(['pending', 'paid'], { invalid_type_error: 'Selecione um status.' }),
})

// Estado tipado para feedback ao cliente
export type ActionState = {
  errors?: { customerId?: string[]; amount?: string[]; status?: string[] }
  message?: string | null
}

export async function createInvoice(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Auth — SEMPRE primeiro
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // 2. Validar
  const validated = Schema.safeParse(Object.fromEntries(formData))
  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
      message: 'Campos inválidos.',
    }
  }

  // 3. Mutation — try/catch só em torno do DB
  try {
    await db.insert(invoices).values({ ...validated.data, userId: session.user.id })
  } catch {
    return { message: 'Erro no banco de dados.' }
  }

  // 4. redirect() e revalidatePath FORA do try/catch (lançam exceções internamente)
  revalidatePath('/dashboard/invoices')
  redirect('/dashboard/invoices')
}
```

**Usar com `useActionState`:**
```tsx
// app/invoices/create/page.tsx — Client Component
'use client'
import { useActionState } from 'react'
import { createInvoice, type ActionState } from '@/lib/actions/invoice'

const initialState: ActionState = { message: null, errors: {} }

export default function CreateInvoice() {
  const [state, dispatch, pending] = useActionState(createInvoice, initialState)

  return (
    <form action={dispatch}>
      <select name="customerId" aria-describedby="customerId-error">
        {/* options */}
      </select>
      <div id="customerId-error" aria-live="polite">
        {state.errors?.customerId?.map(e => <p key={e}>{e}</p>)}
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Salvando...' : 'Criar'}
      </button>
      {state.message && <p>{state.message}</p>}
    </form>
  )
}
```

---

## Data Fetching

```typescript
// Direto no banco (melhor — sem round-trip HTTP)
const rows = await db.select().from(table).where(eq(table.userId, userId))

// Paralelo — nunca sequencial desnecessário
const [user, posts] = await Promise.all([getUser(id), getPosts(id)])

// cache() — deduplicar dentro da mesma render pass (Server Components)
import { cache } from 'react'
export const getUser = cache(async (id: string) => {
  return db.query.users.findFirst({ where: eq(users.id, id) })
})

// fetch com revalidação (ISR)
const data = await fetch('/api/...', { next: { revalidate: 60 } })

// fetch sem cache
const data = await fetch('/api/...', { cache: 'no-store' })
```

---

## Route Handlers

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  // 1. Verificar assinatura antes de qualquer coisa
  const sig = req.headers.get('stripe-signature')
  const body = await req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 2. Processar
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckout(event.data.object)
      break
  }

  return Response.json({ received: true })
}

// Padrão de responses
return Response.json({ data }, { status: 200 })
return Response.json({ error: 'Not found' }, { status: 404 })
return new Response(null, { status: 204 })
```

---

## Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(req: NextRequest) {
  // Renovar sessão Supabase em todas as rotas (obrigatório para SSR)
  return await updateSession(req)
}

// Matcher — seja explícito, nunca matcher genérico em rotas estáticas
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## Cookies (Next.js 15 — sempre await)

```typescript
import { cookies } from 'next/headers'

// Em Server Component / Route Handler / Server Action
const cookieStore = await cookies()
const value = cookieStore.get('name')?.value
cookieStore.set('name', 'value', { httpOnly: true, secure: true })
cookieStore.delete('name')
```

---

## Estrutura de Arquivos

```
app/
  layout.tsx              ← root layout (html, body, providers)
  page.tsx
  (auth)/                 ← route group (não afeta URL)
    login/page.tsx
    register/page.tsx
  (dashboard)/
    layout.tsx            ← layout compartilhado (sidebar, nav)
    dashboard/
      page.tsx
      loading.tsx         ← Suspense fallback automático
      error.tsx           ← Error boundary (Client Component)
      not-found.tsx       ← 404 da rota
      @modal/             ← parallel route (modals, drawers)
```

---

## Streaming com Suspense

```tsx
import { Suspense } from 'react'

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      {/* UserList é Server Component com await interno */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <UserList />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <RecentActivity />
      </Suspense>
    </>
  )
}
```

---

## Error Handling

```tsx
// app/dashboard/error.tsx — DEVE ser Client Component
'use client'
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Algo deu errado</h2>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  )
}
```

```typescript
// Em Server Components — notFound() e redirect() FORA do try/catch
import { notFound } from 'next/navigation'

const user = await db.query.users.findFirst({ where: eq(users.id, id) })
if (!user) notFound()  // dispara not-found.tsx — não envolva em try/catch
```

---

## Metadata

```typescript
// Estática
export const metadata: Metadata = {
  title: { template: '%s | App', default: 'App' },
  description: '...',
}

// Dinâmica
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id)
  return { title: product.name, description: product.description }
}
```

---

## Anti-Padrões

- `useEffect` para fetch de dados → Server Component
- `"use client"` no layout ou page sem necessidade → empurrar para baixo
- `Promise.all` esquecido → waterfall desnecessário
- `redirect()` dentro de `try/catch` → move para fora (lança exceção)
- `notFound()` dentro de `try/catch` → idem
- Secrets lidos em Client Component → mover para Server Component ou Route Handler
- `cookies()` sem `await` no Next.js 15 → sempre `await cookies()`
