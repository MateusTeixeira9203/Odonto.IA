---
name: design-system-tokens
description: Design token system for UI generation. Defines the canonical token vocabulary (color, typography, spacing, radius, shadow, motion) that all Atlas design skills use. Synthesized from Anthropic frontend-design principles and open-design patterns.
cpe:
  source: cpe
  synthesis_sources:
    - anthropic-frontend (Apache-2.0, commit 545162ba)
    - open-design (Apache-2.0, commit 1cb7eae4)
  integrated_at: 2026-06-22
  adaptation: Atlas-authored synthesis — not a copy of any upstream
---

# Design System Tokens

Canonical token vocabulary for UI generation within the Atlas ecosystem. All Atlas design skills reference these tokens — never raw CSS values.

## When to Activate

Use when: "create UI", "generate component", "design tokens", "set up tokens", "color palette", "typography scale"

## Color Tokens

### Semantic Colors (use these, not raw hex)

```css
/* Light mode */
--color-bg:          #ffffff;
--color-bg-subtle:   #f8fafc;
--color-bg-muted:    #f1f5f9;
--color-border:      #e2e8f0;
--color-border-muted:#f1f5f9;
--color-text:        #0f172a;
--color-text-muted:  #64748b;
--color-text-subtle: #94a3b8;

/* Accent (project-specific, set from DESIGN.md) */
--color-accent:      var(--project-accent, #6366f1);
--color-accent-hover:var(--project-accent-hover, #4f46e5);
--color-accent-muted:var(--project-accent-muted, #eef2ff);

/* Status */
--color-success:     #22c55e;
--color-warning:     #f59e0b;
--color-error:       #ef4444;
--color-info:        #3b82f6;
```

```css
/* Dark mode — applied via .dark class or @media (prefers-color-scheme: dark) */
--color-bg:          #0f172a;
--color-bg-subtle:   #1e293b;
--color-bg-muted:    #334155;
--color-border:      #334155;
--color-text:        #f8fafc;
--color-text-muted:  #94a3b8;
```

## Typography Tokens

```css
--font-body:        'Inter', system-ui, -apple-system, sans-serif;
--font-display:     'Plus Jakarta Sans', 'Inter', sans-serif;
--font-mono:        'JetBrains Mono', 'Fira Code', monospace;

/* Scale (Major Third — 1.25) */
--text-xs:   0.75rem;   /* 12px */
--text-sm:   0.875rem;  /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.5rem;    /* 24px */
--text-3xl:  1.875rem;  /* 30px */
--text-4xl:  2.25rem;   /* 36px */
--text-5xl:  3rem;      /* 48px */

/* Weight */
--font-normal:  400;
--font-medium:  500;
--font-semibold:600;
--font-bold:    700;

/* Line height */
--leading-tight:  1.25;
--leading-snug:   1.375;
--leading-normal: 1.5;
--leading-relaxed:1.625;
--leading-loose:  2;
```

## Spacing Tokens

```css
/* 4px base unit */
--space-1:  0.25rem;  /* 4px */
--space-2:  0.5rem;   /* 8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-5:  1.25rem;  /* 20px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Border Radius Tokens

```css
--radius-sm:   4px;   /* subtle */
--radius-md:   8px;   /* default for cards, inputs */
--radius-lg:   12px;  /* large surfaces */
--radius-xl:   16px;  /* modals, drawers */
--radius-full: 9999px;/* pills, badges */
```

Anti-pattern: `border-radius: 24px` on most elements — see `impeccable-design-polish`.

## Shadow Tokens

```css
--shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
--shadow-sm:  0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.04);
```

Anti-pattern: `box-shadow: 0 20px 60px rgba(0,0,0,0.3)` — heavy shadows signal AI-generated UI.

## Motion Tokens

```css
--duration-instant: 50ms;
--duration-fast:   150ms;
--duration-normal: 250ms;
--duration-slow:   400ms;

--ease-default:    cubic-bezier(0.4, 0, 0.2, 1);
--ease-in:         cubic-bezier(0.4, 0, 1, 1);
--ease-out:        cubic-bezier(0, 0, 0.2, 1);
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* slight overshoot */
```

```css
/* Always provide reduced-motion fallback */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Layout Tokens

```css
--max-content:  1200px;  /* centered layout */
--max-prose:    65ch;    /* readable text */
--sidebar-width:280px;

--breakpoint-sm:  640px;
--breakpoint-md:  768px;
--breakpoint-lg:  1024px;
--breakpoint-xl:  1280px;
--breakpoint-2xl: 1536px;
```

## Usage in Components

```css
/* Example: card using tokens */
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
.card:hover {
  box-shadow: var(--shadow-md);
}
```
