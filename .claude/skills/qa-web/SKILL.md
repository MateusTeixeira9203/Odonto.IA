---
name: qa-web
description: >
  Systematically QA-test a running web application like a real user, then fix the
  bugs found. Drives the browser, walks key flows, checks console/network errors,
  scores health, and runs a triage → fix → re-verify loop. Use when the user says
  "QA this", "test the site", "find bugs", "smoke test the app", or before shipping
  a feature that has UI. For pure visual/design issues, use design-review instead.
license: MIT
source: "Metodologia adaptada de garrytan/gstack (MIT) — telemetria/GBrain/CLI removidos; browser via Playwright MCP."
---

# QA Web

Test a running app the way a user would, find what's broken, fix it, prove it's
fixed. **Browser:** Playwright MCP (`mcp__playwright__*`).

## Step 0 — Setup

1. Find the running app (ask for the URL, or detect common local ports 3000/4000/8080).
2. If the URL redirects to `/login`/`/signin`/`/auth`, the app needs auth — ask the
   user how to authenticate (test creds, or import a session) before continuing.
3. Read `CLAUDE.md` for the project's test/build commands. If missing, ask once and
   persist the answer to `CLAUDE.md` so you never ask again.

## Modes

- **Smoke (default):** home + the 3–5 highest-value flows. Fast confidence check.
- **Deep (`--deep`):** every reachable page + every key flow + edge/error cases.
- **Diff-aware:** on a feature branch, scope to flows touched by
  `git diff main...HEAD --name-only`.

## Workflow (per flow)

For each user flow (e.g. signup → onboarding → dashboard; create patient → ficha → orçamento):

1. **Navigate & act** — drive the real flow with the browser. Fill forms with
   realistic data, click through, submit.
2. **Watch for failure on every step:**
   - Console errors / warnings (`mcp__playwright__*` console).
   - Failed network requests (4xx/5xx, CORS, timeouts).
   - UI that lies: spinner that never resolves, success toast on a failed request,
     blank state where data should be.
   - Broken nav: dead links, wrong active state, 404s.
3. **Edge cases** — empty input, invalid input, very long input, double-submit,
   back-button mid-flow, refresh mid-flow, slow network. These find the real bugs.
4. **Record each bug** with: what you did, what you expected, what happened, a
   screenshot, and the console/network evidence.

## Health score

Report a 0–100 health score and a letter grade. Start at 100, subtract:
- **Blocker** (flow can't be completed): −25 each
- **High** (data loss risk, security, wrong result): −15 each
- **Medium** (degraded UX, recoverable error): −7 each
- **Low** (cosmetic, console warning): −2 each

Grade: 90+ A · 80–89 B · 70–79 C · 60–69 D · <60 F. A single blocker caps the grade at C.

## Triage → Fix → Re-verify

1. **Triage:** sort findings by severity. Confirm scope with the user if there are
   blockers or anything ambiguous (AskUserQuestion).
2. **Fix loop:** for each bug, fix the **root cause** (grep every caller of the
   function you touch — one guard in the shared path beats N guards in callers).
   Keep diffs minimal (pair with `ponytail`). Add one runnable check per non-trivial fix.
3. **Re-verify:** re-run the exact flow in the browser and confirm the bug is gone
   and nothing nearby regressed. A fix isn't done until you've watched it pass.

## Report

- Health score + grade, before/after if you fixed things.
- Findings table: severity · flow · what broke · evidence · status (fixed/open).
- Top 3 risks still open, with a one-line recommendation each.

## Rules

1. Test the **running app**, not the source. Reproduce before you fix.
2. Never claim a fix works without re-running the flow and watching it pass.
3. Realistic data only — "asdf" in every field hides real validation bugs.
4. Don't widen scope silently. New bug outside the flow? Log it, ask before chasing it.
