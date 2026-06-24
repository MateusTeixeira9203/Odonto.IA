---
name: ai-integration
description: Vercel AI SDK (2026) — streamText, generateObject, tool calls, useChat com message.parts, streaming UI, structured output. API atual: UIMessage, convertToModelMessages, sendMessage.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored baseado em ai-sdk.dev docs 2026
---

# AI Integration — Vercel AI SDK

> API de 2026: `UIMessage` (não `Message`), `convertToModelMessages()`, `sendMessage()` (não `handleSubmit`), `message.parts` (não `message.content`), `inputSchema` (não `parameters`).

---

## Route Handler — Streaming com Tool Calls

```typescript
// app/api/chat/route.ts
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    system: 'Você é um assistente útil.',
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),    // limite de loops de tool calls
    tools: {
      getWeather: tool({
        description: 'Busca a temperatura atual de uma cidade.',
        inputSchema: z.object({
          city: z.string().describe('Nome da cidade'),
        }),
        execute: async ({ city }) => {
          const temp = await fetchWeather(city)
          return { city, temperature: temp, unit: 'celsius' }
        },
      }),
      searchDatabase: tool({
        description: 'Busca registros no banco de dados.',
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().default(10),
        }),
        execute: async ({ query, limit }) => {
          return db.search(query, limit)
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
```

---

## Cliente — useChat com message.parts

```tsx
// components/chat.tsx
'use client'
import { useChat } from '@ai-sdk/react'
import { useState } from 'react'

export function Chat() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
    onError: (error) => console.error('Chat error:', error),
  })

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'text-right' : 'text-left'}>
            <div className="font-semibold">{message.role === 'user' ? 'Você' : 'AI'}</div>
            {/* message.parts — array tipado de partes */}
            {message.parts.map((part, i) => {
              const key = `${message.id}-${i}`
              switch (part.type) {
                case 'text':
                  return <p key={key} className="mt-1">{part.text}</p>

                case 'tool-getWeather':
                  return (
                    <div key={key} className="rounded border p-2 text-sm bg-muted">
                      {part.state === 'output-available'
                        ? `🌡️ ${part.output.city}: ${part.output.temperature}°C`
                        : '🔄 Buscando temperatura...'}
                    </div>
                  )

                case 'tool-searchDatabase':
                  return (
                    <div key={key} className="rounded border p-2 text-sm bg-muted">
                      {part.state === 'output-available'
                        ? `📊 ${part.output.length} resultados encontrados`
                        : '🔍 Pesquisando...'}
                    </div>
                  )

                default:
                  return null
              }
            })}
          </div>
        ))}
        {status === 'streaming' && <div className="animate-pulse">AI digitando...</div>}
      </div>

      <form
        className="p-4 border-t"
        onSubmit={(e) => {
          e.preventDefault()
          if (!input.trim()) return
          sendMessage({ text: input })
          setInput('')
        }}
      >
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={status === 'streaming'}
          />
          <button
            type="submit"
            disabled={status === 'streaming' || !input.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  )
}
```

---

## Structured Output — generateObject

```typescript
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
  })),
  steps: z.array(z.string()),
  prepTime: z.number().describe('Tempo em minutos'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

export async function generateRecipe(prompt: string) {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-5'),
    schema: recipeSchema,
    prompt: `Crie uma receita para: ${prompt}`,
  })
  return object  // tipado como z.infer<typeof recipeSchema>
}
```

**Server Action com structured output:**
```typescript
// lib/actions/analyze.ts
'use server'
import { generateObject } from 'ai'
import { z } from 'zod'

const analysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  topics: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export async function analyzeText(text: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const { object } = await generateObject({
    model: anthropic('claude-haiku-4-5'),  // Haiku para tarefas simples/baratas
    schema: analysisSchema,
    prompt: `Analise este texto: ${text}`,
  })
  return object
}
```

---

## Streaming de Texto (sem tool calls)

```typescript
// Route Handler simples
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const result = streamText({
    model: anthropic('claude-sonnet-4-5'),
    prompt,
    maxTokens: 1000,
    temperature: 0.7,
  })

  return result.toDataStreamResponse()
}

// Cliente com useCompletion (texto livre, sem histórico de chat)
'use client'
import { useCompletion } from '@ai-sdk/react'

export function TextGenerator() {
  const { completion, complete, isLoading } = useCompletion({ api: '/api/generate' })

  return (
    <div>
      <button onClick={() => complete('Escreva um poema sobre o mar')} disabled={isLoading}>
        {isLoading ? 'Gerando...' : 'Gerar'}
      </button>
      <p className="whitespace-pre-wrap">{completion}</p>
    </div>
  )
}
```

---

## Rate Limiting

```typescript
// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),  // 10 req/min
})

// app/api/chat/route.ts
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return Response.json({ error: 'Rate limit exceeded' }, {
      status: 429,
      headers: { 'X-RateLimit-Remaining': String(remaining) },
    })
  }
  // ...
}
```

---

## Seleção de Modelo por Caso de Uso

| Caso | Modelo | Por quê |
|---|---|---|
| Resposta simples, classificação | `claude-haiku-4-5` | Barato, rápido |
| Chat, análise, geração | `claude-sonnet-4-5` | Equilíbrio custo/qualidade |
| Raciocínio complexo, código difícil | `claude-opus-4-8` | Máxima capacidade |
| Estruturação/extração de dados | `claude-haiku-4-5` + `generateObject` | Schema garante formato |

---

## Streaming com `useObject` (structured output em tempo real)

```tsx
'use client'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { z } from 'zod'

const itemSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
})

export function TaskGenerator() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-task',
    schema: itemSchema,
  })

  return (
    <div>
      <button onClick={() => submit({ prompt: 'Crie uma tarefa de exemplo' })}>
        Gerar Tarefa
      </button>
      {isLoading && <div>Gerando...</div>}
      {object && (
        <div>
          <h3>{object.title}</h3>       {/* pode ser undefined durante stream */}
          <p>{object.description}</p>
          <span>{object.priority}</span>
        </div>
      )}
    </div>
  )
}
```

---

## Anti-Padrões

- `message.content` para renderizar tool results → usar `message.parts`
- `handleSubmit` do `useChat` antigo → usar `sendMessage`
- `parameters` no `tool()` → usar `inputSchema`
- Sem `stopWhen: stepCountIs()` → loops infinitos de tool calls
- Model hardcoded como string sem constante → difícil de trocar
- Sem rate limiting na rota de chat → custo ilimitado
- Secrets de AI em variáveis `NEXT_PUBLIC_` → expõe chave de API
