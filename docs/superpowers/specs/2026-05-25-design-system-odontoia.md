# Design System Oficial — Odonto.IA

> Source of truth extraída do dashboard reformulado (maio 2026).
> Toda tela nova ou refatorada deve seguir este documento.
> NÃO reinventar. NÃO misturar padrões antigos.

---

## 1. Visual Foundations

### 1.1 Tipografia

Três fontes com papéis fixos. Nunca misturar.

| Papel | Fonte | Classe Tailwind | Uso |
|---|---|---|---|
| Heading | Geist | `font-heading` | Títulos de página, nomes em hero, seções principais |
| Body | Outfit | `font-sans` (default) | Todos os textos corridos, labels, descrições |
| Mono | DM Mono | `font-mono` | Horas, números de métricas, códigos, indicadores de sistema |

#### Hierarquia de tamanhos

```
PAGE HERO / GREETING
  font-heading font-bold text-4xl md:text-5xl tracking-tight
  → "Bom dia, Dr. Nome." / nome do paciente no hero

SECTION HEADING
  font-heading text-2xl (ou text-3xl md:text-4xl para secretaria)
  → "Agenda de Hoje" / "Ações Rápidas"

METRIC NUMBER (dominante)
  font-heading font-bold text-6xl md:text-7xl leading-none tracking-tight
  → Cards de KPI principais (dentista)

METRIC NUMBER (secundário)
  font-mono text-3xl font-semibold tracking-tight
  → Cards de KPI compactos (secretaria), attention panel

TIME DISPLAY
  font-mono text-2xl font-bold tracking-tight
  → Hora no hero; font-mono text-sm font-semibold → hora em lista

BODY TEXT
  text-base font-medium text-text-secondary
  → Subtítulo do header, descrições

CARD LABEL
  text-sm font-semibold text-text-primary
  → Título dentro de card, nome em lista

CAPTION / META
  text-xs text-text-secondary
  → Sub-label de cards, observações, contexto

MICRO LABEL
  text-[10px] font-bold uppercase tracking-[0.2em] font-mono
  → Data no header, state label no hero ("PRÓXIMO ATENDIMENTO")
  text-[10px] font-bold uppercase tracking-widest text-text-secondary
  → Label de ícone em metric cards secundários

STATUS / BADGE TEXT
  text-[11px] font-semibold  → StatusBadge
  text-[10px] font-bold uppercase tracking-wider  → badges monospace
```

---

### 1.2 Paleta de Cores

#### Tokens canônicos (definidos em `globals.css`)

```css
/* Marca */
--color-teal:      #2f9c85  /* primário — positivo, ativo, brand */
--color-teal-lt:   #5dbeb0  /* hover sobre primário */
--color-teal-dark: #1e7060  /* gradiente escuro do botão primário */
--color-teal-pale: #e4f4f1  /* fundo de estado selecionado (light) */
                   #1e3a35  /* dark mode */

--color-coral:     #e57373  /* negativo — cancelado, faltou, erro (light) */
               →   #ef9a9a  /* dark mode */
--color-coral-pale:#fce8e8  /* fundo coral (light) */
                   #3d1f1f  /* dark mode */

/* Superfícies */
--color-bg:           #f4f4f6  /  #0d0d0d   /* página */
--color-surface:      #ffffff  /  #111112   /* card */
--color-surface-alt:  #ebebed  /  #1c1c1e   /* hover de item, botão inativo */
--color-border:       #e2e2e5  /  #27272a   /* todas as bordas */

/* Texto */
--color-text-primary:   #09090b  /  #fafafa   /* texto principal */
--color-text-secondary: #71717a  /  #a1a1aa   /* texto de suporte */
--color-text-muted:     #d9d9d9  /  #404040   /* desabilitado */
```

#### Cores semânticas de status

| Status | Background (light) | Texto (light) | Borda | Dot |
|---|---|---|---|---|
| `scheduled` (aguardando) | `bg-amber-50` | `text-amber-700` | `border-amber-200` | `bg-amber-400` |
| `confirmed` | `bg-teal-pale` | `text-teal` | `border-teal/20` | `bg-teal` |
| `checked_in` | `bg-blue-50` | `text-blue-700` | `border-blue-200` | `bg-blue-500` |
| `in_progress` | `bg-purple-50` | `text-purple-700` | `border-purple-200` | `bg-purple-500 animate-pulse` |
| `completed` | `bg-surface-alt` | `text-text-secondary` | `border-border` | `bg-border` |
| `no_show` | `bg-red-50` | `text-red-600` | `border-red-200` | `bg-red-500` |
| `cancelled` | `bg-surface-alt` | `text-text-secondary` | `border-border` | `bg-border` |

Dark mode: substituir por variantes `/20` da cor + `dark:` prefix.

#### Cores de atenção (UI)

| Situação | Cor |
|---|---|
| Urgência / alerta | amber (`#f59e0b`) |
| Positivo / sucesso | teal (`#2f9c85`) |
| Negativo / erro | coral / red |
| Neutro / inativo | text-secondary / surface-alt |

---

### 1.3 Spacing System

Unidade base: `4px` (1 unidade Tailwind).

| Contexto | Valor | Tailwind |
|---|---|---|
| Container page | `16px sm:24px lg:32px` | `p-4 sm:p-6 lg:p-8` |
| Max width | `1152px` | `max-w-6xl mx-auto w-full` |
| Entre seções | `32px md:40px` | `mb-8 md:mb-10` |
| Entre cards (grid) | `12px md:16px` | `gap-3 md:gap-4` |
| Entre cards grandes | `16px` | `gap-4` |
| Entre seções maiores | `24px` | `gap-6` |
| Padding card compacto | `20px` | `p-5` |
| Padding card padrão | `24px` | `p-6` |
| Padding hero | `32px md:48px` | `p-8 md:p-12` |
| Padding item de lista | `12px` | `p-3` |
| Padding action link | `16px` | `p-4` |

---

### 1.4 Border Radius

| Elemento | Classe | px equivalente |
|---|---|---|
| Item de lista, filtro pill, dropdown item | `rounded-lg` | ~8px |
| Modal, dropdown container, inline button | `rounded-xl` | ~11px |
| Card padrão, lista container, action link | `rounded-2xl` | ~14px |
| Card proeminente, hero, metric, attention | `rounded-3xl` | ~18px |
| Ícone container pequeno (w-7/w-9) | `rounded-lg` | ~8px |
| Ícone container médio (w-12/w-14) | `rounded-2xl` | ~14px |
| Badges, status pills | `rounded-full` | ~9999px |
| Inline status badge (monospace) | `rounded-lg` | ~8px |

---

### 1.5 Shadows & Elevation

```
NÍVEL 0 — sem sombra
  Itens de lista, filtros, badges

NÍVEL 1 — shadow-sm
  Cards padrão: bg-surface rounded-2xl border shadow-sm
  → Usado em: lista container, action links, metric cards secundários

NÍVEL 2 — hover:shadow-md
  Estado de hover em cards clicáveis
  → hover:-translate-y-0.5 hover:shadow-md transition-all

NÍVEL 3 — hero shadow customizada
  Neutro: box-shadow: 0 16px 48px -16px rgba(0,0,0,0.06)
  Teal suave: 0 0 0 4px rgba(47,156,133,0.04), 0 16px 48px -16px rgba(47,156,133,0.14)
  Teal médio: 0 0 0 4px rgba(47,156,133,0.08), 0 16px 48px -16px rgba(47,156,133,0.25)
  Teal forte:  0 0 0 4px rgba(47,156,133,0.10), 0 16px 48px -16px rgba(47,156,133,0.30)
  Amber:       0 0 0 4px rgba(245,158,11,0.04),  0 16px 48px -16px rgba(245,158,11,0.12)

NÍVEL 4 — botão primário
  box-shadow: 0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)
```

