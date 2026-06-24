---
name: react-patterns
description: React 18+ — hooks customizados, context + useReducer, performance (memo/useMemo/useCallback quando usar), compound components, Server vs Client boundary no App Router.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored — padrões modernos React 18+ com App Router
---

# React Patterns

## Custom Hooks — Os Mais Úteis

```typescript
// useLocalStorage — sincroniza estado com localStorage
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }

  return [value, setStoredValue] as const
}

// useDebounce — evitar requests a cada keystroke
export function useDebounce<T>(value: T, delay = 500): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Uso
const [search, setSearch] = useState('')
const debouncedSearch = useDebounce(search, 300)
useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch])

// useMediaQuery — SSR-safe
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])
  return matches
}

// useCopyToClipboard
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copied, copy }
}
```

---

## Context + useReducer — Estado Complexo

```typescript
// contexts/cart-context.tsx
type CartItem = { id: string; quantity: number; price: number }
type CartState = { items: CartItem[]; total: number }
type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.payload.id)
      const items = existing
        ? state.items.map(i => i.id === action.payload.id
            ? { ...i, quantity: i.quantity + action.payload.quantity }
            : i)
        : [...state.items, action.payload]
      return { items, total: items.reduce((s, i) => s + i.price * i.quantity, 0) }
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter(i => i.id !== action.payload.id)
      return { items, total: items.reduce((s, i) => s + i.price * i.quantity, 0) }
    }
    case 'CLEAR':
      return { items: [], total: 0 }
    default:
      return state
  }
}

const CartContext = createContext<{
  state: CartState
  dispatch: Dispatch<CartAction>
} | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 })
  return <CartContext.Provider value={{ state, dispatch }}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
```

---

## Performance — Quando Usar memo, useMemo, useCallback

**Regra:** não use por padrão. Use apenas quando há problema mensurável.

```tsx
// React.memo — evita re-render de componente filho quando props não mudaram
// Use APENAS quando: o componente é pesado E o pai re-renderiza frequentemente
const ExpensiveList = memo(function ExpensiveList({ items }: { items: Item[] }) {
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
})

// useMemo — memoiza cálculo CARO (não usar para derivações simples)
// ✅ Filtrar/ordenar uma lista grande
const sortedItems = useMemo(
  () => items.filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name)),
  [items]
)

// ❌ NÃO usar — cálculo barato, useMemo custa mais do que economiza
const count = useMemo(() => items.length, [items])  // desnecessário

// useCallback — estabilizar referência de função passada como prop para componente memoizado
// Só faz sentido junto com React.memo no componente filho
const handleDelete = useCallback((id: string) => {
  dispatch({ type: 'REMOVE_ITEM', payload: { id } })
}, [dispatch])  // dispatch do useReducer é estável, não precisa na dep

// Sem useCallback, mesmo que ExpensiveList seja memo, ela re-renderiza
// porque handleDelete é nova função a cada render
<ExpensiveList items={sortedItems} onDelete={handleDelete} />
```

---

## Compound Components Pattern

```tsx
// Componente com sub-componentes que compartilham estado via context
const AccordionContext = createContext<{
  openItem: string | null
  setOpenItem: (id: string | null) => void
} | null>(null)

function Accordion({ children }: { children: ReactNode }) {
  const [openItem, setOpenItem] = useState<string | null>(null)
  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem }}>
      <div className="space-y-1">{children}</div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({ id, title, children }: {
  id: string; title: string; children: ReactNode
}) {
  const ctx = useContext(AccordionContext)!
  const isOpen = ctx.openItem === id
  return (
    <div className="border rounded">
      <button
        className="w-full p-4 text-left flex justify-between"
        onClick={() => ctx.setOpenItem(isOpen ? null : id)}
      >
        {title}
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  )
}

Accordion.Item = AccordionItem

// Uso
<Accordion>
  <Accordion.Item id="1" title="Pergunta 1">Resposta 1</Accordion.Item>
  <Accordion.Item id="2" title="Pergunta 2">Resposta 2</Accordion.Item>
</Accordion>
```

---

## Server vs Client Boundary — App Router

```tsx
// O erro mais comum: passar função como prop de Server para Client
// ❌ Erro — funções não são serializáveis
export default function Page() {
  const handleClick = () => console.log('clicked')  // não serializa
  return <ClientButton onClick={handleClick} />       // ERRO
}

// ✅ Mover o handler para dentro do Client Component
// OU passar via Server Action
export default function Page() {
  return <ClientButton action={serverAction} />   // Server Action é serializável
}

// Passar dados serializáveis de Server para Client
export default async function Page() {
  const data = await fetchData()  // await no Server Component
  return <ClientChart data={data} />  // data (objeto simples) serializa
}

// Context providers devem ser Client Components mas ficam na raiz
// providers.tsx
'use client'
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// layout.tsx (Server Component)
import { Providers } from './providers'
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>  {/* children pode incluir Server Components */}
      </body>
    </html>
  )
}
```

---

## Controlled vs Uncontrolled

```tsx
// Controlled — state vive no React (padrão para forms complexos)
const [value, setValue] = useState('')
<input value={value} onChange={e => setValue(e.target.value)} />

// Uncontrolled — state vive no DOM (ok para forms simples + Server Actions)
const ref = useRef<HTMLInputElement>(null)
<input ref={ref} defaultValue="inicial" />
// Ler: ref.current?.value

// useFormStatus — estado do form pai (só funciona dentro do form)
'use client'
import { useFormStatus } from 'react-dom'
function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar'}</button>
}
```

---

## Anti-Padrões

- `useMemo` em derivações baratas → overhead sem ganho
- `useCallback` sem `React.memo` no filho → sem efeito
- Context com estado global que muda frequentemente → causa re-render em todos os consumidores; usar Zustand ou Jotai
- `useEffect` com `[]` para fetch → usar Server Component ou React Query
- Estado em `useRef` que precisa disparar re-render → usar `useState`
- Passar funções como props de Server → Client sem Server Action → erro de serialização
