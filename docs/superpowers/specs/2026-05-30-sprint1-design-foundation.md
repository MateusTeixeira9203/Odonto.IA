# Sprint 1 — Design Foundation e Consistência Visual

**Data:** 2026-05-30
**Status:** Aprovado
**Escopo:** UX/UI e Design System exclusivamente. Sem alterações de funcionalidade, regras de negócio ou fluxos.

---

## Contexto

O sistema possui um design token system canônico bem definido em `globals.css`, mas a execução histórica acumulou 143 instâncias de cores hardcoded, 76 prefixos `dark:*` redundantes, e inconsistências na sidebar, botões e estados semânticos. Este sprint padroniza tudo antes das próximas refatorações de produto.

---

## Auditoria — Achados

### Cores hardcoded (143 instâncias)
- **Amber/warning:** `bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400` — padrão repetido em status badges de agendamentos, alertas de conflito, avisos financeiros
- **Green/success:** `bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20` — status "conectado", "ativo"
- **Blue/info:** `bg-blue-50 text-blue-700 dark:bg-blue-900/20` — status "na recepção", informativo
- **Zinc:** `bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60` — status neutro/desconectado
- **Bg-white (sólido):** QR code container, card de assinatura — deveriam ser `bg-surface`
- **`dark:*` prefixes:** 76 instâncias — todo prefixo `dark:` em código de produto viola a regra de tokens semânticos

### Button — análise de uso real
- **63 uses** sem `variant` explícito (default)
- **2 uses** com `variant="outline"`  
- **Padrão real de CTA primário:** sempre bypassa o componente com `className="bg-gradient-to-r from-teal to-teal-lt text-white rounded-xl shadow-[0_4px_16px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"` — repetido em 8+ locais
- **Conclusão:** `default` variant (shadcn `bg-primary`) não é usado como CTA primário. O padrão teal-gradient é o CTA real do produto e precisa virar a variante `brand`.

### Sidebar — duplicação
- `ClinicSwitcher` no topo já exibe o nome da clínica ativa
- Footer do usuário mostra `nome` + `clinicaNome` → repetição desnecessária
- Fix: substituir `clinicaNome` por label do `role` em português

---

## Seção 1 — Novos Tokens Semânticos

### 1.1 Success = Teal

`success` mapeia para teal (identidade da marca), não para verde. Teal já é a cor positiva do sistema.

```css
/* Não adicionar tokens de success — teal JÁ É o success */
/* Usar: text-teal, bg-teal-pale, border-teal/20 */
```

### 1.2 Tokens novos: Warning e Info

Adicionar ao `globals.css` em `:root` e `.dark`:

```css
/* :root (light) */
--color-warning:        #d97706;   /* amber-600 — legível em bg claro */
--color-warning-pale:   #fef9ec;   /* amber suave */
--color-info:           #2563eb;   /* blue-600 */
--color-info-pale:      #eff6ff;   /* blue-50 */

/* .dark */
--color-warning:        #fbbf24;   /* amber-400 — contraste em dark */
--color-warning-pale:   #1c1508;   /* dark amber */
--color-info:           #60a5fa;   /* blue-400 */
--color-info-pale:      #0d1526;   /* dark blue */
```

Adicionar ao `@theme {}`:

```css
--color-warning:      var(--color-warning);
--color-warning-pale: var(--color-warning-pale);
--color-info:         var(--color-info);
--color-info-pale:    var(--color-info-pale);
```

Classes disponíveis após isso: `text-warning`, `bg-warning`, `bg-warning-pale`, `border-warning/20`, `text-info`, `bg-info`, `bg-info-pale`, `border-info/20`.

### 1.3 Mapeamento de migração

| De (hardcoded) | Para (token) |
|---|---|
| `text-amber-600` / `dark:text-amber-400` | `text-warning` |
| `bg-amber-50` / `dark:bg-amber-900/20` | `bg-warning-pale` |
| `border-amber-200` / `dark:border-amber-800/40` | `border-warning/20` |
| `text-emerald-600` / `dark:text-emerald-400` | `text-teal` (success = teal) |
| `bg-emerald-50` / `dark:bg-emerald-900/20` | `bg-teal-pale` |
| `border-emerald-200` / `dark:border-emerald-800` | `border-teal/20` |
| `text-blue-700` / `dark:text-blue-400` | `text-info` |
| `bg-blue-50` / `dark:bg-blue-900/20` | `bg-info-pale` |
| `border-blue-200` / `dark:border-blue-800` | `border-info/20` |
| `bg-zinc-100` / `text-zinc-500` / `dark:bg-zinc-800` | `bg-surface-alt` / `text-text-secondary` |
| `bg-white` (sólido, não-sidebar) | `bg-surface` |
| `text-red-500` / `text-red-600` / `dark:text-red-400` | `text-coral` |
| `bg-red-50` / `dark:bg-red-900/10` | `bg-coral-pale` |
| `border-red-200` / `dark:border-red-800` | `border-coral/20` |

---

## Seção 2 — Button: Variante `brand`

### Análise de uso
O CTA primário do produto usa sempre o padrão:
```
bg-gradient-to-r from-teal to-teal-lt text-white rounded-xl
shadow-[0_4px_16px_rgba(47,156,133,0.3)]
hover:-translate-y-0.5 disabled:opacity-50 transition-all
```

Este padrão está duplicado em 8+ locais. Deve virar a variante canônica.

### Nova variante `brand`

