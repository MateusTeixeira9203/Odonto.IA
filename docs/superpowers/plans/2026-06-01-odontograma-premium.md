# Plan — Sprint 2.1: Odontograma Premium

**Goal:** Transform the Odontograma from a compact widget into a clinical protagonist tool.  
**Spec:** `docs/superpowers/specs/2026-06-01-odontograma-premium-sprint2-1.md`  
**Single file modified:** `src/components/odontograma/Odontograma.tsx`

## Architecture Overview

The component is a self-contained SVG tooth renderer with no external UI library dependencies (today). All changes are visual: scaling the `DIMS` constant, adjusting CSS-in-JS styles on SVG paths, and replacing the inline legend with a state-driven absolute panel. No props change, no logic change, no new files.

## Tech Stack

- React (useState, Fragment — already imported)
- Tailwind CSS v4 utility classes
- CSS custom properties (`var(--color-*)`) — already used throughout
- `lucide-react` — already a project dependency, not yet imported in this file

## File Structure Map

| File | Change |
|------|--------|
| `src/components/odontograma/Odontograma.tsx` | **Modified** |

---

## Task 1: Scale DIMS 1.6x

**File:** `src/components/odontograma/Odontograma.tsx`  
**Lines:** `DIMS` constant (lines 64–75)

Replace the `DIMS` constant with 1.6× scaled values. Also scale `rx` proportionally (÷3 ratio: 4→6, 3→5).

**Steps:**

1. Open `src/components/odontograma/Odontograma.tsx`

2. Replace the entire `DIMS` constant (lines 64–75):

```typescript
const DIMS: Record<ToothClass, Dim> = {
  central:     { w: 35, crownH: 48, rootH: 35, rx: 6, isMolar: false },
  lateral:     { w: 29, crownH: 43, rootH: 32, rx: 6, isMolar: false },
  canine:      { w: 32, crownH: 51, rootH: 42, rx: 5, isMolar: false },
  premolar:    { w: 37, crownH: 45, rootH: 34, rx: 5, isMolar: false },
  molar1:      { w: 51, crownH: 45, rootH: 29, rx: 5, isMolar: true  },
  molar2:      { w: 48, crownH: 42, rootH: 27, rx: 5, isMolar: true  },
  molar3:      { w: 43, crownH: 38, rootH: 24, rx: 5, isMolar: true  },
  dec_incisor: { w: 24, crownH: 32, rootH: 24, rx: 5, isMolar: false },
  dec_canine:  { w: 26, crownH: 35, rootH: 27, rx: 5, isMolar: false },
  dec_molar:   { w: 35, crownH: 34, rootH: 22, rx: 5, isMolar: true  },
};
```

3. Commit: `git commit -m "feat: scale odontogram teeth 1.6x — DIMS update"`

---

## Task 2: Update tooth button layout — gap, numbers, hover scale

**File:** `src/components/odontograma/Odontograma.tsx`  
**Function:** `renderArch` (inside `Odontograma` component)

Two changes:
- Number font size: `8px` → `10px`, gap: `3` → `5`
- Hover scale: `1.12` → `1.10`, active scale: `1.06` → `1.04`
- Arch row gap: `gap-[2px]` → `gap-[3px]`

**Steps:**

1. In the `renderArch` function, find the `<button>` element's `style` prop (around line 309). Update `transform` and `gap`:

```typescript
style={{
  transform: isHov ? 'scale(1.10)' : isActive ? 'scale(1.04)' : 'scale(1)',
  transition: 'transform 0.13s ease',
  gap: 5,
}}
```

2. Update **both** number `<span>` elements (one for upper arch, one for lower arch). Change `fontSize` from `'8px'` to `'10px'`:

```typescript
// Upper number span (isUpper branch):
style={{
  fontSize: '10px',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: numColor,
  lineHeight: 1,
  letterSpacing: '-0.3px',
  transition: 'color 0.13s',
  userSelect: 'none',
  pointerEvents: 'none',
}}

// Lower number span (!isUpper branch) — identical change:
style={{
  fontSize: '10px',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
  color: numColor,
  lineHeight: 1,
  letterSpacing: '-0.3px',
  transition: 'color 0.13s',
  userSelect: 'none',
  pointerEvents: 'none',
}}
```

