# Spec #9 — Performance do app (carregamento + runtime)

> Criado 2026-07-03 (planejamento). Escopo **fechado e aprovado**.
> Roadmap: item **#9**. **Foco: o APP** (dashboard, perfil, consulta, listas) — a perf da **landing** vive no stream Landing (**#17**).
> Diagnóstico estático; números finos (build/Lighthouse) confirmam na execução, mas não bloqueiam.

## 1. Objetivo
Deixar o app leve no **PC modesto da clínica** (o cenário do teste): matar o custo de runtime
contínuo e enxugar o bundle — sem perder o aspecto premium.

## 2. Diagnóstico (o que pesa)
| Alvo | Problema | Custo |
|---|---|---|
| `ParticleNetwork` no [`dashboard-shell:75`](src/components/layout/dashboard-shell.tsx:75) | `requestAnimationFrame` **eterno** + conexão de partículas **O(n²)** ([ParticleNetwork:79](src/components/ParticleNetwork.tsx:79)) | runtime contínuo em **toda tela** |
| 2 blobs no [`dashboard-shell:84`](src/components/layout/dashboard-shell.tsx:84) | `filter: blur(120px)` **animado** em loop infinito | compositing/GPU contínuo |
| `next.config.ts` | sem `optimizePackageImports` | bundle: lucide/motion/date-fns/recharts não tree-shaken agressivo |
| `framer-motion` | dependência **morta** (ninguém importa; todos usam `motion/react`) | peso morto |
| `recharts` / `@react-pdf/renderer` | confirmar se são lazy | possível bundle à toa |

## 3. Decisões travadas
- **Fundo do app — Opção A (aprovada):**
  - **Partículas:** animam **2–3s na entrada** (a tela "ganha vida"), depois **congelam** — `cancelAnimationFrame`, o snapshot fica no canvas. Sem rAF contínuo.
  - **Blobs:** **estáticos** — remover a `animation` (o blur é rasterizado uma vez).
  - **`prefers-reduced-motion`:** desenha estático direto, sem a animação de entrada.
  - Pausar a animação de entrada se `document.hidden`.
- **`optimizePackageImports`** no `next.config`: `lucide-react`, `motion`, `date-fns`, `recharts`.
- **Lazy-load** de `recharts` (gráficos do dashboard) e `@react-pdf/renderer` (confirmar estado atual; aplicar `next/dynamic` onde faltar).
- **Remover `framer-motion`** do `package.json`.

## 4. Ações por arquivo
| Arquivo | Mudança |
|---|---|
| `src/components/ParticleNetwork.tsx` | rAF para após settle (~2–3s); guard `prefers-reduced-motion` (estático) e `document.hidden` |
| `src/components/layout/dashboard-shell.tsx` | blobs sem `animation` (estáticos) |
| `next.config.ts` | `experimental.optimizePackageImports: ['lucide-react','motion','date-fns','recharts']` |
| `src/app/dashboard/_components/ganhos-*-chart.tsx` (recharts) | `next/dynamic` se ainda estático |
| download de PDF (`@react-pdf`) | confirmar server-only / lazy |
| `package.json` | remover `framer-motion` |

## 5. Verificação (execução)
- **Antes de commitar:** prototipar no navegador e comparar **lado a lado** — o premium tem que continuar (validação visual com o fundador).
- **Métricas antes/depois:** DevTools Performance (main-thread ociosa em idle), `next build` (first-load JS por rota), Lighthouse.

## 6. Gates de aceite
- [ ] Em idle (dentista parado), **sem rAF rodando** — main thread ociosa.
- [ ] Visual premium mantido (eyeball do fundador aprova).
- [ ] `prefers-reduced-motion` → fundo estático, sem animação.
- [ ] `next build` sem regressão de tamanho; `tsc` + `eslint` limpos.

## 7. Fora de escopo
Perf da **landing** (→ #17). Largura global (→ #18). Não mexe em lógica de dados.