```ts
brand: [
  "bg-gradient-to-r from-teal to-teal-lt",
  "text-white font-semibold",
  "shadow-[0_4px_16px_rgba(47,156,133,0.25)]",
  "hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(47,156,133,0.35)]",
  "active:translate-y-0 active:shadow-[0_2px_8px_rgba(47,156,133,0.2)]",
  "disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_16px_rgba(47,156,133,0.25)]",
  "transition-all duration-200",
].join(" ")
```

### Regra de uso

| Contexto | Variante |
|---|---|
| CTA primário (salvar, confirmar, avançar) | `brand` |
| Ação secundária / cancelar | `outline` |
| Ação sutil em superfície | `ghost` |
| Ação destrutiva | `destructive` |
| Botão neutro shadcn interno | `default` (não usar em produto) |

### Nota sobre tamanhos
Manter os sizes existentes (`xs`, `sm`, `default`, `lg`, `icon`, etc.). A variante `brand` é compatível com todos os sizes.

---

## Seção 3 — Sidebar: Eliminar Repetição

### Problema
```
[topo]  ClinicSwitcher: "Clínica Central"  ← fonte de verdade
[rodapé] "Dr. João Silva"
          "Clínica Central"                ← redundante
```

### Solução
Substituir `clinicaNome` no rodapé por label do role em português:

```ts
const ROLE_LABEL: Record<DentistaRole, string> = {
  admin:      'Administrador',
  dentista:   'Dentista',
  secretaria: 'Secretaria',
};
```

```
[rodapé] "Dr. João Silva"
          "Dentista"      ← role, não clínica
```

**Arquivo:** `src/components/layout/sidebar-content.tsx` — apenas a linha de `clinicaNome` no footer do usuário.

---

## Seção 4 — Arquivos a Corrigir

### Prioridade 1 — Design tokens + prefixos dark (impacto em light mode)
1. `src/app/globals.css` — adicionar tokens warning/info
2. `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx` — amber warnings, conflict alerts
3. `src/app/dashboard/agendamentos/_components/day-view.tsx` — red delete button, status colors
4. `src/app/dashboard/agendamentos/_components/month-view.tsx` — violet badge, red button, dot
5. `src/app/dashboard/_components/secretaria-dashboard.tsx` — status badge map (amber/blue/red/purple)
6. `src/app/dashboard/configuracoes/_components/configuracoes-client.tsx` — amber warning, red error
7. `src/components/dashboard/attention-panel.tsx` — amber alert

### Prioridade 2 — bg-white / zinc / dark: prefixes
8. `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx` — redundant `dark:` prefixes
9. `src/app/dashboard/configuracoes/whatsapp/_components/aba-conexao.tsx` — `bg-white` QR container
10. `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` — amber warning, `bg-white` card
11. `src/app/dashboard/whatsapp/_components/whatsapp-client.tsx` — `dark:*` prefixes
12. `src/app/dashboard/bot/_components/bot-page-client.tsx` — zinc, emerald, red status colors (**exceto** os elementos de simulação WhatsApp: `#dcf8c6`, `#128c7e`, `#25d366` — são decorativos)
13. `src/app/dashboard/_components/ganhos-7dias-chart.tsx` — zinc text

### Prioridade 3 — Button + Sidebar
14. `src/components/ui/button.tsx` — adicionar variante `brand`
15. `src/components/layout/sidebar-content.tsx` — substituir `clinicaNome` por role label no footer

---

## Seção 5 — Light Mode: Focos Críticos

Além das substituições de tokens, garantir contraste adequado no light mode:

- **`text-text-muted: #d9d9d9`** — usado APENAS para placeholders. Nunca usar para texto visível. Verificar usos incorretos.
- **Toggles/switches** em `configuracoes-client.tsx`: o `after:bg-white` no thumb do toggle é aceitável (thumb branco em trilho colorido = pattern universal).
- **Alert error em auth** (`bg-red-50 border-red-200 text-red-700`) — migrar para `bg-coral-pale border-coral/20 text-coral` no arquivo de login para consistência com o design system.

---

## Seção 6 — Componentes Globais (revisão sem refatoração)

**Dialog/Sheet/Select:** Apenas verificação — shadcn já usa `bg-popover`/`bg-card`. Corrigir apenas se encontrar `bg-white` ou `dark:*` hardcoded.

**Loading states:** `DexLoader` é o padrão para estados full-area. `Loader2 animate-spin` permitido apenas inline (dentro de botão). Não refatorar todos os Loader2 neste sprint — documentar para sprint futuro.

**Skeleton:** `animate-pulse bg-surface-alt` como padrão canônico. Sem mudanças estruturais.

---

## Fora de Escopo (Sprint 1)

- EmptyState component (removido do escopo)
- Migração de `<button>` raw nas auth pages para `<Button>` component
- Substituição de Loader2 por DexLoader (documentar para sprint futuro)
- Bot page: elementos de simulação WhatsApp com cores proprietárias
- Sidebar: elementos com `white/*` (superfície sempre-dark — exceção aceita documentada)
- Orçamentos: `bg-white/20 text-white` em overlay sobre gradiente teal (aceitável)

---

## Critério de Conclusão

- [ ] Tokens warning/info adicionados ao globals.css e @theme
- [ ] Nenhum `dark:text-*` / `dark:bg-*` / `dark:border-*` nos arquivos listados
- [ ] Nenhum `bg-amber-*` / `text-amber-*` / `bg-zinc-*` / `text-zinc-*` nos arquivos listados (exceto exceções)
- [ ] `bg-white` sólido removido de componentes não-sidebar
- [ ] Variante `brand` adicionada ao Button
- [ ] Sidebar footer mostra role em vez de clinicaNome
- [ ] Light mode visualmente consistente com dark mode nos componentes afetados