3. Update the **upper arch** `<div>` gap (find `gap-[2px]` next to `items-end`):

```tsx
<div className="flex items-end gap-[3px]">
```

4. Update the **lower arch** `<div>` gap (find `gap-[2px]` next to `items-start`):

```tsx
<div className="flex items-start gap-[3px]">
```

5. Commit: `git commit -m "feat: increase tooth numbers to 10px, reduce hover scale, widen arch gap"`

---

## Task 3: Improve ToothSVG — selected contrast + historical visibility

**File:** `src/components/odontograma/Odontograma.tsx`  
**Function:** `ToothSVG`

Changes:
- `selected` crown: stroke 1.5 → 2, add drop-shadow filter
- `selected` root: add teal tint to fill
- `historical` crown fill: 14% → 20% tint
- `historical` crown stroke: 45% → 55%
- `selected` number weight: 700 → 800 (handled in renderArch, not ToothSVG)

**Steps:**

1. In `ToothSVG`, update `strokeW`:

```typescript
const strokeW = state === 'selected' ? 2 : (state === 'shared' || hovered) ? 1.5 : 1;
```

2. Update `crownFill` — change historical tint from `14%` to `20%`:

```typescript
const crownFill =
  state === 'selected'    ? 'var(--color-teal)'
  : state === 'shared'    ? 'color-mix(in srgb, var(--color-teal) 25%, var(--color-surface-alt))'
  : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))'
  : 'var(--color-surface-alt)';
```

3. Update `crownStroke` — change historical stroke from `45%` to `55%`:

```typescript
const crownStroke =
  hovered                   ? 'var(--color-teal)'
  : state === 'selected'    ? 'var(--color-teal)'
  : state === 'shared'      ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-border))'
  : state === 'historical'  ? 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))'
  : 'var(--color-border)';
```

4. Add a `crownFilter` variable for the drop-shadow:

```typescript
const crownFilter =
  state === 'selected'
    ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-teal) 45%, transparent))'
    : 'none';
```

5. Update the **Root** `<path>` — add teal tint to fill when selected:

```tsx
<path
  d={isUpper ? upperRoot(w, crownH, rootH) : lowerRoot(w, rootH)}
  style={{
    fill: state === 'selected'
      ? 'color-mix(in srgb, var(--color-teal) 18%, var(--color-surface-alt))'
      : hovered
      ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
      : 'var(--color-surface-alt)',
    stroke: hovered ? 'color-mix(in srgb, var(--color-teal) 35%, var(--color-border))' : 'var(--color-border)',
    strokeWidth: 0.6,
    opacity: rootOpacity,
    transition: 'fill 0.15s, opacity 0.15s, stroke 0.15s',
  }}
/>
```

6. Update the **Crown** `<path>` — add `filter`:

```tsx
<path
  d={isUpper ? upperCrown(w, crownH, rx) : lowerCrown(w, crownH, rootH, rx)}
  style={{
    fill: crownFill,
    stroke: crownStroke,
    strokeWidth: strokeW,
    filter: crownFilter,
    transition: 'fill 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease, filter 0.15s ease',
  }}
/>
```

7. In `renderArch`, update `numColor` to use `fontWeight: 800` for selected state:

Find the existing number span styles. Change `fontWeight` conditionally. Replace both number spans:

```typescript
const numWeight = (state === 'selected' || state === 'shared') ? 800 : 700;
```

Add `numWeight` above the `return (` in `renderArch`, then use it in both spans:

```typescript
// Inside renderArch, before return:
const numWeight = (state === 'selected' || state === 'shared') ? 800 : 700;
```

Then in both number spans, change `fontWeight: 700` to `fontWeight: numWeight`.

8. Commit: `git commit -m "feat: strengthen selected tooth contrast — drop-shadow, root tint, bolder number"`

---

## Task 4: Improve quadrant labels + midline separator

**File:** `src/components/odontograma/Odontograma.tsx`  
**Location:** Inside the chart `<div>` in the `Odontograma` return JSX

Changes:
- Quadrant label font: `8px` → `9px`, tracking: `0.18em` → `0.22em`, margin: `mb-1.5`/`mt-1.5` → `mb-2`/`mt-2`
- Midline separator: height `1` → `2`, `my-[5px]` → `my-[8px]`

**Steps:**

