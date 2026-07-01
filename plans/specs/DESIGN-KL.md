# DESIGN-KL.md — Brief visual dos workstreams K + L

_Gerado em: 2026-06-30_
> Pai: `plans/specs/spec-KL-demo-apresentar.md` (APROVADA). Cobre o §6 da spec.
> **NÃO é greenfield.** O design system já existe (`src/app/globals.css`). Este brief
> documenta como os 4 itens novos **casam com o que já está no código** — paleta, fontes
> e radius estão travados, não se reabrem.

---

## 0. Sistema herdado (fonte da verdade: `globals.css`)

| Dimensão | Valor travado | Token/classe |
|---|---|---|
| Accent de marca | teal `#2f9c85` → `#1a7a65` (grad), `teal-lt #5dbeb0` | `bg-teal`, `text-teal`, `from-teal to-teal-lt` |
| Superfícies | card `--color-surface`, elevado/hover `--color-surface-alt` | `bg-surface`, `bg-surface-alt` |
| Texto | primário / secundário / muted | `text-text-primary/secondary/muted` |
| Borda | `#c2c2c6` light · `#27272a` dark | `border-border` |
| Perigo / atenção | coral `#e57373` · warning `#f59e0b` | `text-coral`, `text-warning` |
| Heading | DM Serif | `font-heading` |
| Sans | Outfit | `font-sans` (default) |
| Mono (datas, contadores, IDs) | DM Mono | `font-mono` |
| Radius | base 10px → produto usa 12–16px | `rounded-xl` / `rounded-2xl` |
| Motion | subtle | `hover:-translate-y-0.5`, `.btn-scale`, `.skeleton-teal` |

**Estilo visual:** Soft-premium SaaS — superfícies limpas, accent teal pontual, gradiente
teal reservado a CTAs e headers de modal. Sem glassmorphism nas telas de produto (glass
fica nas páginas públicas).

---

## 1. Item — Seletor de fichas (L · spec 2.2)

**Espelha 1:1 o seletor de ficha→orçamento já existente** (`novo-orcamento-modal.tsx`
etapa `'selecionar'`). Não inventar layout novo — reusar o padrão que o usuário já conhece.

- **Container:** `Dialog`, header gradiente `linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)`,
  ícone `Presentation` (não `CircleDollarSign`) em caixa `rgba(255,255,255,0.15)` `rounded-xl`.
  - Title (`font-heading`, `text-xl`, branco): **"Apresentar ficha"**
  - Description (`text-white/70 text-xs`): **"Escolha qual registro clínico apresentar ao paciente."**
- **Lista:** cards clicáveis, um por ficha, mesma anatomia do orçamento:
  ```
  border border-border bg-surface-alt rounded-xl p-4
  hover:border-teal/40 hover:bg-teal/5 transition-all group
  ```
  - Linha 1: `queixa_principal ?? 'Evolução clínica'` — `font-semibold text-sm`,
    `group-hover:text-teal`.
  - Linha 2: data `dd/MM/yyyy 'às' HH:mm` — `text-xs text-text-secondary`, **`font-mono`**.
  - Pill à direita (quando houver): `dentista` ou contador de dentes —
    `text-[10px] font-bold font-mono bg-teal/10 text-teal px-2 py-1 rounded-lg`.
- **Sem** o botão "criar em branco" do orçamento (não se apresenta ficha vazia — invariante 3).
- **Estado vazio:** não chega aqui — o botão do header (item 3) só aparece com ficha (cond. 2.1).
- **Selecionar** → fecha seletor, abre `ApresentarPanel` com aquele `fichaId`.

**Motion:** entrada do modal já é a do `Dialog` (shadcn). Cards: só o hover. Sem stagger.

---

## 2. Item — Apresentar no header do perfil + estado condicional (L · spec 2.1, 3.3)

- **Botão:** reusa o visual do `ApresentarPaciente` não-compacto:
  ```
  inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt
  text-white px-4 py-2.5 rounded-xl font-bold text-sm
  shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all
  ```
  Ícone `Presentation w-4 h-4`. Label **"Apresentar"** (header já dá o contexto do paciente).
- **Peso visual:** é o **CTA secundário** do header — o teal cheio dá destaque sem competir
  com a ação primária da página. **Um** botão gradiente teal por header (não empilhar dois
  cheios lado a lado; se houver outro CTA primário, este vira `variant` outline-teal).
- **Estado condicional (anti-AI-slop):** `temAlgoParaApresentar` falso → **não renderiza**.
  Nunca botão desabilitado/fantasma. Aparecer/sumir, não acender/apagar.
- **No perfil DEMO (3.3):** mesmo botão, em **destaque** — é o gatilho do aha 2. Pode ganhar
  o `.btn-glow` (pulse teal já existe) **só no contexto demo** pra puxar o olho. Em perfil
  real, sem glow (seria ruído).

---

## 3. Item — Transições da demo estendida `reveal → assinatura → perfil` (K · spec 3.1)

Tudo dentro do `consulta-client.tsx`, branch `saved && isDemo`. Respeitar `prefers-reduced-motion`
(invariante 5 da spec) — tudo abaixo colapsa pra aparição instantânea.

