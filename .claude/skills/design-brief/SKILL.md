---
name: design-brief
description: Parse design briefs into concrete DESIGN.md specifications. Resolves 8 orthogonal dimensions — color palette, accent, body typography, display typography, layout model, mood, density, and constraints — using a closed vocabulary. Outputs DESIGN.md + visual preview.
cpe:
  source: open-design
  original_path: skills/design-brief/SKILL.md
  original_url: https://github.com/nexu-io/open-design/tree/main/skills/design-brief
  source_commit: 1cb7eae4
  license: Apache-2.0
  integrated_at: 2026-06-22
  adaptation: conteúdo normalizado pelo Atlas — dimensões e vocabulário preservados
---

# Design Brief

Parses a design brief (structured or natural language) into a concrete DESIGN.md specification.

## When to Activate

Use when: "create a design brief", "define the design system", "what should this look like?", "set the visual direction"

## Input Formats

**Structured (I-Lang):**
```
palette=ocean_dark accent=cyan-500 body=inter display=cal-sans
layout=sidebar mood=professional density=compact
```

**Natural language:**
```
A dark professional dashboard for a fintech product.
Clean, minimal, high information density. Blue accent.
```

## Eight Dimensions

| Dimension | Values (closed vocabulary) |
|-----------|---------------------------|
| palette | `light`, `dark`, `ocean-dark`, `warm-light`, `neutral`, `high-contrast` |
| accent | Tailwind color + shade: `blue-500`, `cyan-400`, `emerald-500`, `violet-500`, `rose-500`, `amber-400`, `slate-400` |
| body | `inter`, `system-ui`, `geist`, `dm-sans`, `lato`, `source-sans` |
| display | `cal-sans`, `plus-jakarta-sans`, `outfit`, `sora`, `space-grotesk`, `geist` |
| layout | `centered`, `sidebar`, `full-bleed`, `dashboard`, `editorial`, `card-grid` |
| mood | `professional`, `playful`, `minimal`, `bold`, `editorial`, `luxurious` |
| density | `spacious`, `balanced`, `compact` |
| constraints | `mobile-first`, `desktop-only`, `print-safe`, `dark-mode-only`, `reduced-motion` |

**Unrecognized values:** ask for clarification. Never invent values outside this vocabulary.

## Resolution Rules (defaults when unspecified)

```
palette     → neutral        (if no dark/light preference stated)
accent      → blue-500       (if no color stated)
body        → inter          (universal default)
display     → plus-jakarta-sans
layout      → centered       (safest starting point)
mood        → professional
density     → balanced
constraints → (none)
```

## Output: DESIGN.md

Generate a 9-section design system document:

```markdown
# DESIGN.md — <Project Name>

## 1. Visual Theme
<palette + mood combination rationale>

## 2. Color Palette
Primary: #<hex> (palette base)
Accent: #<hex> (<accent-name>)
Surface: #<hex>
Text: #<hex>
Muted: #<hex>
Error: #ef4444
Success: #22c55e

## 3. Typography
Body: <body-font>, 16px/1.6 base
Display: <display-font>, used for headings
Code: JetBrains Mono or system monospace
Scale: 12/14/16/18/20/24/30/36/48px

## 4. Spacing & Layout
Unit: 4px
Scale: 4/8/12/16/24/32/48/64/96px
Layout: <layout-mode>
Max content width: 1200px (centered) or N/A (full-bleed)
Breakpoints: 640/768/1024/1280/1536px

## 5. Components
<density-appropriate radius, shadow, border rules>

## 6. Motion
Preferred: CSS transitions 150-300ms ease
Complex: GSAP (if gsap-core skill active)
Reduced-motion: @media (prefers-reduced-motion: reduce) { transition: none }

## 7. Voice & Tone
<mood-derived writing guidance>

## 8. Do's and Don'ts
Do: <3 items from mood + palette combination>
Don't: <3 anti-AI-tells relevant to this palette>

## 9. Agent Prompt Guidelines
When generating UI for this brief:
- Always use tokens from Section 2 (no raw color values)
- Always respect <density> spacing scale
- Never add <anti-patterns for this mood>
```

## Output: brief-preview.html

Generate a visual preview rendering:
- Color swatches with hex values
- Typography specimens at each scale step
- Spacing ruler
- Sample button, card, and form in the resolved style

## Transparency

At the end of the document, list all dimensions resolved from defaults:
```
## Resolved from Defaults
- palette: neutral (no preference stated)
- body: inter (default)
```