---

### 1.6 Accent Bars (bordas de identidade)

Padrão extraído do hero e metric cards. Nunca usar sem propósito semântico.

```
Bottom accent (métrica ativa):
  h-[2px] absolute inset-x-0 bottom-0
  background: linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.3) 60%, transparent 100%)

Top accent bar (hero):
  h-[2px] ou h-[3px] (ativo/iminente)
  Teal ativa:   linear-gradient(90deg, #2f9c85 0%, #2f9c85 25%, rgba(47,156,133,0.55) 65%, transparent 100%)
  Teal iminente: linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.75) 55%, transparent 100%)
  Amber:         linear-gradient(90deg, #f59e0b 0%, rgba(245,158,11,0.5) 55%, transparent 100%)
  Neutro/cinza:  linear-gradient(90deg, rgba(113,113,122,0.18) 0%, transparent 60%)
```

---

### 1.7 Iconografia

- Biblioteca: **Lucide React** exclusivamente
- Tamanhos canônicos: `w-3 h-3`, `w-3.5 h-3.5`, `w-4 h-4`, `w-5 h-5`, `w-6 h-6`
- Ícone fantasma (ghost): `absolute top-0 right-0 w-16 h-16 opacity-[0.04] group-hover:opacity-[0.07]`
- Ícone em container: sempre dentro de `div` com `rounded-lg` ou `rounded-2xl` + `bg-teal/10` (ativo) ou `bg-surface-alt` (neutro)
- NUNCA usar ícone colorido fora de container; cor via `text-teal` ou `text-text-secondary`

---

### 1.8 Radial Gradient de Fundo

Usado no interior de hero e attention cards para transmitir profundidade:

```
Teal (ativo/iminente):
  radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.06) 0%, transparent 60%)

Teal (suave / concluded):
  radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.05) 0%, transparent 60%)

Amber:
  radial-gradient(ellipse 100% 80% at 50% 120%, rgba(245,158,11,0.05) 0%, transparent 60%)

Neutro:
  radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.03) 0%, transparent 60%)
```

---

## 2. Interaction Language

### 2.1 Hover States

| Tipo de elemento | Comportamento |
|---|---|
| Card clicável | `hover:-translate-y-0.5 hover:shadow-md transition-all` |
| Item de lista | `hover:bg-surface-alt transition-colors` |
| Action link (nav) | `hover:border-teal/40 hover:bg-teal/5 transition-all` |
| Link de texto | `hover:text-teal transition-colors` |
| Botão secundário | `hover:bg-surface-alt hover:text-text-primary transition-all` |
| Ghost button | `hover:bg-teal/10 hover:text-teal transition-colors` |
| ChevronRight em card | `group-hover:translate-x-0.5 transition-transform` |
| ArrowRight em link | `hover:gap-2 transition-all` (gap animado) |
| Ícone container em action | `group-hover:bg-teal/20 transition-colors` |
| ArrowRight em action | `group-hover:text-teal transition-colors` |

### 2.2 Active / Press

```
CTA button:   active:scale-[0.98]
Todos botões: .btn-scale = active:scale-[0.98] transition-transform
```

### 2.3 Transitions

- Propriedade padrão: `transition-all` — cobre transform + shadow + cor
- Cores apenas: `transition-colors` — itens de lista, links de texto
- Transform apenas: `transition-transform` — chevrons, arrows
- Duração: sempre a default do Tailwind (150ms) — NUNCA explicitar `duration-*` sem necessidade

### 2.4 Animações de entrada (Framer Motion)

```tsx
// Header de página
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}

// Seção / bloco
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: 0.05 }} // 0.05 → 0.08 → 0.1 → 0.15 em cascata

// Item de lista (linha)
initial={{ opacity: 0, y: 6 }}
animate={{ opacity: 1, y: 0 }}

// Dropdown (abre/fecha)
initial={{ opacity: 0, scale: 0.95, y: -4 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95, y: -4 }}
transition={{ duration: 0.1 }}
```

Usar `AnimatePresence` em qualquer lista que adiciona/remove itens.
Usar `layout` em itens de lista animada para reordenação suave.

### 2.5 Loading States

| Tipo | Como usar |
|---|---|
| Skeleton página | `animate-pulse` + formas que espelham o layout real (mesmos `rounded-*`) |
| Skeleton teal | `.skeleton-teal` — para seções de IA / Dex |
| Skeleton neutro | `bg-surface-alt` shapes |

Regra: skeleton **preserva o tamanho exato** do conteúdo que virá. Nunca usar barra genérica — usar a forma correta (número grande → `h-12 w-16`, título → `h-10 w-72`, etc.).

### 2.6 Indicadores vivos (Live)

```tsx
// Dot pulsante (sistema online, in_progress)
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
</span>

// Status badge dot
<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
// Se in_progress: adicionar animate-pulse ao dot
```

### 2.7 Feedback de ações

- Sucesso: `toast.success("Status atualizado: {label}")` via **Sonner**
- Erro: `toast.error(result.error)`
- Atualização otimista: mudar estado local imediatamente, reverter em erro
- NUNCA mostrar estado de carregamento dentro do botão em ações rápidas — apenas atualizar a lista

---

## 3. Component Patterns

### 3.1 Metric Card — Dominante (KPI Principal)

```tsx
<div className="group relative bg-surface p-6 rounded-3xl border border-border
                hover:-translate-y-0.5 hover:shadow-md transition-all overflow-hidden cursor-default">
  {/* Accent bottom (apenas quando active && value > 0) */}
  {active && (
    <div className="absolute inset-x-0 bottom-0 h-[2px]"
      style={{ background: 'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.3) 60%, transparent 100%)' }} />
  )}
  {/* Número dominante — sempre 2 dígitos com padStart */}
  <div className={`font-heading font-bold text-6xl md:text-7xl leading-none tracking-tight mb-4
                   ${active ? 'text-text-primary' : 'text-text-primary/40'}`}>
    {String(value).padStart(2, '0')}
  </div>
  <p className="text-sm font-semibold text-text-primary leading-snug mb-1">{label}</p>
  <p className={`text-xs ${active ? 'text-teal' : 'text-text-secondary'}`}>{context}</p>
</div>
```

### 3.2 Metric Card — Compacto (KPI Secundário)

```tsx
<div className={`bg-surface p-5 rounded-2xl border shadow-sm
                 hover:-translate-y-0.5 transition-all relative overflow-hidden group
                 ${highlight ? 'border-teal/30' : 'border-border'}`}>
  {/* Ghost icon */}
  <div className="absolute top-0 right-0 p-3 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
    <Icon className="w-16 h-16 text-text-primary" />
  </div>
  {/* Icon + label */}
  <div className="flex items-center gap-2 mb-3">
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                     ${highlight ? 'bg-teal/10' : 'bg-surface-alt'}`}>
      <Icon className={`w-3.5 h-3.5 ${highlight ? 'text-teal' : 'text-text-secondary'}`} />
    </div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{label}</p>
  </div>
  <p className="font-mono text-3xl font-semibold text-text-primary tracking-tight">{value}</p>
  {sub && <p className="text-[11px] text-text-secondary mt-1.5">{sub}</p>}
</div>
```

### 3.3 Hero Section

```tsx
<div className={`mb-8 md:mb-10 rounded-3xl overflow-hidden border ${borderClass}`}
     style={{ boxShadow: shadowValue }}>
  {/* Accent top bar */}
  <div className="h-[2px]" style={{ background: accentGradient }} />
  {/* Body */}
  <div className="p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8"
       style={{ backgroundColor: 'var(--color-surface)', backgroundImage: radialGradient }}>
    {/* Info column */}
    <div className="flex-1 min-w-0">
      {/* Micro label com pulse dot */}
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 text-teal">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
        </span>
        ESTADO
      </div>
      <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight mb-3">{title}</h2>
      {/* Demais info... */}
    </div>
    {/* Visual indicator (countdown ring, etc.) */}
    {/* CTA column */}
    <div className="flex flex-col gap-3 shrink-0">
      {/* Primary button */}
      {/* Secondary link */}
    </div>
  </div>
