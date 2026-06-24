---
name: supabase-patterns
description: Supabase com Next.js App Router — SSR auth, createServerClient, RLS, queries tipadas, multi-tenant, Edge Functions. Baseado em vercel/nextjs-subscription-payments e docs Supabase 2026.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored baseado em supabase/supabase e vercel/nextjs-subscription-payments
---

# Supabase Patterns

## Setup — Clientes por contexto

```typescript
// utils/supabase/server.ts — Server Components, Server Actions, Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component não pode setar cookies — ignorar
          }
        },
      },
    }
  )
}

// utils/supabase/client.ts — Client Components
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## Middleware — Renovação de Sessão (OBRIGATÓRIO)

```typescript
// utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: getUser() renova o token expirado automaticamente
  // Sem isso, o token expira e o usuário é deslogado
  const { data: { user } } = await supabase.auth.getUser()

  // Redirecionar para login se rota protegida
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// middleware.ts
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Regra de Ouro: getUser(), nunca getSession() no Servidor

```typescript
// ❌ NUNCA em código servidor — não valida a assinatura JWT
const { data: { session } } = await supabase.auth.getSession()

// ✅ SEMPRE — verifica JWT contra chaves públicas do projeto
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) redirect('/login')
```

---

## Queries — Padrões

```typescript
// Deduplicar com React cache() (evita dupla query na mesma render pass)
import { cache } from 'react'
export const getUser = cache(async (supabase: SupabaseClient) => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Relacionamento aninhado — join em uma query
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('*, prices(*, products(*))')       // nested join
  .in('status', ['trialing', 'active'])
  .maybeSingle()                             // null se não encontrar (não lança erro)

// .single() vs .maybeSingle()
// .single()    → erro se 0 ou >1 resultado (use quando DEVE existir)
// .maybeSingle() → null se 0 resultado (use quando pode não existir)

// Ordenar por campo JSON
.order('metadata->index')

// Upsert
await supabase.from('profiles').upsert({ id: user.id, ...data })

// Tipos gerados (npx supabase gen types)
import type { Database } from '@/types/supabase'
const supabase = createClient<Database>()
const { data } = await supabase.from('users').select('*')
// data é tipado automaticamente
```

---

## Auth Flows

```typescript
// Login com email/senha
const { error } = await supabase.auth.signInWithPassword({ email, password })

// OAuth (Google, GitHub)
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${getURL()}auth/callback` },
})

// Callback route — app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/dashboard`)
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

// Logout (Server Action)
export async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

---

## RLS — Row Level Security

```sql
-- Habilitar RLS em toda tabela (padrão obrigatório)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus dados
CREATE POLICY "user sees own posts"
ON posts FOR SELECT
USING (auth.uid() = user_id);

-- Usuário cria apenas com seu ID
CREATE POLICY "user creates own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Multi-tenant: usuário vê dados da sua organização
CREATE POLICY "org members see org data"
ON documents FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);
```

---

## Multi-Tenant Pattern

```sql
-- Toda tabela tenant-scoped tem org_id
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index obrigatório para performance
CREATE INDEX ON documents(org_id);
CREATE INDEX ON documents(org_id, user_id);
```

```typescript
// Sempre filtrar por org_id nas queries (além do RLS)
const orgId = await getOrgId(userId)

const { data } = await supabase
  .from('documents')
  .select('*')
  .eq('org_id', orgId)
  .order('created_at', { ascending: false })
```

---

## Real-Time (Client-Side Only)

```typescript
'use client'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export function useRealtimeTable<T>(
  table: string,
  onData: (payload: T) => void,
) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => onData(payload.new as T)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [table, onData])
}
```

---

## Edge Functions

```typescript
// supabase/functions/process-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Service role key para bypass de RLS em Edge Functions
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json()
  const { error } = await supabase.from('events').insert(body)
  if (error) return new Response(JSON.stringify({ error }), { status: 500 })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## Anti-Padrões

- `getSession()` no servidor → sempre `getUser()`
- Criar client Supabase no componente sem `cache()` → duplicação de queries
- RLS desabilitado → brecha de segurança grave
- `.single()` quando o registro pode não existir → usar `.maybeSingle()`
- Subscriptions real-time em Server Components → impossível, usar Client Components
- Service role key exposta no cliente → nunca em variáveis `NEXT_PUBLIC_`
- Queries sem filtro de `org_id` em apps multi-tenant → vazamento de dados entre orgs
