# Design Spec: Secretary Budgets Split View with Tabs by Dentist

**Date:** 2026-04-13  
**Status:** Approved  
**Feature:** Orçamentos — visão da secretária com tabs por dentista e split view Pendentes / Aprovados

---

## Context

A secretária precisa gerenciar orçamentos de múltiplos dentistas numa única tela. A view atual usa um `<select>` de filtro genérico que não diferencia status por dentista nem dá visibilidade rápida de orçamentos pendentes de ação.

O estado `activeTabId` já existe em `OrcamentosClient` mas está morto (nunca conectado ao JSX). Essa spec formaliza a implementação completa.

---

## Status Mapping

| Label na UI | Status no banco |
|---|---|
| Pendentes | `enviado` |
| Aprovados / Pagos | `aprovado` |

`rascunho` e `recusado` não aparecem nessa view — a secretária não precisa de visibilidade sobre eles.

---

## Architecture

```
OrcamentosPage (server component)
  └─ OrcamentosClient (client — lógica compartilhada + todos os modais existentes)
       ├─ isSecretaria = true  → <SecretariaOrcamentosView />
       └─ isSecretaria = false → tabela existente (zero alteração)
```

Nenhuma nova query de banco. Os dados (`orcamentos` + `dentistas`) já são carregados por `OrcamentosPage` e passados via props.

---

## New Component: `SecretariaOrcamentosView`

**File:** `src/app/dashboard/orcamentos/_components/secretaria-orcamentos-view.tsx`

### Props

```ts
interface SecretariaOrcamentosViewProps {
  orcamentos: OrcamentoRow[];
  dentistas: { id: string; nome: string }[];
  onSelect: (orc: OrcamentoRow) => void;
}
```

- `orcamentos` — todos os orçamentos da clínica (filtrados no servidor por `clinica_id`)
- `dentistas` — lista de dentistas ativos da clínica excluindo secretárias (já buscada pelo servidor)
- `onSelect` — callback que abre o detail panel existente em `OrcamentosClient`

### Internal State

```ts
const [activeTabId, setActiveTabId] = useState(dentistas[0]?.id ?? '');
```

### Data Derivation (useMemo)

```ts
const orcamentosDoDentista = orcamentos.filter(o => o.dentista?.id === activeTabId);
const pendentes  = orcamentosDoDentista.filter(o => o.status === 'enviado');
const aprovados  = orcamentosDoDentista.filter(o => o.status === 'aprovado');
```

---

## Layout

### Tabs (Shadcn `<Tabs>`)

- Um `<TabsTrigger>` por dentista
- Badge de contagem de pendentes ao lado do nome:
  - Visível apenas quando `pendentes.length > 0`
  - Estilo: `bg-amber-400 text-black text-[10px] font-bold rounded-full px-1.5` (Tailwind padrão, sem variável nova)

### Content (`<TabsContent>`)

Grid de duas colunas com divisor vertical:

```
┌─────────────────────────┬──────────────────────────┐
│  PENDENTES (N)          │  APROVADOS (N)            │
│  ─────────────────────  │  ──────────────────────   │
│  [OrcamentoCard]        │  [OrcamentoCard]           │
│  [OrcamentoCard]        │  [OrcamentoCard]           │
│                         │                            │
│  [empty state]          │  [empty state]             │
└─────────────────────────┴──────────────────────────┘
```

Tailwind: `grid grid-cols-2 divide-x divide-border`

### OrcamentoCard

Reutiliza classes do design system existente. Não cria componente separado (uma função local é suficiente).

Exibe:
- Nome do paciente (`font-sans font-semibold text-foreground`)
- Valor total (`font-mono text-lg text-foreground`)
- Data de criação (`text-xs text-muted-foreground`)
- Status badge (reutiliza `STATUS_MAP` existente em `OrcamentosClient`)
- Botão "Ver & Follow-up" → chama `onSelect(orc)`

Estilo do card: `bg-card border border-border rounded-2xl p-4 flex flex-col gap-2`

Hover: `hover:border-teal/40 transition-colors cursor-pointer`

### Empty State

Cada coluna exibe quando não há orçamentos:

```tsx
<p className="text-sm text-muted-foreground text-center py-8">
  Nenhum orçamento {label}.
</p>
```

---

## Changes to `OrcamentosClient`

1. **Remover** o estado morto: `activeTabId`, `setActiveTabId` e o `useEffect` associado
2. **Remover** o estado `filterDentista` e o `<select>` de filtro por dentista (substituído pelas tabs)
3. **Renderização condicional inline** — **não** usar early return, pois o detail panel (Dialog) precisa estar presente no DOM para ambos os roles:

```tsx
return (
  <div className="p-8 max-w-6xl mx-auto w-full">
    {isSecretaria ? (
      <SecretariaOrcamentosView
        orcamentos={orcamentos}
        dentistas={dentistas ?? []}
        onSelect={setSelected}
      />
    ) : (
      {/* ... tabela existente, header, métricas — inalterados */}
    )}

    {/* Detail panel e todos os modais existentes ficam FORA do condicional */}
    {/* Renderizados para ambos os roles via estado `selected` */}
    {selected && <DetailPanel ... />}
    {/* ... outros dialogs existentes ... */}
  </div>
);
```

4. O detail panel abre normalmente para a secretária: `onSelect(orc)` → `setSelected(orc)` → Dialog renderiza com o `BotaoEnviarWhatsApp` e botões de pagamento existentes.

---

## Invariants & Constraints

- Nenhuma query nova ao banco
- Nenhum estilo inventado — apenas Tailwind existente + variáveis CSS do design system + Shadcn components já importados
- Componentes Shadcn necessários: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Badge` — todos já estão no projeto
- A view do dentista/admin (`isSecretaria = false`) não é alterada
- `dentistasUnicos` computado em `OrcamentosClient` também pode ser removido se não for mais usado pelo fluxo do dentista (verificar antes de remover)
- `rascunho` e `recusado` ficam ocultos na view da secretária — decisão de produto deliberada

---

## Files Changed

| File | Action |
|---|---|
| `src/app/dashboard/orcamentos/_components/secretaria-orcamentos-view.tsx` | **Create** |
| `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` | **Modify** (remover dead state, adicionar branch condicional) |

`src/app/dashboard/orcamentos/page.tsx` — **sem alteração** (já busca `dentistasClinica` e passa como prop).

---

## Out of Scope

- Ação real de "Enviar Follow-up" via WhatsApp (já existe `BotaoEnviarWhatsApp` no detail panel)
- Filtro de data ou busca dentro das colunas
- Paginação
- Animação de transição entre tabs (Framer Motion) — não necessário para MVP