</div>
```

### 3.4 Lista Container

```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm">
  {items.length === 0 ? (
    <EmptyState icon={Icon} message="Nenhum item encontrado." />
  ) : (
    <div className="p-2 space-y-0.5">
      <AnimatePresence initial={false}>
        {items.map(item => <ListItem key={item.id} {...item} />)}
      </AnimatePresence>
    </div>
  )}
</div>
```

### 3.5 List Item (linha de agendamento)

```tsx
<motion.div layout
  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-alt transition-colors">
  {/* Hora */}
  <div className="w-12 text-right shrink-0">
    <span className="font-mono text-sm font-semibold text-text-primary">{hora}</span>
  </div>
  {/* Divider vertical */}
  <div className="w-px h-8 bg-border shrink-0" />
  {/* Conteúdo */}
  <div className="flex-1 min-w-0">
    <Link href={href}
      className="font-semibold text-sm text-text-primary hover:text-teal transition-colors truncate block">
      {primaryText}
    </Link>
    <p className="text-xs text-text-secondary truncate mt-0.5">{secondaryText}</p>
  </div>
  {/* Badge + ações */}
  <StatusBadge status={status} />
  {/* Ação inline opcional */}
  <button className="shrink-0 text-xs font-semibold text-teal hover:bg-teal/10
                     px-2.5 py-1.5 rounded-lg transition-colors border border-teal/20 whitespace-nowrap">
    {actionLabel}
  </button>
</motion.div>
```

### 3.6 Status Badge

```tsx
// StatusBadge canônico
<span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
  {cfg.label}
