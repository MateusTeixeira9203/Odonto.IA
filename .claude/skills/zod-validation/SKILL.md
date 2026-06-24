---
name: zod-validation
description: Zod — schemas tipados, safeParse com flatten().fieldErrors, z.infer, omit/pick/extend, validação em Server Actions e Route Handlers, zodResolver para React Hook Form.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored — padrões Zod para Next.js App Router + RHF
---

# Zod Validation

## Schema — Padrões Essenciais

```typescript
import { z } from 'zod'

// Básico
const userSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  age: z.number().int().min(18, 'Maior de idade').max(120).optional(),
  role: z.enum(['admin', 'member', 'viewer']),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  tags: z.array(z.string()).min(1, 'Mínimo 1 tag').max(10),
  metadata: z.record(z.string(), z.unknown()),  // objeto com chaves dinâmicas
})

// Tipo inferido — sem duplicação
type User = z.infer<typeof userSchema>

// Schemas derivados (DRY)
const createUserSchema = userSchema.omit({ id: true, createdAt: true })
const updateUserSchema = userSchema.partial().required({ id: true })  // tudo opcional exceto id
const publicUserSchema = userSchema.pick({ name: true, email: true, role: true })

// Extend — adicionar campos
const adminSchema = userSchema.extend({
  permissions: z.array(z.string()),
  department: z.string(),
})
```

---

## Validação em Server Actions — Padrão Completo

```typescript
// lib/actions/user.ts
'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(100),
  email: z.string().email('Email inválido'),
})

export type ActionState = {
  errors?: Partial<Record<keyof z.infer<typeof schema>, string[]>>
  message?: string | null
  success?: boolean
}

export async function updateProfile(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // safeParse — nunca lança exceção
  const result = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  })

  if (!result.success) {
    // flatten().fieldErrors → Record<campo, string[]>
    return {
      errors: result.error.flatten().fieldErrors,
      message: 'Campos inválidos. Verifique os erros.',
    }
  }

  try {
    await db.update(users).set(result.data).where(eq(users.id, session.user.id))
  } catch {
    return { message: 'Erro ao salvar. Tente novamente.' }
  }

  revalidatePath('/settings')
  return { success: true, message: 'Perfil atualizado!' }
}
```

---

## Validação em Route Handlers

```typescript
// app/api/posts/route.ts
const createPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(50),
  tags: z.array(z.string()).max(5).default([]),
  published: z.boolean().default(false),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = createPostSchema.safeParse(body)
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const post = await db.insert(posts).values({
    ...result.data,
    authorId: session.user.id,
  }).returning()

  return Response.json(post[0], { status: 201 })
}
```

---

## zodResolver — React Hook Form

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],  // qual campo recebe o erro
})

type FormValues = z.infer<typeof schema>

export function RegisterForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  return (
    <form onSubmit={handleSubmit(async (data) => {
      await registerUser(data)
    })}>
      <input {...register('email')} type="email" />
      {errors.email && <p>{errors.email.message}</p>}

      <input {...register('password')} type="password" />
      {errors.password && <p>{errors.password.message}</p>}

      <input {...register('confirmPassword')} type="password" />
      {errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}

      <button type="submit" disabled={isSubmitting}>Registrar</button>
    </form>
  )
}
```

---

## Schemas Complexos

```typescript
// Union discriminada — tipagem por campo discriminante
const eventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user_created'),
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
  z.object({
    type: z.literal('order_placed'),
    orderId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().length(3),
  }),
  z.object({
    type: z.literal('payment_failed'),
    orderId: z.string().uuid(),
    reason: z.string(),
  }),
])

// Validação assíncrona (verificar unicidade no banco)
const slugSchema = z.object({
  slug: z.string()
    .min(3).max(50)
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens')
    .refine(
      async (slug) => !(await db.query.posts.findFirst({ where: eq(posts.slug, slug) })),
      { message: 'Este slug já está em uso' }
    ),
})

// Transform — converter e validar ao mesmo tempo
const priceSchema = z.string()
  .transform((val) => parseFloat(val))
  .pipe(z.number().positive('Preço deve ser positivo'))

// Preprocessing — normalizar antes de validar
const emailSchema = z.preprocess(
  (val) => typeof val === 'string' ? val.toLowerCase().trim() : val,
  z.string().email()
)

// Coerce — converter tipos vindos de FormData (strings → number/boolean)
const formSchema = z.object({
  age: z.coerce.number().int().min(0),       // '25' → 25
  active: z.coerce.boolean(),               // 'true' → true
  price: z.coerce.number().multipleOf(0.01), // '9.99' → 9.99
})
```

---

## Validação de Env Variables

```typescript
// env.ts — validar na inicialização, não em runtime
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXTAUTH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export const env = envSchema.parse(process.env)
// Se faltar uma variável, erro claro na inicialização, não em runtime
```

---

## Erros — Mensagens Claras

```typescript
// Mensagens em português
const schema = z.object({
  name: z.string({ required_error: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(50, 'Nome deve ter no máximo 50 caracteres'),
  cpf: z.string()
    .length(11, 'CPF deve ter 11 dígitos')
    .regex(/^\d+$/, 'CPF deve conter apenas números'),
  birthDate: z.string()
    .datetime({ message: 'Data inválida' })
    .refine(
      (date) => new Date(date) < new Date(),
      'Data de nascimento deve ser no passado'
    ),
})

// Formatar erros para exibição
const result = schema.safeParse(data)
if (!result.success) {
  const formatted = result.error.format()
  // formatted.name._errors = ['Nome deve ter pelo menos 2 caracteres']

  const flat = result.error.flatten()
  // flat.fieldErrors.name = ['Nome deve ter pelo menos 2 caracteres']
  // flat.formErrors = [] (erros que não pertencem a campo específico)
}
```

---

## Anti-Padrões

- `schema.parse()` em Server Actions → lança exceção não tratada; usar `safeParse()`
- Não usar `z.coerce` com dados de `FormData` → tudo é string, números não validam
- Schemas duplicados client/server → usar schema compartilhado em `lib/schemas/`
- `z.any()` → derrota o propósito; usar `z.unknown()` se o tipo realmente é desconhecido
- Validar sem verificar `result.success` antes de acessar `result.data` → erro em runtime
- Schema sem mensagens de erro em PT-BR → mensagens genéricas em inglês para o usuário
