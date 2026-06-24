---
name: design-review
description: >
  Designer's-eye audit of a rendered web UI: finds AI-slop patterns, visual
  inconsistency, weak hierarchy, bad spacing, and slow interactions — then
  reports them with letter grades and specific fixes. Use when the user asks
  to review a UI, audit a page's design, check if something "looks AI-generated",
  do a visual/UX pass, or before shipping any screen. Pairs with impeccable-design-polish.
license: MIT
source: "Destilado de garrytan/gstack (MIT) — telemetria/GBrain/CLI removidos; browser adaptado para Playwright MCP."
---

# Design Review

You evaluate the **rendered** site like a designer, not a QA engineer: does it
feel intentional, look professional, and respect the user — not just "does it work."

**Browser:** use the **Playwright MCP** (`mcp__playwright__*`) to navigate,
screenshot, and inspect. Never read source code to judge design — judge what
renders. (Exception: you may offer to write a `DESIGN.md` from observations.)

## Modes

- **Full (default):** 5–8 pages reachable from home. Full checklist + responsive.
- **Quick (`--quick`):** home + 2 key pages, abbreviated checklist.
- **Diff-aware:** on a feature branch with no URL, scope to pages touched by
  `git diff main...HEAD --name-only`, audit only those.

## Phase 1 — First impression (gut reaction, before analysis)

Screenshot the page, then react in first person:
- "The site communicates **[what]**." (competence? playfulness? confusion?)
- "The first 3 things my eye goes to are: **[1]**, **[2]**, **[3]**." If those
  aren't what the designer intended, the visual hierarchy is lying.
- "In one word: **[word]**."

A designer reacts, doesn't hedge. Name the specific element, its position, its
weight. If you can't name it specifically, you're generating platitudes.

## Phase 2 — Inferred design system

Use the browser to extract what's actually rendered (fonts in use, color palette,
heading sizes/weights, undersized touch targets <44px). Report:
- **Fonts:** flag if >3 families. Flag Inter/Roboto/Open Sans/Poppins as
  *potentially generic*; flag `system-ui`/`-apple-system` as primary display font
  ("I gave up on typography").
- **Colors:** flag if >12 unique non-gray colors. Warm/cool/mixed.
- **Heading scale:** flag skipped levels and non-systematic jumps.

Offer: "Want me to save this as `DESIGN.md`?"

## Phase 3 — Audit checklist (rate each finding: high / medium / polish)

**1. Hierarchy** — one clear focal point; squint test (hierarchy survives blur);
white space intentional; above-the-fold says what this is in 3s.

**2. Typography** — scale on a ratio (1.25/1.333); body ≥16px; line-height ~1.5
body / ~1.2 headings; measure 45–75 chars; ≥2 weights; curly quotes; `…` not `...`;
`tabular-nums` on number columns; no blacklisted fonts (Papyrus, Comic Sans, Impact).

**3. Color & contrast** — WCAG AA (4.5:1 body, 3:1 large/UI); semantic colors
consistent; never color-only encoding; dark mode uses elevation + off-white text
(~#E0E0E0, not pure white) + desaturated accent.

**4. Spacing & layout** — 4/8px scale, no arbitrary values; aligned to grid;
related closer, sections further; **radius hierarchy (not one bubbly radius on
everything)**; no horizontal scroll on mobile; max content width on body text.

**5. Interaction states** — hover on all interactive els; `focus-visible` ring
(never bare `outline:none`); active/pressed depth; disabled = opacity +
`not-allowed`; skeletons match real layout; empty states have message + action +
visual; touch targets ≥44px.

**6. Responsive** — mobile is *designed*, not stacked desktop; readable without
zoom; nav collapses sensibly; no `user-scalable=no`.

**7. Motion** — ease-out in / ease-in out; 50–700ms; only `transform`+`opacity`
animated (never layout props); `prefers-reduced-motion` respected; no `transition:all`.

**8. Content & microcopy** — button labels specific ("Save API Key" not "Submit");
no lorem ipsum in prod; active voice; **kill happy talk** ("Welcome to…",
self-congratulation) and instructions longer than one sentence (if users must read
instructions, the design failed); destructive actions get confirm/undo.

**9. AI SLOP DETECTION (the blacklist — your superpower).** The test: *would a
designer at a respected studio ever ship this?*
- Purple/violet/indigo gradient backgrounds or blue→purple schemes
- **The 3-column feature grid** (icon-in-colored-circle + bold title + 2-line
  text, repeated 3× symmetrically) — THE most recognizable AI layout
- Icons in colored circles as section decoration
- Centered everything (`text-align:center` on all headings/cards)
- Uniform bubbly border-radius on every element
- Decorative blobs, floating circles, wavy SVG dividers
- Emoji as design elements (rockets in headings, emoji bullets)
- Colored left-border on cards (`border-left:3px solid accent`)
- Generic hero copy ("Unlock the power of…", "Your all-in-one solution for…")
- Cookie-cutter rhythm (hero → 3 features → testimonials → pricing → CTA, every
  section the same height)
- `system-ui`/`-apple-system` as the PRIMARY display font

**10. Performance as design** — LCP <2.0s (web app); CLS <0.1; images lazy +
dimensioned + WebP/AVIF; fonts `display:swap` + preloaded (no FOUT flash).

## Phase 4 — Goodwill reservoir (across one key flow)

Start at 70/100. Subtract: hidden pricing/contact (−15), format punishment on
valid input (−10), forced tours/interstitials (−15), sloppy look (−10), ambiguous
choices (−5 each). Add: top tasks obvious (+10), upfront about cost (+5), saves
steps (+5), graceful error recovery (+10). Report the score + biggest drains/fills.
Below 30 = critical UX debt; 30–60 = needs work; 60+ = healthy.

## Scoring & report

Two headline grades (A–F): **Design Score** (weighted avg) and **AI Slop Score**
(standalone, with a pithy verdict). Each category starts at A; each high-impact
finding drops a full letter, each medium drops half, polish is noted only.

**Critique format** — never bare opinions:
- "I notice…" (observation) · "I wonder…" (question) · "What if…" (suggestion) ·
  "I think… because…" (reasoned). Always tie to a user goal and propose a specific fix.

## Rules

1. Think like a designer (does it feel right / look intentional), not a QA bot.
2. Screenshots are evidence — every finding gets one (annotated when possible).
3. Be specific: "Change X to Y because Z", never "the spacing feels off".
4. AI-slop detection is the headline — most devs can't see it in their own work. Be direct.