1. Find the **upper quadrant labels** `<div>` (around line 408). Change `mb-1.5` to `mb-2` and both `<span>` font sizes from `text-[8px]` to `text-[9px]` and tracking from `tracking-[0.18em]` to `tracking-[0.22em]`:

```tsx
<div className="flex w-full justify-between mb-2 px-1">
  <span
    className="text-[9px] uppercase tracking-[0.22em] font-semibold"
    style={{ color: 'var(--color-text-muted)' }}
  >
    Sup. Direito
  </span>
  <span
    className="text-[9px] uppercase tracking-[0.22em] font-semibold"
    style={{ color: 'var(--color-text-muted)' }}
  >
    Sup. Esquerdo
  </span>
</div>
```

2. Find the **lower quadrant labels** `<div>` (around line 451). Change `mt-1.5` to `mt-2`, same font/tracking updates:

```tsx
<div className="flex w-full justify-between mt-2 px-1">
  <span
    className="text-[9px] uppercase tracking-[0.22em] font-semibold"
    style={{ color: 'var(--color-text-muted)' }}
  >
    Inf. Direito
  </span>
  <span
    className="text-[9px] uppercase tracking-[0.22em] font-semibold"
    style={{ color: 'var(--color-text-muted)' }}
  >
    Inf. Esquerdo
  </span>
</div>
```

3. Find the **midline separator** `<div>` (around line 434). Update `my-[5px]` → `my-[8px]` and `height: 1` → `height: 2`:

```tsx
<div
  className="w-full my-[8px]"
  style={{
    height: 2,
    background: 'linear-gradient(90deg, transparent, var(--color-border) 15%, var(--color-border) 85%, transparent)',
  }}
/>
```

4. Commit: `git commit -m "feat: improve quadrant labels and midline separator readability"`

---

## Task 5: Replace inline legend with Legenda popover panel

**File:** `src/components/odontograma/Odontograma.tsx`

This task has two parts:
- Add `legendOpen` state and import `List` from lucide-react
- Move legend button into tab bar; replace inline legend block with absolute panel

**Steps:**

1. Add the lucide import at the top of the file (after existing imports):

```typescript
import { List } from 'lucide-react';
```

2. Inside the `Odontograma` function, add the new state after existing state declarations:

```typescript
const [legendOpen, setLegendOpen] = useState(false);
```

3. Find the **tab bar** `<div>` (around line 372–400). It currently looks like:

```tsx
<div
  className="flex items-center gap-0 border-b"
  style={{ borderColor: 'var(--color-border)' }}
>
```

Replace it with a `relative` wrapper + the legend button + legend panel:

```tsx
<div
  className="relative flex items-center gap-0 border-b"
  style={{ borderColor: 'var(--color-border)' }}
>
  {([
    { id: 'permanent', label: 'Permanentes' },
    { id: 'deciduous', label: 'Decíduos' },
  ] as const).map(({ id, label }) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className="relative px-4 py-2 text-[11px] font-bold tracking-wide transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal"
      style={{
        color: tab === id ? 'var(--color-teal)' : 'var(--color-text-secondary)',
        background: 'transparent',
      }}
    >
      {label}
      {tab === id && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
          style={{ background: 'var(--color-teal)' }}
        />
      )}
    </button>
  ))}

  <div className="flex-1" />

  {/* Legenda button */}
  <button
    type="button"
    onClick={() => setLegendOpen(v => !v)}
    className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-teal rounded-sm"
    style={{ color: legendOpen ? 'var(--color-teal)' : 'var(--color-text-secondary)' }}
    aria-expanded={legendOpen}
    aria-label="Legenda do odontograma"
  >
    <List size={11} strokeWidth={2.2} />
    Legenda
  </button>

  {/* Legend panel */}
  {legendOpen && (
    <div
      className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border p-3 flex flex-col gap-3 shadow-lg"
      style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      {[
        {
          fill: 'var(--color-surface-alt)',
          stroke: 'var(--color-border)',
          strokeW: 1,
          filter: 'none',
          label: 'Sem registro',
          desc: 'Nenhum registro neste dente',
        },
        {
          fill: 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))',
          stroke: 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))',
          strokeW: 1,
          filter: 'none',
          label: 'Histórico',
          desc: 'Dente com registros anteriores',
        },
        {
          fill: 'var(--color-teal)',
          stroke: 'var(--color-teal)',
          strokeW: 2,
          filter: 'drop-shadow(0 0 3px color-mix(in srgb, var(--color-teal) 45%, transparent))',
          label: 'Selecionado',
          desc: 'Dente selecionado para esta consulta',
        },
      ].map(({ fill, stroke, strokeW: sw, filter, label, desc }) => (
        <div key={label} className="flex items-start gap-2.5">
          <svg width={12} height={12} viewBox="0 0 12 12" className="mt-0.5 shrink-0" style={{ overflow: 'visible' }}>
            <rect
              x={0.75} y={0.75} width={10.5} height={10.5} rx={2.5}
              style={{ fill, stroke, strokeWidth: sw, filter }}
            />
          </svg>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold leading-none" style={{ color: 'var(--color-text-primary)' }}>
              {label}
            </span>
            <span className="text-[9px] leading-none" style={{ color: 'var(--color-text-muted)' }}>
              {desc}
            </span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

4. Remove the old inline legend block from the **filter row** (around lines 529–562):

Find and remove this entire block:
```tsx
<div className="flex-1" />

