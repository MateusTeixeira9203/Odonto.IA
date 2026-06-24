---
name: error-handling
description: Error handling em Next.js App Router — error.tsx, notFound(), redirect() fora de try/catch, Sentry setup, logs estruturados, fallbacks e mensagens de erro para o usuário.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored — padrões de error handling para Next.js + Supabase
---

# Error Handling

## Hierarquia de Error Boundaries no App Router

```
app/
  error.tsx              ← captura erros de toda a app (fallback global)
  (dashboard)/
    error.tsx            ← captura erros do segmento dashboard
    dashboard/
      error.tsx          ← captura erros específicos desta rota
      page.tsx           ← erros aqui sobem para o error.tsx mais próximo
```

```tsx
// app/error.tsx — DEVE ser Client Component
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Reportar ao Sentry
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        {getPublicMessage(error)}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">Código: {error.digest}</p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Voltar ao início
        </Button>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </div>
  )
}

// Nunca expor erros internos ao usuário
function getPublicMessage(error: Error): string {
  const publicMessages: Record<string, string> = {
    'Unauthorized': 'Você não tem permissão para acessar este conteúdo.',
    'Not found': 'O recurso solicitado não foi encontrado.',
    'Rate limit exceeded': 'Muitas requisições. Aguarde alguns instantes.',
  }
  return publicMessages[error.message] ?? 'Ocorreu um erro inesperado. Nossa equipe foi notificada.'
}
```

---

## not-found.tsx e notFound()

```tsx
// app/not-found.tsx — página 404 global
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
```

```typescript
// Em Server Components — notFound() e redirect() FORA do try/catch
import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  // ✅ FORA do try/catch — eles lançam exceções especiais do Next.js
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.id),
  })
  if (!project) notFound()  // Dispara not-found.tsx — não envolva em try

  const user = await getUser()
  if (!user) redirect('/login')  // Dispara redirect — não envolva em try

  // Erros de DB dentro de try/catch
  let data
  try {
    data = await fetchExternalData(project.id)
  } catch {
    // Fallback gracioso em vez de quebrar a página
    data = null
  }

  return <ProjectView project={project} data={data} />
}
```

---

## Sentry — Setup Completo

```bash
npx @sentry/wizard@latest -i nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
})

// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})

// Capturar erro manualmente com contexto
Sentry.captureException(error, {
  user: { id: userId, email: userEmail },
  tags: { orgId, feature: 'billing' },
  extra: { priceId, planName },
})

// Escopo de usuário (chamar após login)
Sentry.setUser({ id: userId, email: userEmail })
Sentry.setTag('orgId', orgId)
```

---

## Logs Estruturados

```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

function log(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    // Em produção, adicionar request ID, user ID, etc.
    env: process.env.NODE_ENV,
  }

  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (process.env.NODE_ENV !== 'production' || level !== 'debug') {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),
}

// Uso
logger.info('User created', { userId, email, orgId })
logger.error('Payment failed', { userId, priceId, stripeError: error.message })
```

---

## Server Action — Try/Catch Pattern

```typescript
// Regra: try/catch APENAS em torno de operações que podem falhar (DB, API externa)
// redirect() e notFound() NUNCA dentro de try/catch

export async function createProject(prevState: ActionState, formData: FormData): Promise<ActionState> {
  // Auth — fora de try (deve propagar o erro)
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Validação — fora de try
  const validated = schema.safeParse(Object.fromEntries(formData))
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // DB — dentro de try
  let project
  try {
    [project] = await db.insert(projects).values({
      ...validated.data,
      orgId: session.user.orgId,
    }).returning()
  } catch (err) {
    logger.error('Failed to create project', {
      userId: session.user.id,
      error: err instanceof Error ? err.message : String(err),
    })
    return { message: 'Não foi possível criar o projeto. Tente novamente.' }
  }

  // Fora do try — redirect e revalidatePath são operações de controle de fluxo
  revalidatePath('/dashboard/projects')
  redirect(`/dashboard/projects/${project.id}`)
}
```

---

## Route Handler — Error Pattern

```typescript
// app/api/users/[id]/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, params.id) })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    return Response.json(user)
  } catch (err) {
    logger.error('GET /api/users/:id failed', {
      userId: params.id,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    Sentry.captureException(err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Mensagens de Erro para o Usuário

```typescript
// ✅ Mensagens claras, em PT-BR, com ação
const ERROR_MESSAGES = {
  UNAUTHORIZED:     'Você precisa fazer login para continuar.',
  FORBIDDEN:        'Você não tem permissão para fazer isso.',
  NOT_FOUND:        'O item que você está procurando não existe.',
  RATE_LIMITED:     'Muitas tentativas. Aguarde 1 minuto e tente novamente.',
  NETWORK_ERROR:    'Falha na conexão. Verifique sua internet e tente novamente.',
  SERVER_ERROR:     'Ocorreu um erro. Nossa equipe foi notificada.',
  STRIPE_DECLINED:  'Seu cartão foi recusado. Verifique os dados ou use outro cartão.',
  EMAIL_IN_USE:     'Este email já está cadastrado. Tente fazer login.',
  INVALID_TOKEN:    'Link expirado. Solicite um novo link.',
}

// ❌ Nunca expor para o usuário
// "Cannot read property 'id' of undefined"
// "ECONNREFUSED 127.0.0.1:5432"
// "duplicate key value violates unique constraint users_email_key"
```

---

## Anti-Padrões

- `redirect()` ou `notFound()` dentro de `try/catch` → engole o redirect/404
- Expor stack trace ou mensagem de erro interna ao usuário → segurança
- `catch (err) {}` vazio → silencia erros sem logging
- `console.log(err)` em produção → logs não estruturados, difíceis de agregar
- Error boundary sem reportar ao Sentry → erros de prod invisíveis
- `throw new Error('db error')` sem contexto → difícil de debugar
- Sentry DSN exposto no client sem `NEXT_PUBLIC_` → chave inacessível ao browser