</span>
```

Status config via objeto `STATUS_CONFIG` — centralizado, nunca hardcoded inline.

### 3.7 Filter Tabs (seletor tipo pill)

```tsx
// Container
<div className="flex gap-1.5 mb-4 flex-wrap">
  {options.map(opt => (
    <button key={opt.id}
      onClick={() => select(opt.id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        selected === opt.id
          ? 'bg-teal text-white shadow-sm'
          : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
      }`}>
      {opt.label}
    </button>
  ))}
</div>
```

### 3.8 Action Link (navegação rápida)

```tsx
<Link href={href}
  className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl
             hover:border-teal/40 hover:bg-teal/5 transition-all group">
  <div className="w-9 h-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0
                  group-hover:bg-teal/20 transition-colors">
    <Icon className="w-4 h-4 text-teal" />
  </div>
  <div className="min-w-0">
    <p className="text-sm font-semibold text-text-primary">{title}</p>
    <p className="text-xs text-text-secondary">{subtitle}</p>
  </div>
  <ArrowRight className="w-4 h-4 text-text-secondary ml-auto shrink-0 group-hover:text-teal transition-colors" />
</Link>
```

### 3.9 Attention / Alert Card

```tsx
// Urgente (amber)
<Link href={href}
  className="group flex items-center justify-between p-6 rounded-3xl border transition-all
             hover:-translate-y-0.5 hover:shadow-md
             border-amber-500/25 bg-amber-500/[0.04] hover:bg-amber-500/[0.07]">
  <div className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10">
      <Icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
    </div>
    <div>
      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{title}</p>
      <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <span className="font-mono text-3xl font-bold text-amber-600 dark:text-amber-400">{count}</span>
    <ChevronRight className="w-4 h-4 text-text-secondary group-hover:translate-x-0.5 transition-transform" />
  </div>
</Link>

// Neutro (padrão)
// trocar: border-border bg-surface hover:bg-surface-alt, ícone bg-surface-alt text-text-secondary
```

### 3.10 Alert Banner (inline)

```tsx
<div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20
                border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-3.5">
  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
  <div className="flex-1 min-w-0">
    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">{title}</p>
    <p className="text-xs text-amber-600 dark:text-amber-400">{detail}</p>
  </div>
  <Link href={href}
    className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap">
    {cta} →
  </Link>
</div>
```

### 3.11 Botão Primário (CTA principal)

```tsx
<button className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
                   text-[15px] font-bold text-white
                   hover:-translate-y-0.5 active:scale-[0.98] transition-all"
  style={{
    background: 'linear-gradient(135deg, #2f9c85 0%, #1d7a65 100%)',
    boxShadow: '0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
  }}>
  {label}
  <ArrowRight className="w-4 h-4" />
</button>
```

### 3.12 Botão Secundário

```tsx
<button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl
                   text-sm font-semibold text-text-secondary
                   border border-border hover:bg-surface-alt hover:text-text-primary transition-all">
  {label}
</button>
```

### 3.13 Ghost Button (ação inline)

```tsx
// Teal (ação afirmativa)
<button className="text-xs font-semibold text-teal hover:bg-teal/10
                   px-2.5 py-1.5 rounded-lg transition-colors border border-teal/20">
// Neutro
<button className="text-xs font-semibold text-text-secondary hover:bg-surface-alt
                   px-2.5 py-1.5 rounded-lg transition-colors border border-border">
// Destrutivo
<button className="flex items-center gap-2 px-3 py-2 text-xs text-red-500
                   hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg w-full text-left transition-colors">
```

### 3.14 Dropdown Menu

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: -4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: -4 }}
  transition={{ duration: 0.1 }}
  className="absolute right-0 top-8 z-10 bg-surface border border-border rounded-xl shadow-lg p-1 min-w-[120px]">
  {/* Items: ver Ghost Button destrutivo acima */}
</motion.div>
```

Sempre com `<AnimatePresence>` no pai para o exit animation funcionar.

### 3.15 Empty State — Simples (dentro de lista)

```tsx
<div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
  <Icon className="w-10 h-10 opacity-20" />
  <p className="text-sm font-medium">{message}</p>
  {sub && <p className="text-xs opacity-70">{sub}</p>}
</div>
```

### 3.16 Empty State — Elaborado (painel isolado)

```tsx
<div className="bg-surface rounded-3xl border border-border p-10
                flex flex-col items-center justify-center text-center">
  <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20
                  flex items-center justify-center mb-5">
    <Icon className="w-6 h-6 text-teal" />
  </div>
  <p className="font-heading font-semibold text-xl text-text-primary mb-1">{headline}</p>
  <p className="text-sm text-text-secondary leading-relaxed">{sub}</p>
</div>
```

### 3.17 Section Header

```tsx
// Com contagem
<div className="flex items-center gap-2.5 mb-4">
  <Icon className="w-4 h-4 text-text-secondary" />
  <h2 className="font-heading font-semibold text-xl text-text-primary">{title}</h2>
  {hasItems && (
    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
      {count}
    </span>
  )}
</div>

// Com link "ver mais"
<div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
  <h2 className="font-heading text-2xl text-text-primary">{title}</h2>
  <Link href={href} className="text-teal text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
    {cta} <ArrowRight className="w-4 h-4" />
  </Link>
</div>
```

### 3.18 System Online Indicator

```tsx
<div className="hidden sm:flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-2.5 shadow-sm shrink-0">
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
  </span>
  <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">Sistema Online</span>
</div>
```

### 3.19 Alert Chip (inline no hero)

```tsx
<span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5
                 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400
                 border border-amber-500/20">
  <AlertCircle className="w-3 h-3 shrink-0" />
  {text}
</span>
```

---

## 4. Dex Identity

### 4.1 O que é o Dex

O Dex é a **identidade de inteligência operacional** do sistema. Não é chatbot. Não é assistente aberto.

Ele aparece como o "sistema nervoso" que estrutura, processa e acelera o trabalho clínico.

### 4.2 Onde o Dex aparece

| Contexto | Presença |
|---|---|
| Processamento de transcrição (Whisper/Gemini) | Loader com identidade Dex |
| Estruturação de ficha clínica | Estado de processamento |
| Geração de planejamento | Loading + resultado |
| Simplificação de evolução | Feedback de estado |
| Alertas e análises clínicas | Contexto da resposta |
| Onboarding / tour | Narrador do tour (driver.js theme) |

### 4.3 Como aparece

```
NOME: sempre "Dex" — nunca "IA", "Assistente", "GPT"
TOM: direto, técnico, sem personalidade infantil
COR: teal — sempre dentro da paleta canônica
FONTE: font-mono para rótulos de estado ("DEX PROCESSANDO...")
MICRO LABEL: text-[10px] font-bold uppercase tracking-[0.2em] text-teal/60
```

**Loader padrão do Dex:**
```tsx
<div className="skeleton-teal rounded-2xl h-{n} w-{n}" />
// ou animação custom com identidade teal
```

**Rótulo de estado:**
```tsx
<p className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-teal/60">
  Dex processando…
</p>
```

### 4.4 Quando NÃO usar o Dex

- Loading de dados de banco (usar `animate-pulse` neutro)
- Navegação entre páginas
- Carregamento de listas (skeleton padrão)
- Qualquer operação que não seja IA

### 4.5 O que evitar

- NÃO criar avatar / face / personagem visual para o Dex
- NÃO usar humor ou mensagens criativas — clareza sempre
- NÃO mostrar "Dex está pensando..." em operações rápidas
- NÃO usar o nome Dex em toasts genéricos de sucesso/erro
- NÃO transformar o Dex em chat aberto

---

## 5. Layout Container Padrão

```tsx
// Página padrão
<div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">

// Página mais larga (tabelas)
<div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">

// Grid principal (2 colunas — conteúdo + sidebar)
<div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">

// Grid de métricas
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
```

---

## 6. Dark Mode

**Regra absoluta:** todas as cores via tokens CSS, nunca hardcoded.

| PROIBIDO | CORRETO |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-gray-50` | `bg-surface-alt` |
| `text-black` | `text-text-primary` |
| `text-gray-500` | `text-text-secondary` |
| `border-gray-200` | `border-border` |
| `#2f9c85` (inline) | `text-teal` / `bg-teal` |

Para variações contextuais: usar `dark:` prefix com as variantes de dark mode dos status colors (ex.: `dark:bg-amber-900/20 dark:text-amber-400`).

---

## 7. Anti-patterns — O que nunca fazer

| Anti-pattern | Por quê |
|---|---|
| `bg-white` / `text-black` inline | Quebra dark mode |
| Cor hardcoded `#hex` inline em className | Não responde ao tema |
| `text-gray-*` | Usar `text-text-secondary` ou `text-text-muted` |
| Criar novo estilo de card fora deste doc | UI Frankenstein |
| `border-radius` arbitrário | Usar somente os raios canônicos |
| Animações sem Framer Motion | Inconsistência de timing |
| Status sem `STATUS_CONFIG` centralizado | Cores espalhadas |
| Ícone sem container quando em destaque | Hierarquia visual quebrada |
| Empty state genérico com texto plano | Falta de identidade |
| Loader genérico em operação IA | Usar identidade Dex |
| `font-bold text-2xl` sem `font-heading` em título | Hierarquia tipográfica errada |
| Número de métrica sem `font-mono` | Inconsistência de dados |

---

## 8. Checklist de conformidade (por componente novo)

Antes de considerar um componente pronto:

- [ ] Usa `bg-surface` / `bg-surface-alt` / `bg-bg` — não hardcoded
- [ ] Usa `border border-border` — não `border-gray-*`
- [ ] Usa `text-text-primary` / `text-text-secondary` — não `text-gray-*`
- [ ] Usa `font-heading` em títulos, `font-mono` em números/horas
- [ ] Border radius dentro dos 5 valores canônicos
- [ ] Hover state definido (`-translate-y-0.5` ou `bg-surface-alt`)
- [ ] Dark mode funciona sem classe adicional (via tokens)
- [ ] Skeleton preserva a forma exata do conteúdo
- [ ] Status colors via `STATUS_CONFIG` ou tokens semânticos
- [ ] Animações via Framer Motion (não CSS puro)
- [ ] Empty state usando padrão 3.15 ou 3.16
- [ ] Dex identity usada apenas em operações de IA

---

## 9. Data Tables

### 9.1 Density

Duas densidades. Nunca misturar na mesma tela.

| Densidade | Contexto | Row padding | Font size |
|---|---|---|---|
| **Compacta** | Listas clínicas longas (agendamentos, fichas) | `py-2.5 px-4` | `text-sm` |
| **Padrão** | Entidades financeiras, pacientes | `py-3.5 px-4` | `text-sm` |

Container da tabela:
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
  <table className="w-full text-sm">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

### 9.2 Hierarquia de colunas

| Nível | Papel | Estilo |
|---|---|---|
| Primária | Nome, paciente, entidade principal | `font-semibold text-text-primary` |
| Secundária | Data, status, valor | `text-text-secondary font-mono` (números/datas) |
| Terciária | Observações, meta | `text-xs text-text-secondary` |
| Ação | Botões inline | Sempre na última coluna, alinhado à direita |

Header de coluna:
```tsx
<th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary
               border-b border-border bg-surface-alt/60 first:rounded-tl-2xl last:rounded-tr-2xl">
  {label}
</th>
```

### 9.3 Sorting

- Colunas ordenáveis recebem `cursor-pointer hover:text-text-primary transition-colors` no `<th>`
- Ícone: `ChevronUp` / `ChevronDown` de Lucide, `w-3.5 h-3.5` inline após o label
- Coluna ativa: `text-teal` no label + ícone visível; colunas inativas: ícone `opacity-0 group-hover:opacity-40`

```tsx
<th onClick={() => onSort('nome')} className="... cursor-pointer group">
  <span className="flex items-center gap-1">
    Nome
    <ChevronUp className={`w-3.5 h-3.5 transition-all ${
      sort.col === 'nome'
        ? sort.dir === 'asc' ? 'text-teal opacity-100' : 'text-teal opacity-100 rotate-180'
        : 'opacity-0 group-hover:opacity-40'
    }`} />
  </span>
</th>
```

### 9.4 Pagination

Máximo 25 linhas por página. Nunca scroll infinito em tabelas clínicas.

```tsx
<div className="flex items-center justify-between px-4 py-3 border-t border-border">
  {/* Contagem */}
  <p className="text-xs text-text-secondary">
    <span className="font-mono font-semibold text-text-primary">{from}–{to}</span> de{' '}
    <span className="font-mono font-semibold text-text-primary">{total}</span> resultados
  </p>
  {/* Navegação */}
  <div className="flex items-center gap-1">
    <button disabled={page === 1}
      className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt disabled:opacity-30
                 disabled:cursor-not-allowed transition-colors">
      <ChevronLeft className="w-4 h-4" />
    </button>
    {/* Páginas numéricas — máx 5 visíveis, resto com ellipsis */}
    {pages.map(p => (
      <button key={p}
        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
          p === page
            ? 'bg-teal text-white'
            : 'text-text-secondary hover:bg-surface-alt'
        }`}>
        {p}
      </button>
    ))}
    <button disabled={page === totalPages}
      className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt disabled:opacity-30
                 disabled:cursor-not-allowed transition-colors">
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
</div>
```

### 9.5 Seleção de linhas

Row selecionada: `bg-teal/[0.04] border-l-2 border-teal` na `<tr>`.
Row não selecionada: `border-l-2 border-transparent`.

Barra de ação bulk (aparece quando ≥ 1 selecionado):
```tsx
<AnimatePresence>
  {selected.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                 bg-surface border border-border rounded-2xl shadow-lg px-5 py-3
                 flex items-center gap-4">
      <span className="font-mono text-sm font-semibold text-teal">
        {selected.length} selecionado{selected.length > 1 ? 's' : ''}
      </span>
      <div className="w-px h-4 bg-border" />
      {/* Ações: ghost buttons padrão 3.13 */}
      <button className="text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                         px-3 py-1.5 rounded-lg transition-colors">
        Excluir
      </button>
    </motion.div>
  )}