{/* Legend — inline right */}
<div className="flex items-center gap-3">
  {[
    { ... },
    { ... },
    { ... },
  ].map(({ fill, stroke, label }) => (
    <div key={label} className="flex items-center gap-1">
      ...
    </div>
  ))}
</div>
```

5. Commit: `git commit -m "feat: replace inline legend with Legenda popover panel in tab bar"`

---

## Task 6: Upgrade filter buttons visual hierarchy

**File:** `src/components/odontograma/Odontograma.tsx`  
**Location:** Filter buttons `<div>` in the `Odontograma` return (was around lines 503–528, may have shifted after Task 5)

Changes:
- Padding: `px-2.5 py-1` → `px-3 py-1.5`
- Active background: use `color-mix` inline style (already pattern of this file)
- Remove the `flex-1` spacer that was between filters and the old legend (since legend is now in tab bar)

**Steps:**

1. Find the **filter row** `<div>` (`className="flex items-center gap-1.5 flex-wrap px-0.5"`).

2. Update the `<button>` inside the map — change padding from `px-2.5 py-1` to `px-3 py-1.5`:

```tsx
<button
  key={id}
  type="button"
  onClick={() => {
    setActiveFilterId(id);
    setViewFilter(filter);
  }}
  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all outline-none focus-visible:ring-1 focus-visible:ring-teal"
  style={{
    background: isActive
      ? 'color-mix(in srgb, var(--color-teal) 12%, var(--color-surface-alt))'
      : 'var(--color-surface-alt)',
    color: isActive ? 'var(--color-teal)' : 'var(--color-text-secondary)',
    border: `1px solid ${isActive ? 'color-mix(in srgb, var(--color-teal) 40%, var(--color-border))' : 'var(--color-border)'}`,
  }}
>
  {label}
</button>
```

3. After removing the legend block in Task 5, the `<div className="flex-1" />` is also removed. Verify the filter row ends cleanly after the last filter button — no trailing spacer or legend.

4. Commit: `git commit -m "feat: upgrade filter button padding and clean up filter row layout"`

---

## Verification Checklist

After all 6 tasks are complete, verify:

- [ ] Dentes visivelmente maiores em tela (viewport ≥ 900px, sem scroll horizontal)
- [ ] Números 10px — legíveis sem esforço
- [ ] Dente `selected`: fill teal + drop-shadow + coroa stroke 2px + root teal tint → inconfundível
- [ ] Dente `historical`: tint mais visível que antes
- [ ] Legenda inline removida do footer
- [ ] Botão "Legenda" aparece no canto direito da tab bar
- [ ] Clicando "Legenda" aparece painel com 3 itens (swatch + nome + descrição)
- [ ] Filtros com padding maior, hierarquia visual secundária mantida
- [ ] Separador de linha média mais espesso
- [ ] Labels de quadrante maiores e com mais tracking
- [ ] Dark mode: sem regressão visual
- [ ] TypeScript: zero erros

---

## Execution Options

1. **Subagent-Driven** (recommended) — invocar `superpowers:subagent-driven-development`
2. **Inline Execution** — invocar `superpowers:executing-plans`
