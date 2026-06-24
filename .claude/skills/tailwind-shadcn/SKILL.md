---
name: tailwind-shadcn
description: Tailwind CSS + shadcn/ui — cn(), CSS variables para theming, dark mode, cva() para variantes, formulários com React Hook Form + Controller, componentes customizados.
cpe:
  source: cpe-personal
  integrated_at: 2026-06-22
  adaptation: Atlas-authored baseado em ui.shadcn.com e tailwindcss.com
---

# Tailwind CSS + shadcn/ui

## Fundamentos

### cn() — merge de classes (obrigatório)

```typescript
// lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Uso — merge seguro sem conflitos de classe
<div className={cn(
  'base-class',
  isActive && 'text-primary',
  variant === 'ghost' && 'bg-transparent hover:bg-accent',
  className,   // permite override externo
)} />
```

---

## CSS Variables — Design Tokens (shadcn)

```css
/* globals.css — tokens base (light mode) */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... rest of dark tokens */
  }
}
```

**Usar tokens em Tailwind:**
```html
<!-- Via classes bg-background, text-foreground, etc. (shadcn configura automaticamente) -->
<div class="bg-background text-foreground">
<button class="bg-primary text-primary-foreground hover:bg-primary/90">
<p class="text-muted-foreground">
```

---

## cva() — Component Variants

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  // base — sempre presente
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

---

## Formulários — Controller + React Hook Form + Zod

```tsx
// components/forms/profile-form.tsx
'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres.').max(50),
  email: z.string().email('Email inválido.'),
  role: z.enum(['admin', 'member', 'viewer']),
  bio: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function ProfileForm({ onSubmit }: { onSubmit: (data: FormValues) => Promise<void> }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: 'member', bio: '' },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Campo de texto */}
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-1">
            <Label htmlFor={field.name} className={cn(fieldState.invalid && 'text-destructive')}>
              Nome
            </Label>
            <Input
              {...field}
              id={field.name}
              aria-invalid={fieldState.invalid}
              className={cn(fieldState.invalid && 'border-destructive')}
              placeholder="Seu nome"
            />
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        )}
      />

      {/* Select */}
      <Controller
        name="role"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-1">
            <Label>Papel</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-invalid={fieldState.invalid}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        )}
      />

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
```

**Array dinâmico com useFieldArray:**
```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'emails',
})

{fields.map((field, index) => (
  <Controller
    key={field.id}  // SEMPRE field.id, não index — estabilidade de re-render
    name={`emails.${index}.address`}
    control={form.control}
    render={({ field: f, fieldState }) => (
      <div className="flex gap-2">
        <Input {...f} type="email" aria-invalid={fieldState.invalid} />
        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )}
  />
))}
<Button type="button" variant="outline" onClick={() => append({ address: '' })}>
  Adicionar email
</Button>
```

---

## Dark Mode

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',  // ou 'media' para seguir sistema
  // ...
}

// components/theme-toggle.tsx
'use client'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}

// app/layout.tsx — wrapping com ThemeProvider
import { ThemeProvider } from 'next-themes'
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

---

## Padrões de Layout Responsivo

```html
<!-- Grid responsivo -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

<!-- Sidebar layout -->
<div class="flex h-screen">
  <aside class="hidden w-64 shrink-0 border-r lg:block">
  <main class="flex-1 overflow-y-auto p-6">

<!-- Stack → side-by-side -->
<div class="flex flex-col gap-4 md:flex-row md:items-center">

<!-- Container com max-width -->
<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

<!-- Centralizar verticalmente -->
<div class="flex min-h-screen items-center justify-center">
```

---

## Componente com Slot (shadcn pattern)

```tsx
// Permite trocar o elemento HTML mantendo os estilos
import { Slot } from '@radix-ui/react-slot'

interface Props extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
}

function CardLink({ asChild, children, ...props }: Props) {
  const Comp = asChild ? Slot : 'div'
  return <Comp className="rounded-lg border p-4 hover:bg-accent" {...props}>{children}</Comp>
}

// Uso — renderiza como <a> mas com estilos do CardLink
<CardLink asChild>
  <a href="/page">Ir para página</a>
</CardLink>
```

---

## Anti-Padrões

- Classes inline em vez de tokens CSS (`text-[#333]` → usar `text-foreground`)
- `style={{ color: ... }}` no lugar de classes Tailwind
- Conflito de classes sem `cn()` + `twMerge` → resultado imprevisível
- `index` como key no `useFieldArray` → bugs de re-render
- Não usar `field.id` do RHF → instabilidade
- Dark mode com `style` em vez de classes Tailwind → não funciona com `next-themes`
- Omitir `aria-invalid` nos campos → inacessível