</AnimatePresence>
```

### 9.6 Ações de linha

Três padrões — escolher um por contexto, não misturar:

| Padrão | Quando usar |
|---|---|
| **Ghost button inline** | 1 ação primária sempre visível (ex.: "Abrir consulta") |
| **Hover reveal** | 2–3 ações secundárias que poluiriam se sempre visíveis |
| **Kebab (⋮)** | 3+ ações de gestão (editar, arquivar, excluir) |

Hover reveal:
```tsx
<td className="pr-4 text-right">
  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
    {/* Ghost buttons 3.13 neutro */}
  </div>
</td>
// <tr> deve ter className="group"
```

### 9.7 Loading (skeleton de tabela)

```tsx
{/* Header fica visível; apenas rows ficam como skeleton */}
{Array.from({ length: 8 }).map((_, i) => (
  <tr key={i} className="border-b border-border animate-pulse">
    <td className="px-4 py-3"><div className="h-4 w-32 bg-surface-alt rounded-lg" /></td>
    <td className="px-4 py-3"><div className="h-4 w-20 bg-surface-alt rounded-lg" /></td>
    <td className="px-4 py-3"><div className="h-5 w-16 bg-surface-alt rounded-full" /></td>
    <td className="px-4 py-3 text-right"><div className="h-6 w-14 bg-surface-alt rounded-lg ml-auto" /></td>
  </tr>
))}
```

Regra: as widths dos skeletons devem espelhar o conteúdo esperado de cada coluna.

### 9.8 Empty state em tabela

Usar padrão 3.16 (elaborado), centralizado na área da tabela:

```tsx
<tr>
  <td colSpan={totalCols} className="py-16">
    {/* padrão 3.16 — Empty State elaborado */}
  </td>
</tr>
```

### 9.9 Mobile fallback

Tabelas NUNCA fazem scroll horizontal em mobile. Abaixo de `md:`, renderizar como lista de cards.

```tsx
{/* Desktop */}
<div className="hidden md:block">
  <DataTable ... />
</div>

{/* Mobile — card list */}
<div className="md:hidden space-y-2">
  {items.map(item => (
    <div key={item.id}
      className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
      {/* Dados primário + secundário empilhados */}
      {/* Status badge */}
      {/* ChevronRight link */}
    </div>
  ))}
</div>
```

---

## 10. Forms

### 10.1 Input padrão

```tsx
<input
  className="w-full px-4 py-3 rounded-xl border border-border bg-surface
             text-sm text-text-primary placeholder:text-text-muted
             focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/60
             transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
```

Variações por estado:

| Estado | Classes adicionais |
|---|---|
| Default | `border-border` |
| Focus | `ring-2 ring-teal/20 border-teal/60` (automático via focus:) |
| Error | `border-coral/60 ring-2 ring-coral/20 focus:ring-coral/20 focus:border-coral/60` |
| Disabled | `opacity-50 cursor-not-allowed bg-surface-alt` |
| Read-only | `bg-surface-alt cursor-default` |

### 10.2 Label

```tsx
<label className="block text-sm font-semibold text-text-primary mb-1.5">
  {label}
  {required && <span className="text-coral ml-0.5">*</span>}
</label>
```

Label opcional:
```tsx
<span className="text-xs font-normal text-text-secondary ml-1">(opcional)</span>
```

### 10.3 Mensagens de validação

Erro (abaixo do input, sempre):
```tsx
{error && (
  <p className="mt-1.5 text-xs text-coral flex items-center gap-1">
    <AlertCircle className="w-3 h-3 shrink-0" />
    {error}
  </p>
)}
```

Hint (abaixo do input, sem erro):
```tsx
<p className="mt-1.5 text-xs text-text-secondary">{hint}</p>
```

Sucesso inline (campo validado assincronamente):
```tsx
<div className="relative">
  <input ... />
  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal" />
</div>
```

### 10.4 Field group (campo + label + mensagem)

```tsx
<div className="space-y-1.5">
  <label className="block text-sm font-semibold text-text-primary">
    {label}{required && <span className="text-coral ml-0.5">*</span>}
  </label>
  <input className={`... ${error ? 'border-coral/60 ring-2 ring-coral/20' : ''}`} />
  {error
    ? <p className="text-xs text-coral flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>
    : hint && <p className="text-xs text-text-secondary">{hint}</p>
  }
</div>
```

### 10.5 Sections de formulário

Formulários com mais de 5 campos devem ser agrupados em sections:

```tsx
<div className="space-y-8">
  <section>
    <div className="mb-5">
      <h3 className="font-heading font-semibold text-base text-text-primary">{sectionTitle}</h3>
      {sectionSub && <p className="text-sm text-text-secondary mt-0.5">{sectionSub}</p>}
    </div>
    <div className="space-y-4">
      {/* fields */}
    </div>
  </section>

  <div className="h-px bg-border" /> {/* Divider entre sections */}

  <section>...</section>