> **Frequency gate (governa este §3 e o §4):** a demo é vista **1x por usuário** → motion
> **expressivo é justificado e desejável** aqui (é o aha). A UI de uso diário (§1, §2)
> continua **subtle**. Expressivo onde paga, contido onde repete.
>
> ⏸️ **DIFERIDO (fase 2, 2026-06-30):** o stagger dos blocos e os estados animados do DEX
> (§3a) e o stagger do Apresentar mockado (§4) ficam pra depois. Build atual usa fade/crossfade
> simples; a estrutura/copy/encadeamento dos estados entra agora, o polish de motion vem depois.

### 3a. Estruturação da ficha — o moneyshot (reveal)
Visualização literal de "captura livre → estruturação IA → ficha" (CLAUDE.md pipeline).
- **Blocos um por um:** os campos estruturados (queixa, dentes, procedimentos, observações)
  entram em **stagger** ~60–80ms cada, fade + `translateY` 8px→0, easing
  `cubic-bezier(0.4,0,0.2,1)`. Sensação de "o DEX encaixou cada peça".
- **DEX processando:** durante o stagger, o `DexAvatar` em estado **"pensando"** (pulse/scan
  sutil — reusar `.skeleton-teal`/glow teal já existentes); ao assentar o último bloco, beat
  de **"pronto"** (settle/scale 1.05→1). Reforça o DEX como a inteligência (CLAUDE.md: DEX em
  loaders/processamento/feedback de IA). Implementar com `motion-react` (variants + stagger).
- **Bifurcação** ("A ficha foi estruturada." → **[Ver o que acontece] / [Pular]**): aparece
  só **depois** do stagger terminar. Primário gradiente teal, secundário `text-text-secondary`.

### 3b. Encadeamento
- **`reveal → assinatura`:** crossfade ~200ms. Assinatura mock entra; copy de
  "falta verificação"/pendente **removida** (spec 3.2).
- **assinatura/pular → `/dashboard/pacientes/demo?from=demo`:** transição de **rota**. O
  `?from=demo` dispara um realce de entrada no perfil (highlight no card da ficha + no botão
  Apresentar) — fade/scale ~300ms, **uma vez**, sem loop.

**Princípio:** "animações sentidas, não percebidas" (CLAUDE.md) — mas no aha (1x) elas
**podem** ser percebidas, é o ponto. Cada transição ainda marca uma mudança de estado real.

---

## 4. Item — Conteúdo enlatado do Apresentar na demo (K · spec 3.4)

Mockado, dentista conduzindo, sem IA ao vivo. **Visualmente idêntico ao Apresentar real** —
o usuário tem que acreditar que é o produto, não uma maquete.

- **Fonte:** `mockSections` quando `patientId === 'demo'` (mesma forma de `plan.sections`).
- **CTA que abre:** **"Gerar plano de tratamento"** (spec 2.3/3.4) → as seções entram em
  **stagger** (mesmo padrão do §3a) — o plano "aparece sozinho", reforça "um clique e tá pronto".
  Demo = 1x → expressivo ok. **No Apresentar REAL (uso repetido): single fade, sem stagger.**
- **Caso clínico:** coerente com o relato da Maria da Silva (demo) — 2 a 4 seções no máximo
  (queixa/diagnóstico, plano, antes-depois, investimento). **Não** encher de seção; a demo
  vende clareza, não volume (CLAUDE.md: evitar excesso de cards/informação simultânea).
- **Números/valores:** `font-mono`, `tabular-nums`. Valor de investimento em teal (positivo),
  nunca coral.

---

## 5. Do's & Don'ts (específicos K+L)

**Do**
- Reusar o card-picker e o header-gradiente que já existem — consistência > novidade.
- `font-mono` em toda data, contador e valor (já é o padrão do produto).
- Aparecer/sumir o Apresentar por condição, nunca desabilitar.
- Glow teal **só** no Apresentar do contexto demo.

**Don't**
- ❌ Gradiente roxo/azul→roxo (proibido pelo CLAUDE.md) — accent é **teal** e só.
- ❌ Inventar um seletor diferente do de orçamentos — quebra o aprendizado do usuário.
- ❌ Modal de apresentação abrindo direto em full-screen na demo/real sem o beat de revisão
  (invariante 4 da spec).
- ❌ Stagger/DEX animado na UI de **uso diário** (seletor real, header, Apresentar real) —
  cansa na repetição. Expressivo só na **demo/aha** (1x); ver frequency gate no §3.
- ❌ Hex hardcoded em `className` fora dos gradientes-assinatura já aprovados (`#2f9c85`/`#1a7a65`).

---

## 6. Dimensões resolvidas

| Dimensão | Valor | Fonte |
|---|---|---|
| palette | teal brand (herdada) | `globals.css` — travada |
| estilo | Soft-premium SaaS (herdado) | sistema existente |
| tipografia | DM Serif / Outfit / DM Mono (herdada) | `@theme` em `globals.css` |
| layout | dialog + header de perfil (existentes) | reuso de padrão |
| density | balanced | default do produto |
| radius | rounded-xl / 2xl (12–16px) | padrão do produto |
| motion | subtle | spec (invariante 5) + CLAUDE.md |
| constraints | dark/light + reduced-motion | spec invariantes 4–5 |