</div>
```

### 10.6 Multi-step

Step indicator:
```tsx
<div className="flex items-center gap-2 mb-8">
  {steps.map((step, i) => (
    <React.Fragment key={step.id}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                        transition-all ${
          i < current ? 'bg-teal text-white'
          : i === current ? 'bg-teal text-white ring-4 ring-teal/20'
          : 'bg-surface-alt text-text-secondary border border-border'
        }`}>
          {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
        </div>
        <span className={`text-sm font-semibold hidden sm:block ${
          i === current ? 'text-text-primary' : 'text-text-secondary'
        }`}>
          {step.label}
        </span>
      </div>
      {i < steps.length - 1 && (
        <div className={`flex-1 h-px transition-all ${i < current ? 'bg-teal' : 'bg-border'}`} />
      )}
    </React.Fragment>
  ))}
</div>
```

Navegação entre steps: botões Primário (avançar) + Secundário (voltar) lado a lado.
Avançar só ativo quando step atual é válido.

### 10.7 Sticky actions bar

Formulários longos (> 3 sections) ou em drawer/sheet:

```tsx
<div className="sticky bottom-0 z-10 bg-surface border-t border-border px-6 py-4
                flex items-center justify-between gap-3
                -mx-6"> {/* compensar padding do container */}
  <button type="button" className={/* Botão Secundário 3.12 */}>
    Cancelar
  </button>
  <button type="submit" disabled={isSubmitting} className={/* Botão Primário 3.11 */}>
    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
    {isSubmitting ? 'Salvando…' : 'Salvar'}
  </button>
</div>
```

### 10.8 Estados async do botão de submit

```tsx
// Idle
<button>Salvar alterações</button>

// Loading — spinner + texto alterado
<button disabled>
  <Loader2 className="w-4 h-4 animate-spin" />
  Salvando…
</button>

// Sucesso momentâneo (1.5s → volta ao idle)
<button disabled className="bg-teal/80"> {/* mesmo estilo, tom reduzido */}
  <Check className="w-4 h-4" />
  Salvo
</button>
```

Regra: NUNCA manter botão em estado "Salvo" permanentemente. Volta ao idle após 1.5s.

---

## 11. Search + Filters

### 11.1 Search bar

```tsx
<div className="relative">
  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
  <input
    type="search"
    placeholder="Buscar paciente…"
    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-surface
               text-sm text-text-primary placeholder:text-text-muted
               focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/60 transition-all" />
  {query && (
    <button onClick={clearQuery}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors">
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

Search bar com `rounded-xl` — nunca `rounded-2xl` (reservado para cards).

### 11.2 Filter chips (ativos)

Cada filtro aplicado aparece como chip removível abaixo da search bar:

```tsx
<div className="flex flex-wrap gap-1.5 mt-2">
  <AnimatePresence>
    {activeFilters.map(filter => (
      <motion.span key={filter.id}
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-semibold
                   bg-teal/10 text-teal border border-teal/20">
        {filter.label}
        <button onClick={() => removeFilter(filter.id)}
          className="hover:bg-teal/20 rounded-full p-0.5 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </motion.span>
    ))}
  </AnimatePresence>

  {/* Limpar todos — apenas quando há filtros */}
  {activeFilters.length > 1 && (
    <button onClick={clearAll}
      className="text-xs font-semibold text-text-secondary hover:text-coral transition-colors px-2 py-1">
      Limpar filtros
    </button>
  )}
</div>
```

### 11.3 Filtros rápidos (pill tabs)

Usar padrão 3.7 para filtros de status/tipo que são mutuamente exclusivos.
Adicionar badge de contagem quando relevante:

```tsx
<button className={`... relative`}>
  {label}
  {count > 0 && (
    <span className={`ml-1.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      selected ? 'bg-white/20 text-white' : 'bg-surface-alt text-text-secondary'
    }`}>
      {count}
    </span>
  )}
</button>
```

### 11.4 Filtros avançados (painel colapsável)

Botão de trigger com contagem de filtros ativos:
```tsx
<button onClick={togglePanel}
  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
    activeCount > 0
      ? 'bg-teal/10 border-teal/30 text-teal'
      : 'bg-surface border-border text-text-secondary hover:text-text-primary'
  }`}>
  <SlidersHorizontal className="w-4 h-4" />
  Filtros
  {activeCount > 0 && (
    <span className="font-mono text-[10px] font-bold bg-teal text-white rounded-full w-4 h-4 flex items-center justify-center">
      {activeCount}
    </span>
  )}
</button>
```

Painel:
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}
      className="mt-2 p-4 bg-surface rounded-2xl border border-border shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Field groups de filtro */}
      </div>
      <div className="flex justify-end mt-4 pt-4 border-t border-border gap-2">
        <button onClick={reset} className={/* ghost neutro */}>Limpar</button>
        <button onClick={apply} className={/* primário */}>Aplicar</button>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### 11.5 Estado vazio de busca

Quando search retorna 0 resultados (diferente do empty state de "sem dados"):

```tsx
<div className="flex flex-col items-center py-12 gap-2 text-text-secondary">
  <Search className="w-8 h-8 opacity-20" />
  <p className="text-sm font-semibold text-text-primary">Nenhum resultado para "{query}"</p>
  <p className="text-xs text-text-secondary">Tente termos diferentes ou{' '}
    <button onClick={clearAll} className="text-teal font-semibold hover:underline">limpe os filtros</button>
  </p>
</div>
```

---

## 12. CRUD Feedback

### 12.1 Create

Padrão: otimista quando possível, otherwise loading state no botão.

```
Usuário clica "Criar" →
  [1] Botão entra em loading (spinner)
  [2] Operação executa
  [3a] Sucesso: item aparece no topo da lista com animação Framer Motion
       toast.success("Paciente criado com sucesso")
       Botão volta ao idle
  [3b] Erro: toast.error(mensagem)
       Botão volta ao idle; formulário permanece aberto com dados preenchidos
```

Item novo na lista:
```tsx
<motion.div
  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
  className="...">
```

### 12.2 Update

Atualização inline (ex.: status change):
```
Usuário altera campo →
  [1] Mudança refletida imediatamente (otimista)
  [2] Request em background
  [3a] Sucesso: toast.success silencioso OU sem toast (mudança óbvia visualmente)
  [3b] Erro: reverter para valor anterior + toast.error
```

Atualização via formulário:
```
Usuário salva form →
  [1] Botão entra em loading
  [2] Request executa
  [3a] Sucesso: form fecha (se modal/drawer) + toast.success("Alterações salvas")
  [3b] Erro: form permanece aberto + toast.error + erros de campo marcados
```

### 12.3 Delete

**Nunca deletar com single click.** Sempre exigir confirmação (seção 12.4).

Após confirmação:
```
[1] Item some da lista com animação exit (AnimatePresence + layout)
[2] Toast com undo (seção 12.6) OU toast simples para ações irreversíveis no banco
[3] Se era o único item: empty state aparece com animação
```

Animação de remoção:
```tsx
<AnimatePresence>
  {items.map(item => (
    <motion.div key={item.id} layout
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}>
      ...
    </motion.div>
  ))}
</AnimatePresence>
```

### 12.4 Confirmação de ação destrutiva

Modal pequeno com foco na ação (não no formulário):

```tsx
<div className="bg-surface rounded-2xl border border-border shadow-xl p-6 max-w-sm w-full">
  {/* Ícone de alerta */}
  <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20
                  border border-red-100 dark:border-red-900/40
                  flex items-center justify-center mb-5">
    <Trash2 className="w-5 h-5 text-red-500" />
  </div>

  <h3 className="font-heading font-semibold text-lg text-text-primary mb-1">
    Excluir {entityName}?
  </h3>
  <p className="text-sm text-text-secondary mb-6 leading-relaxed">
    Esta ação não pode ser desfeita. {entityDescription} será removido permanentemente.
  </p>

  {/* Para ações de alto impacto: digitar nome para confirmar */}
  {requireTyping && (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-text-secondary mb-1.5">
        Digite <span className="font-mono text-text-primary">"{confirmText}"</span> para confirmar
      </label>
      <input onChange={e => setTyped(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-sm
                   focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all" />
    </div>
  )}

  <div className="flex gap-3">
    <button onClick={onCancel}
      className={/* Botão Secundário 3.12 — flex-1 */}>
      Cancelar
    </button>
    <button
      onClick={onConfirm}
      disabled={requireTyping && typed !== confirmText}
      className="flex-1 py-3 rounded-2xl text-sm font-bold text-white
                 bg-red-500 hover:bg-red-600 disabled:opacity-40
                 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
      Excluir
    </button>
  </div>
</div>
```

Quando usar "digitar para confirmar": exclusão de clínica, exclusão de dentista, exclusão de dados de paciente.
Quando NÃO usar: cancelar agendamento, remover tag, limpar campo.

### 12.5 Toast patterns (via Sonner)

```ts
// Sucesso
toast.success("Paciente criado com sucesso")
toast.success("Status atualizado: Confirmado")

// Erro (sempre com mensagem humana, nunca stack trace)
toast.error("Não foi possível salvar. Tente novamente.")

// Info (neutro, sem confirmação necessária)
toast.info("Sincronizando agenda…")

// Warning
toast.warning("Agendamento com conflito de horário detectado")
```

Regras:
- NUNCA usar o nome "Dex" em toasts de sucesso/erro de CRUD
- Mensagens na segunda pessoa, imperativo direto: "Salvo", "Criado", "Removido"
- `toast.error` sempre com mensagem acionável, não técnica

### 12.6 Undo pattern

Para deleções reversíveis (soft delete):

```ts
toast("Agendamento cancelado", {
  action: {
    label: "Desfazer",
    onClick: () => handleUndo(id),
  },
  duration: 6000, // 6s para dar tempo de ler e agir
})
```

Regra: só oferecer undo quando há mecanismo real de reversão. Nunca undo falso.

---

## 13. Modal / Drawer / Sheet

### 13.1 Quando usar Modal

| Situação | Modal |
|---|---|
| Confirmação destrutiva | Sim — sempre |
| Formulário focado, ≤ 4 campos | Sim |
| Alerta crítico que bloqueia fluxo | Sim |
| Preview rápido de arquivo/imagem | Sim |
| Formulário complexo, > 4 campos | Não — usar Drawer |
| Detalhe de entidade | Não — usar Drawer ou página |
| Lista de seleção | Não — usar Dropdown ou Sheet |

Container modal:
```
Overlay: bg-black/50 backdrop-blur-sm
Panel: bg-surface rounded-3xl border border-border shadow-2xl
Largura: max-w-sm (confirmação) / max-w-md (form simples) / max-w-lg (form médio)
Padding: p-6
```

Animação (Framer Motion):
```tsx
// Overlay
initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}

// Panel
initial={{ opacity: 0, scale: 0.96, y: 8 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.96, y: 8 }}
transition={{ duration: 0.15 }}
```

### 13.2 Quando usar Drawer (lateral)

| Situação | Drawer |
|---|---|
| Formulário de edição completo (> 4 campos) | Sim |
| Detalhe lateral sem navegar da lista | Sim |
| Configurações contextuais | Sim |
| Ações de gestão de entidade | Sim |
| Ação destrutiva | Não — usar Modal |

Container drawer:
```
Posição: right-0, full height, fixed
Largura: w-full sm:w-[480px] md:w-[560px]
Overlay: bg-black/40 backdrop-blur-sm
Panel: bg-surface border-l border-border shadow-2xl flex flex-col
```

Estrutura interna:
```tsx
<div className="flex flex-col h-full">
  {/* Header fixo */}
  <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
    <div>
      <h2 className="font-heading font-semibold text-lg text-text-primary">{title}</h2>
      {sub && <p className="text-sm text-text-secondary mt-0.5">{sub}</p>}
    </div>
    <button onClick={onClose} className="text-text-secondary hover:text-text-primary hover:bg-surface-alt
                                         p-2 rounded-xl transition-colors">
      <X className="w-5 h-5" />
    </button>
  </div>

  {/* Conteúdo scrollável */}
  <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
    {/* formulário ou detalhe */}
  </div>

  {/* Footer sticky — padrão 10.7 */}
  <div className="sticky bottom-0 px-6 py-4 border-t border-border bg-surface shrink-0">
    {/* ações */}
  </div>
</div>
```

Animação drawer:
```tsx
// Panel
initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
transition={{ type: 'spring', damping: 30, stiffness: 300 }}
```

### 13.3 Quando usar Sheet (bottom)

| Situação | Sheet |
|---|---|
| Mobile — qualquer seleção rápida | Sim |
| Mobile — ações contextuais (≤ 5 ações) | Sim |
| Desktop — seleção de lista curta | Sim |
| Desktop — ação complexa | Não — usar Drawer |
| Confirmação destrutiva | Não — usar Modal |

Container sheet (bottom):
```
Posição: bottom-0, full width
Max-height: max-h-[85dvh]
Panel: bg-surface rounded-t-3xl border-t border-border shadow-2xl
```

Handle visual:
```tsx
<div className="flex justify-center pt-3 pb-1">
  <div className="w-10 h-1 rounded-full bg-border" />
</div>
```

### 13.4 Regra de fechamento

| Tipo | ESC | Click overlay | X button |
|---|---|---|---|
| Modal destrutivo | Sim | Não | Sim |
| Modal form | Sim | Não (dados não salvos) | Sim |
| Drawer | Sim | Sim | Sim |
| Sheet | Sim | Sim | Não (só swipe/handle) |

Modal com form: se usuário clicar no overlay, perguntar "Descartar alterações?" antes de fechar.

---

## 14. Detail View Patterns

### 14.1 Entity Hero (header da entidade)

Para: paciente, dentista, clínica — qualquer entidade com página de detalhe.

```tsx
<div className="bg-surface rounded-3xl border border-border shadow-sm p-6 md:p-8 mb-6
                relative overflow-hidden">
  {/* Radial de fundo — tom neutro */}
  <div className="absolute inset-0 pointer-events-none"
    style={{ backgroundImage: 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.04) 0%, transparent 60%)' }} />

  <div className="relative flex items-start gap-5">
    {/* Avatar / iniciais */}
    <div className="w-16 h-16 rounded-2xl bg-teal/10 border border-teal/20
                    flex items-center justify-center shrink-0">
      <span className="font-heading font-bold text-2xl text-teal">{initials}</span>
    </div>

    <div className="flex-1 min-w-0">
      <h1 className="font-heading font-bold text-3xl text-text-primary tracking-tight">{name}</h1>
      <p className="text-sm text-text-secondary mt-1">{meta}</p>

      {/* Tags / badges */}
      <div className="flex flex-wrap gap-2 mt-3">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                                     text-xs font-semibold bg-surface-alt border border-border text-text-secondary">
            {tag}
          </span>
        ))}
      </div>
    </div>

    {/* Ações de topo */}
    <div className="flex items-center gap-2 shrink-0">
      {/* Ghost buttons + Kebab */}
    </div>
  </div>
</div>
```

### 14.2 Tab navigation

Tabs horizontais logo abaixo do hero:

```tsx
<div className="flex gap-1 mb-6 border-b border-border">
  {tabs.map(tab => (
    <button key={tab.id} onClick={() => setActive(tab.id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all
                  border-b-2 -mb-px ${
        active === tab.id
          ? 'border-teal text-teal'
          : 'border-transparent text-text-secondary hover:text-text-primary'
      }`}>
      <tab.Icon className="w-4 h-4" />
      {tab.label}
      {tab.count !== undefined && (
        <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          active === tab.id ? 'bg-teal/15 text-teal' : 'bg-surface-alt text-text-secondary'
        }`}>
          {tab.count}
        </span>
      )}
    </button>
  ))}
</div>
```

Conteúdo de tab anima na troca:
```tsx
<AnimatePresence mode="wait">
  <motion.div key={active}
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}>
    {tabContent}
  </motion.div>
</AnimatePresence>
```

### 14.3 Layout interno da detail view

```
[Entity Hero — full width]
[Tab Bar — full width]
[Tab Content]
  Grid: grid-cols-1 lg:grid-cols-[1fr_300px] gap-6
  Left: conteúdo principal (timeline, fichas, lista)
  Right: sidebar de contexto (resumo, próximos agendamentos, info rápida)
```

### 14.4 Timeline de atividade

Para fichas clínicas, histórico de pagamentos, log de ações:

```tsx
<div className="space-y-0">
  {events.map((event, i) => (
    <div key={event.id} className="flex gap-4">
      {/* Linha vertical + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
          event.type === 'primary' ? 'bg-teal' : 'bg-border'
        }`} />
        {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-0" />}
      </div>
      {/* Conteúdo */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-text-primary">{event.title}</p>
          <span className="font-mono text-[10px] text-text-secondary">{event.date}</span>
        </div>
        {event.body && <p className="text-sm text-text-secondary leading-relaxed">{event.body}</p>}
      </div>
    </div>
  ))}
</div>
```

### 14.5 Sidebar de contexto

```tsx
<aside className="space-y-4">
  {/* Info card compacto */}
  <div className="bg-surface rounded-2xl border border-border shadow-sm p-5">
    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4">{title}</h3>
    <dl className="space-y-3">
      {fields.map(field => (
        <div key={field.label}>
          <dt className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
            {field.label}
          </dt>
          <dd className="text-sm text-text-primary">{field.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  </div>

  {/* Link de ação contextual */}
  {/* padrão 3.8 — Action Link */}
</aside>
```

---

## 15. AI Interaction Patterns (Dex)

> Complemento da seção 4. Enquanto a seção 4 define identidade e tom, esta seção define os estados visuais de cada fase da interação com IA.

### 15.1 Thinking (pré-processamento)

Usado quando o sistema recebeu a entrada e está preparando o contexto antes de enviar à IA.
Duração esperada: < 1s.

```tsx
<div className="flex items-center gap-3 py-4">
  {/* Três dots pulsando em sequência */}
  <div className="flex gap-1">
    {[0, 1, 2].map(i => (
      <span key={i}
        className="w-1.5 h-1.5 rounded-full bg-teal/60 animate-bounce"
        style={{ animationDelay: `${i * 0.12}s` }} />
    ))}
  </div>
  <p className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-teal/60">
    Dex preparando…
  </p>
</div>
```

### 15.2 Generating (resposta em progresso)

Usado durante streaming de texto ou processamento de longa duração (transcrição, planejamento).

```tsx
{/* Área de resultado com skeleton teal animado */}
<div className="space-y-2 animate-pulse">
  <div className="skeleton-teal h-4 w-3/4 rounded-lg" />
  <div className="skeleton-teal h-4 w-full rounded-lg" />
  <div className="skeleton-teal h-4 w-5/6 rounded-lg" />
</div>

{/* Label sempre presente durante geração */}
<p className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-teal/60 mt-3">
  Dex gerando estrutura…
</p>
```

Para streaming de texto (caractere a caractere):
```tsx
<p className="text-sm text-text-primary leading-relaxed">
  {streamedText}
  {isStreaming && (
    <span className="inline-block w-0.5 h-4 bg-teal ml-0.5 animate-pulse align-middle" />
  )}
</p>
```

### 15.3 Progressive results

Quando o resultado chega em partes (ex.: ficha clínica com múltiplos campos):

```tsx
{/* Campos já gerados aparecem com animação de entrada */}
{generatedFields.map((field, i) => (
  <motion.div key={field.id}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05 }}>
    <FieldResult field={field} />
  </motion.div>
))}

{/* Campos ainda pendentes ficam como skeleton teal */}
{pendingFields.map(field => (
  <div key={field.id} className="skeleton-teal h-12 rounded-xl animate-pulse" />
))}
```

### 15.4 Failure (falha na geração)

```tsx
<div className="bg-surface rounded-2xl border border-border p-5 flex items-start gap-4">
  <div className="w-10 h-10 rounded-xl bg-coral/10 border border-coral/20
                  flex items-center justify-center shrink-0">
    <AlertCircle className="w-4 h-4 text-coral" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-text-primary mb-1">
      Dex não conseguiu processar
    </p>
    <p className="text-xs text-text-secondary leading-relaxed mb-3">
      {humanReadableReason}
    </p>
    <button onClick={onRetry}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal
                 hover:bg-teal/10 px-3 py-1.5 rounded-lg border border-teal/20 transition-colors">
      <RotateCcw className="w-3.5 h-3.5" />
      Tentar novamente
    </button>
  </div>
</div>
```

Mensagens de erro do Dex:
- NUNCA expor erro técnico ("500 Internal Server Error", "timeout")
- SEMPRE mensagem humana: "A transcrição não pôde ser processada. Verifique a qualidade do áudio."
- SEMPRE oferecer ação clara: retry, editar manualmente, pular etapa

### 15.5 Retry

Após retry, o estado volta para **Generating** (15.2) com um detalhe adicional:

```tsx
{isRetrying && (
  <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
    Segunda tentativa…
  </p>
)}
```

Máximo de 2 retries automáticos silenciosos antes de mostrar estado de Failure explícito.
Após 3 falhas: desabilitar retry + mostrar opção de edição manual.

### 15.6 Confidence indicator

Usado quando o Dex retorna um resultado com grau de certeza variável (ex.: interpretação de transcrição ruidosa).

```tsx
// Confiança alta — silencioso, sem indicador visual
// Confiança média — nota sutil
{confidence === 'medium' && (
  <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider mt-2 flex items-center gap-1">
    <Info className="w-3 h-3" />
    Revisar — transcrição com qualidade reduzida
  </p>
)}

// Confiança baixa — alerta visível
{confidence === 'low' && (
  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl
                  bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
    <p className="text-xs text-amber-700 dark:text-amber-400">
      Resultado com baixa confiança — revise antes de salvar
    </p>
  </div>
)}
```

Regra: confiança alta nunca tem indicador — transmite segurança pelo silêncio.

### 15.7 Result card (output da IA)

Container canônico para qualquer output estruturado do Dex:

```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
  {/* Accent teal no topo — identifica resultado de IA */}
  <div className="h-[2px]"
    style={{ background: 'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.3) 60%, transparent 100%)' }} />

  <div className="p-5">
    {/* Dex label */}
    <div className="flex items-center gap-2 mb-4">
      <div className="w-5 h-5 rounded-md bg-teal/10 flex items-center justify-center">
        <Sparkles className="w-3 h-3 text-teal" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-teal/70">
        Dex · {resultType}
      </p>
    </div>

    {/* Conteúdo estruturado */}
    {children}

    {/* Footer com ações */}
    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
      <p className="text-[10px] font-mono text-text-secondary">
        Gerado em {generatedAt}
      </p>
      <div className="flex gap-2">
        <button onClick={onEdit} className={/* ghost neutro */}>Editar</button>
        <button onClick={onAccept} className={/* ghost teal */}>Aceitar</button>
      </div>
    </div>
  </div>
</div>
```

---

## 16. Checklist de conformidade — Interaction Patterns

Extensão do checklist da seção 8 para os novos padrões:

**Data Tables**
- [ ] Desktop usa `<table>`, mobile usa card list (nunca scroll horizontal)
- [ ] Sortable columns com ícone Lucide, coluna ativa em teal
- [ ] Pagination com `font-mono` na contagem, máximo 25 linhas
- [ ] Skeleton rows espelham widths reais das colunas
- [ ] Bulk action bar usa `AnimatePresence` e fica fixed/bottom

**Forms**
- [ ] Input com `focus:ring-2 ring-teal/20` e `border-teal/60` em focus
- [ ] Error state com `border-coral/60` e mensagem com ícone `AlertCircle`
- [ ] Botão submit com spinner + texto "Salvando…" durante loading
- [ ] Sticky actions em formulários longos ou em Drawer/Sheet
- [ ] Multi-step com indicador visual de progresso

**Search + Filters**
- [ ] Search bar com `rounded-xl`, ícone Search à esquerda, X à direita quando preenchido
- [ ] Filtros ativos como chips removíveis com `AnimatePresence`
- [ ] Empty state de busca diferencia "sem dados" de "sem resultados para query"
- [ ] Botão de filtro avançado mostra contagem de filtros ativos

**CRUD Feedback**
- [ ] Delete sempre tem confirmação modal antes de executar
- [ ] Ações destrutivas de alto impacto exigem digitação do nome
- [ ] Undo pattern disponível para soft-delete, nunca para hard-delete
- [ ] Toast messages em português, diretas, sem jargão técnico

**Modal / Drawer / Sheet**
- [ ] Modal: max-w-sm (confirmação) ou max-w-md (form), nunca para listas longas
- [ ] Drawer: spring animation, header fixo, conteúdo scrollável, footer sticky
- [ ] Sheet: handle visual, `rounded-t-3xl`, máx 85dvh
- [ ] Overlay com `backdrop-blur-sm`

**Detail View**
- [ ] Entity Hero com avatar de iniciais em teal
- [ ] Tab bar com `border-b-2 border-teal` na aba ativa
- [ ] Troca de tab com `AnimatePresence mode="wait"`
- [ ] Sidebar de contexto máx 300px

**AI / Dex Patterns**
- [ ] Thinking state com dots animados em sequência (`animationDelay`)
- [ ] Generating state com `.skeleton-teal animate-pulse`
- [ ] Result card com accent teal no topo e label "Dex · tipo"
- [ ] Falha com mensagem humana + botão "Tentar novamente"
- [ ] Confiança alta: silencioso. Média: nota. Baixa: alerta amber
- [ ] Nome "Dex" nunca aparece em toasts de CRUD comum
