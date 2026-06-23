# Plano de Execução — Frontend 100%
**Data:** 2026-06-01  
**Objetivo:** Consolidação visual completa do sistema — landing page → configurações  
**Referência de qualidade:** Dashboard e Tratamento (9/10)  
**Estimativa total:** ~5h 30min

---

## 🔴 Bloco 00 — Legibilidade Global (CRÍTICO — ACESSIBILIDADE)
**Contexto:** base de usuários vai de jovens a dentistas veteranos com dificuldade visual. Fonte pequena = abandono de produto.  
**Problema identificado:** uso excessivo de `text-[8.5px]`, `text-[9px]`, `text-[10px]` em labels, badges e metadados por todo o sistema.  

**Escala mínima obrigatória:**
| Uso | Mínimo atual (errado) | Mínimo correto |
|-----|----------------------|----------------|
| Labels de seção | `text-[10px]` | `text-xs` (12px) |
| Metadados / datas / subinfo | `text-[9px]` | `text-[11px]` |
| Badges / tags | `text-[9px]` | `text-[10px]` — apenas se bold |
| Texto de corpo / inputs | `text-sm` | `text-sm` (14px) ✓ |
| Títulos de card | `text-sm` | `text-sm` → `text-base` (16px) |

**Regra:** nada abaixo de `text-[10px]` — e mesmo esse valor só em badges bold com fundo colorido (alta legibilidade pelo contraste). Labels de seção no mínimo `text-xs` (12px).  

**Escopo:** varredura em todos os módulos durante a execução dos blocos — corrigir inline ao tocar cada arquivo.  

**Referência:** WCAG 2.1 AA recomenda 16px para corpo, mínimo 14px para qualquer texto funcional.

---

## ⚠️ Bloco 0 — Light Mode Global (CRÍTICO)
**Problema:** tokens de light mode têm contraste insuficiente vs dark mode.  
**Raiz:** `--color-surface-alt: #ebebed` e `--color-border: #e2e2e5` — diferença de apenas ~6% vs `--color-surface: #ffffff`. Em dark mode a diferença é ~40%.  
**Arquivo:** `src/app/globals.css` `:root { ... }`  
**Fixes:**
- `--color-surface-alt`: `#ebebed` → `#e4e4e8` (mais contraste vs surface branca)
- `--color-border`: `#e2e2e5` → `#d4d4d8` (bordas visíveis no claro)
- `--color-text-muted`: `#d9d9d9` → `#b4b4b8` (labels ultralight atualmente invisíveis)
- Verificar todos os módulos após aplicar

---

## Ordem de Execução

```
Hoje
  Bloco 1 — Sprint 2.1: Odontograma Premium          ~35 min
  Bloco 2 — Sprint 2.2: Ficha Clínica Timeline       ~55 min
  Bloco 3 — Tratamento: Legenda + Modo Paciente       ~40 min
  Bloco 4 — Inconsistências Globais                   ~25 min
  Bloco 5 — Orçamentos                                ~40 min

Amanhã
  Bloco 6 — Financeiro                                ~35 min
  Bloco 7 — Landing Page + Login                      ~40 min
  Bloco 8 — Pacientes                                 ~20 min
  Bloco 9 — Agenda (audit + polish)                   ~30 min
  Bloco 10 — Configurações (audit + polish)           ~25 min
```

---

## Bloco 1 — Sprint 2.1: Odontograma Premium
**Arquivo:** `src/components/odontograma/Odontograma.tsx`  
**Tempo:** ~35 min  
**Spec completo:** `docs/superpowers/specs/2026-06-01-odontograma-premium-sprint2-1.md`  
**Plan detalhado:** `docs/superpowers/plans/2026-06-01-odontograma-premium.md`

### Task 1 — Escala 1.6x dos DIMS
Substituir o objeto `DIMS` (linhas 64–75):
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

### Task 2 — Numeração + gap + hover scale
- `fontSize: '8px'` → `'10px'` nos dois spans de número (upper e lower)
- `gap: 3` → `gap: 5` no style do botão
- `transform scale(1.12)` → `scale(1.10)` no hover
- `transform scale(1.06)` → `scale(1.04)` no active
- `gap-[2px]` → `gap-[3px]` nos dois divs de arcada (upper e lower)

### Task 3 — Estados visuais mais fortes (ToothSVG)
```typescript
// strokeW
const strokeW = state === 'selected' ? 2 : (state === 'shared' || hovered) ? 1.5 : 1;

// crownFill — historical: 14% → 20%
const crownFill =
  state === 'selected'     ? 'var(--color-teal)'
  : state === 'shared'     ? 'color-mix(in srgb, var(--color-teal) 25%, var(--color-surface-alt))'
  : state === 'historical' ? 'color-mix(in srgb, var(--color-teal) 20%, var(--color-surface-alt))'
  : 'var(--color-surface-alt)';

// crownStroke — historical: 45% → 55%
const crownStroke =
  hovered                   ? 'var(--color-teal)'
  : state === 'selected'    ? 'var(--color-teal)'
  : state === 'shared'      ? 'color-mix(in srgb, var(--color-teal) 70%, var(--color-border))'
  : state === 'historical'  ? 'color-mix(in srgb, var(--color-teal) 55%, var(--color-border))'
  : 'var(--color-border)';

// crownFilter — novo
const crownFilter =
  state === 'selected'
    ? 'drop-shadow(0 0 4px color-mix(in srgb, var(--color-teal) 45%, transparent))'
    : 'none';
```
- Root path: adicionar tint teal quando `selected` → `color-mix(in srgb, var(--color-teal) 18%, var(--color-surface-alt))`
- Crown path: adicionar `filter: crownFilter` e incluir na transition
- `renderArch`: adicionar `const numWeight = (state === 'selected' || state === 'shared') ? 800 : 700;` e usar nos dois spans

### Task 4 — Labels de quadrante + separador
- Labels: `text-[8px]` → `text-[9px]`, `tracking-[0.18em]` → `tracking-[0.22em]`
- Margem superior: `mb-1.5` → `mb-2` / `mt-1.5` → `mt-2`
- Separador: `height: 1` → `height: 2`, `my-[5px]` → `my-[8px]`

### Task 5 — Legenda: inline → popover na tab bar
1. Adicionar import: `import { List } from 'lucide-react';`
2. Adicionar state: `const [legendOpen, setLegendOpen] = useState(false);`
3. Reescrever o div da tab bar para incluir `relative`, `flex-1`, botão "Legenda" e painel absoluto
4. **Remover** o bloco `{/* Legend — inline right */}` completo do rodapé de filtros

Ver plan detalhado para o JSX completo do popover.

### Task 6 — Filtros: padding maior
- `px-2.5 py-1` → `px-3 py-1.5` no botão de filtro
- Remover `<div className="flex-1" />` que ficava entre filtros e legenda

**Verificação pós-execução:**
```bash
npx tsc --noEmit
```
- [ ] Dentes visivelmente maiores
- [ ] Números 10px legíveis
- [ ] Selected: fill teal + drop-shadow + stroke 2px
- [ ] Legenda inline removida
- [ ] Botão "Legenda" no tab bar funcionando
- [ ] Dark mode sem regressão

---

## Bloco 2 — Sprint 2.2: Ficha Clínica Timeline
**Arquivo:** `src/components/pacientes/FichasTab.tsx`  
**Tempo:** ~55 min  
**Spec completo:** `docs/superpowers/specs/2026-05-30-sprint2-bloco3-ficha-clinica-timeline.md`  
**Plan detalhado:** `docs/superpowers/plans/2026-05-30-ficha-clinica-timeline.md`

### Task 1 — Infraestrutura
1. Adicionar imports: `ChevronDown, Stethoscope, RotateCcw, AlertCircle, Zap`
2. Adicionar `ARCH_SHORT` e `TYPE_CONFIG` após `ARCH_LABELS`
3. Adicionar helper `buildCollapsedContent` antes do componente
4. Adicionar state `expandedIds` + `toggleExpand` no componente
5. Atualizar `fetchFichas` para aceitar `autoExpandFirst = false`
6. Atualizar `useEffect` para chamar `fetchFichas(true)` na montagem
7. Atualizar `handleSave` para expandir o card recém-salvo

### Task 2 — Reescrever render da timeline
Substituir o bloco `<div className="relative space-y-8 ...">` (linha ~1122) pelo novo render colapsável com:
- `isOpen = expandedIds.has(evo.id)`
- Tags clínicas `buildCollapsedContent` no estado colapsado
- Dot com `TypeIcon` por tipo de evento
- Header clicável com `toggleExpand`
- `AnimatePresence` para conteúdo expandido
- `ChevronDown` rotacionando 180° quando aberto

Ver plan detalhado para o JSX completo.

### Task 3 — Reorganizar formulário em seções clínicas
Substituir a coluna esquerda do formulário por 4 seções separadas por `<div className="h-px bg-border/40 mb-5" />`:
1. **Queixa Principal** (era "Tipo de Registro")
2. **Avaliação Clínica** (era "Observações Gerais")
3. **Procedimentos** (mantido, com ajuste de label)
4. **Anexos** (mantido)

### Task 4 — TypeScript + verificação
```bash
npx tsc --noEmit
```
- [ ] Primeiro registro abre automaticamente ao montar
- [ ] Toggle colapsa/expande corretamente
- [ ] Tags clínicas visíveis no estado colapsado
- [ ] Card recém-salvo expande automaticamente
- [ ] Seções do formulário com separadores visíveis
- [ ] Labels renomeadas (Queixa Principal, Avaliação Clínica)
- [ ] Ícone por tipo no dot e no badge

---

## Bloco 3 — Tratamento: Legenda + Modo Paciente
**Arquivo:** `src/components/pacientes/PlanejamentoTab.tsx`  
**Tempo:** ~40 min

### Task 1 — Remover legenda duplicada do odontograma
No bloco "MAPA DO TRATAMENTO", após `</Odontograma>`, remover completamente:
```tsx
{/* Custom legend override */}
<div className="flex items-center gap-4 mt-3 flex-wrap">
  ...3 itens de legenda...
</div>
```
A legenda do Odontograma (após Sprint 2.1) já fica no popover discreto do tab bar. A legenda inline era redundante e usava rótulos diferentes dos do componente.

### Task 2 — Remover Modo Paciente
1. Remover estado `patientModeOpen` e `setPatientModeOpen`
2. Remover botão "Modo Paciente" do header (linhas ~790-797):
```tsx
{planProcs.length > 0 && (
  <button onClick={() => setPatientModeOpen(true)} ...>
    <Users className="w-4 h-4 text-teal" />
    Modo Paciente
  </button>
)}
```
3. Remover o bloco `{/* ── PATIENT EXPLANATION MODE ── */}` completo (~175 linhas)
4. Remover imports que ficarem órfãos após remoção (verificar `Users` se usado em outro lugar)

### Task 3 — Adicionar Slide 0 de Progresso no Apresentar
No engine de apresentação (`isPresentationOpen`), modificar o slide render para incluir um slide 0 antes das seções:

```
currentSlide === 0 → Slide de Progresso (novo)
currentSlide 1..N → sections[currentSlide - 1] (ajustar índice)
currentSlide === totalSlides - 1 → Investimento (já existe)
```

**Conteúdo do Slide 0:**
```tsx
// Slide 0 — Progresso geral
<div className="w-full max-w-2xl flex flex-col items-center text-center">
  <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-5"
     style={{ color: '#2f9c85' }}>
    Plano de Tratamento
  </p>
  <h2 className="font-heading text-3xl sm:text-5xl text-white mb-3 leading-tight">
    {patientName}
  </h2>

  {/* Círculo de progresso */}
  <div className="relative w-28 h-28 my-8">
    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
      <circle cx="56" cy="56" r="46" fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle cx="56" cy="56" r="46" fill="none"
        stroke="#2f9c85" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 46}`}
        strokeDashoffset={`${2 * Math.PI * 46 * (1 - progressPercent / 100)}`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-2xl font-bold text-white">{progressPercent}%</span>
    </div>
  </div>

  {/* Stats */}
  <div className="flex items-center gap-8 mb-8">
    <div className="text-center">
      <div className="font-mono text-2xl font-bold text-white">{planProcs.length}</div>
      <div className="text-[11px] text-white/40 mt-1">procedimentos</div>
    </div>
    <div className="w-px h-8 bg-white/10" />
    <div className="text-center">
      <div className="font-mono text-2xl font-bold" style={{ color: '#2f9c85' }}>{concluidosCount}</div>
      <div className="text-[11px] text-white/40 mt-1">concluídos</div>
    </div>
    {planProcs.length - concluidosCount > 0 && (
      <>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-white/60">
            {planProcs.length - concluidosCount}
          </div>
          <div className="text-[11px] text-white/40 mt-1">pendentes</div>
        </div>
      </>
    )}
  </div>

  {/* Quadrant breakdown */}
  {quadrantStats.length > 0 && (
    <div className="w-full max-w-sm space-y-3">
      {quadrantStats.map(q => {
        const pct = q.total > 0 ? Math.round((q.done / q.total) * 100) : 0;
        return (
          <div key={q.key} className="flex items-center gap-3">
            <span className="text-[11px] text-white/50 w-20 text-right shrink-0">{q.short}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: pct === 100 ? '#2f9c85' : 'rgba(47,156,133,0.5)' }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/40 w-10 shrink-0">{q.done}/{q.total}</span>
          </div>
        );
      })}
    </div>
  )}
</div>
```

**Ajustar `totalSlides`:**
```typescript
const totalSlides = sections.length + 2; // +1 slide progresso, +1 slide investimento
```

**Ajustar index dos slides no render:**
- `currentSlide === 0` → slide de progresso
- `currentSlide >= 1 && currentSlide <= sections.length` → `sections[currentSlide - 1]`
- `currentSlide === totalSlides - 1` → investimento

**Ajustar overview grid** para incluir o slide 0 no início:
```typescript
[null, ...sections, null].map((sec, idx) => ...)
// idx 0 = progresso, idx 1..N = seções, último = investimento
```

**Verificação:**
- [ ] Botão "Modo Paciente" removido do header
- [ ] Estado `patientModeOpen` removido
- [ ] Bloco Patient Mode removido (~175 linhas)
- [ ] Legenda duplicada removida do Mapa do Tratamento
- [ ] Apresentar slide 0 mostra progresso + quadrantes
- [ ] Slides 1..N continuam funcionando corretamente
- [ ] Slide investimento continua como último
- [ ] Overview grid inclui slide 0
- [ ] TypeScript sem erros

---

## Bloco 4 — Inconsistências Globais
**Tempo:** ~25 min

### Task 1 — notification-bell.tsx: tokens hardcoded
**Arquivo:** `src/components/layout/notification-bell.tsx`

Substituir todas as cores hardcoded por tokens:
```typescript
// ANTES
const iconColor = (type) =>
  type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#2f9c85';
const bgColor = (type) =>
  type === 'danger' ? 'rgba(239,68,68,0.08)' : type === 'warning' ? 'rgba(245,158,11,0.08)' : 'rgba(47,156,133,0.08)';
const borderColor = (type) =>
  type === 'danger' ? 'rgba(239,68,68,0.25)' : type === 'warning' ? 'rgba(245,158,11,0.25)' : 'rgba(47,156,133,0.25)';
const badgeBg = alerts.some(a => a.type === 'danger')
  ? '#ef4444' : alerts.some(a => a.type === 'warning') ? '#f59e0b' : '#2f9c85';

// DEPOIS
const iconColor = (type: DexAlert['type']) =>
  type === 'danger'  ? 'var(--color-coral)'
  : type === 'warning' ? 'var(--color-amber, #f59e0b)'
  : 'var(--color-teal)';

const bgColor = (type: DexAlert['type']) =>
  type === 'danger'  ? 'color-mix(in srgb, var(--color-coral) 8%, transparent)'
  : type === 'warning' ? 'rgba(245,158,11,0.08)'
  : 'color-mix(in srgb, var(--color-teal) 8%, transparent)';

const borderColor = (type: DexAlert['type']) =>
  type === 'danger'  ? 'color-mix(in srgb, var(--color-coral) 25%, transparent)'
  : type === 'warning' ? 'rgba(245,158,11,0.25)'
  : 'color-mix(in srgb, var(--color-teal) 25%, transparent)';

const badgeBg =
  alerts.some(a => a.type === 'danger')  ? 'var(--color-coral)'
  : alerts.some(a => a.type === 'warning') ? '#f59e0b'
  : 'var(--color-teal)';
```

Painel de notificações — substituir inline styles hardcoded:
```tsx
// ANTES
style={{ background: 'rgba(9,9,11,0.98)', border: '1px solid rgba(47,156,133,0.2)' }}

// DEPOIS
style={{
  background: 'color-mix(in srgb, var(--color-brand-charcoal) 98%, transparent)',
  border: '1px solid color-mix(in srgb, var(--color-teal) 20%, transparent)'
}}
```

### Task 2 — sidebar-content.tsx: indicador online + chevron de tema
**Arquivo:** `src/components/layout/sidebar-content.tsx`

1. Indicador online do avatar:
```tsx
// ANTES
<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0d0d0d]" />

// DEPOIS
<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal border-2 border-brand-charcoal" />
```

2. `ChevronRight` no botão de tema — remover (o chevron sugere painel mas o botão apenas troca o tema):
```tsx
// Remover este bloco do botão de tema:
<AnimatePresence mode="wait">
  {isExpanded && (
    <motion.div ...>
      <ChevronRight className="w-3.5 h-3.5 text-white/25 ..." />
    </motion.div>
  )}
</AnimatePresence>
```

**Verificação:**
- [ ] Notification bell: sem cores hardcoded (`#ef4444`, `rgba(...)`)
- [ ] Online dot usa `bg-teal` 
- [ ] ChevronRight removido do toggle de tema
- [ ] Dark mode sem regressão nas notificações

---

## Bloco 5 — Orçamentos
**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`  
**Tempo:** ~40 min

### Task 1 — Cards de métricas: alinhamento com Dashboard
Os 3 cards no topo usam `rounded-2xl p-5` e icon containers `rounded-full`. Padronizar para o sistema do Dashboard:

```tsx
// ANTES — card genérico
<div className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex items-center gap-4">
  <div className="w-12 h-12 rounded-full bg-teal/10 text-teal flex items-center justify-center">
    <CheckCircle2 className="w-6 h-6" />
  </div>
  <div>
    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1">
      Aprovados (Mês)
    </div>
    <div className="font-mono text-2xl font-semibold text-text-primary">
      {formatCurrency(totalAprovados)}
    </div>
  </div>
</div>

// DEPOIS — alinhado com padrão Dashboard
<div className="bg-surface p-6 rounded-3xl border border-border shadow-sm flex flex-col justify-between min-h-[120px]">
  <div className="flex items-center justify-between">
    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
      Aprovados (Mês)
    </span>
    <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
      <CheckCircle2 className="w-4 h-4 text-teal" />
    </div>
  </div>
  <div className="font-mono text-3xl font-bold text-teal">
    {formatCurrency(totalAprovados)}
  </div>
</div>
```

Aplicar o mesmo padrão nos 3 cards. O terceiro card (taxa de conversão) já tem o glassmorphism premium — manter o estilo, só ajustar `rounded-2xl` → `rounded-3xl`.

### Task 2 — Lista de orçamentos: hierarquia visual por status
Localizar o render dos cards da lista. Diferenciar visualmente `aprovado` dos demais:

```tsx
// Card aprovado recebe borda teal sutil
className={`... border ${
  orc.status === 'aprovado'
    ? 'border-teal/20'
    : orc.status === 'recusado'
    ? 'border-coral/20'
    : 'border-border'
}`}
```

### Task 3 — Hover states na lista
```tsx
// Adicionar hover ao card/linha
className="... cursor-pointer hover:bg-surface-alt/50 transition-colors"
```

### Task 4 — Substituir `→` Unicode pelo ícone Lucide nos botões de ação
Verificar se há `→` hardcoded em botões e substituir por `<ArrowRight className="w-4 h-4" />`.

**Verificação:**
- [ ] Cards de métricas com `rounded-3xl` e icon boxes `rounded-xl`
- [ ] Cards aprovado/recusado com borda colorida
- [ ] Hover states nas linhas da lista
- [ ] TypeScript sem erros

---

## Bloco 6 — Financeiro
**Arquivo:** `src/app/dashboard/financeiro/_components/financeiro-client.tsx`  
**Tempo:** ~35 min

### Task 1 — Cards de métricas: alinhamento com Dashboard
Os cards de receita/despesas/saldo estão com padding e radius menor que o Dashboard. Localizar e ajustar para `rounded-3xl p-6 min-h-[120px]` com o mesmo padrão do Bloco 5.

### Task 2 — Custo por hora: hero card
O `custoPorHora` hoje está provavelmente em um card secundário. Promover para o card de destaque da seção:

```tsx
// Card de custo/hora com tratamento premium
<div className="p-6 rounded-3xl shadow-lg border text-white"
  style={{
    background: 'color-mix(in srgb, var(--color-brand-charcoal) 92%, transparent)',
    border: '1px solid color-mix(in srgb, var(--color-teal) 25%, transparent)'
  }}>
  <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-4"
    style={{ color: 'var(--color-teal)' }}>
    Custo por Hora Clínica
  </div>
  <div className="font-mono text-4xl font-bold text-white">
    {semHorario ? '—' : `R$ ${fmt(custoPorHora ?? 0)}`}
  </div>
  <div className="text-xs text-white/40 mt-2">
    {semHorario
      ? 'Sem agendamentos no mês'
      : `${horasNoMes}h trabalhadas · R$ ${fmt(despesasFixas)} despesas fixas`
    }
  </div>
</div>
```

### Task 3 — Sheet de lançamento: header customizado
O `SheetContent` usa shadcn puro. Adicionar um header com identidade visual da seção:
```tsx
<SheetHeader className="border-b border-border pb-4 mb-6">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
      {sheetMode === 'saida'
        ? <ArrowDownLeft className="w-4 h-4 text-coral" />
        : <ArrowUpRight className="w-4 h-4 text-teal" />
      }
    </div>
    <SheetTitle className="font-heading text-lg">
      {sheetMode === 'saida' ? 'Registrar Saída' : 'Registrar Entrada'}
    </SheetTitle>
  </div>
</SheetHeader>
```

**Verificação:**
- [ ] Cards de métricas `rounded-3xl`
- [ ] Custo/hora em card de destaque
- [ ] Sheet com header customizado
- [ ] Modo privacidade funcionando
- [ ] TypeScript sem erros

---

## Bloco 7 — Landing Page + Login
**Arquivos:** `src/app/page.tsx` e `src/app/(auth)/login/page.tsx`  
**Tempo:** ~40 min

### Task 1 — Investigar seção de features quebrada
Navegar até `http://localhost:3000/#funcionalidades` ou localizar a seção "O Poder da IA no seu Consultório" no código da landing page. Identificar se o grid está com breakpoint errado ou se é um problema de animação de entrada.

**Sintoma:** Apenas 1 feature card visível com grande espaço vazio à direita. Grid deveria ser 3 colunas.

**Ação após investigação:** Corrigir o grid responsivo ou o stagger de animação que impede os cards de renderizarem.

### Task 2 — Unificar layout de login
Hoje existem duas experiências de login:
- `src/app/(auth)/login/page.tsx` — card centralizado simples (sem painel de branding)
- Login com redirecionamento do dashboard — layout 2 colunas (painel teal + formulário)

**Ação:** Identificar qual componente renderiza o layout 2 colunas e torná-lo o padrão para o `/login` direto também. O layout 2 colunas é mais premium e deve ser a única experiência.

### Task 3 — Página de planos: alinhar alturas dos cards
**Arquivo:** `src/app/planos/page.tsx` (ou componente equivalente)

As descrições dos planos têm comprimentos diferentes causando desalinhamento dos preços. Adicionar `min-h` nas descrições:
```tsx
<p className="text-sm text-text-secondary min-h-[56px] leading-relaxed">
  {descricao}
</p>
```

**Verificação:**
- [ ] Seção de features renderiza os 3 cards corretamente
- [ ] `/login` direto usa o layout 2 colunas
- [ ] Cards de planos com alturas alinhadas
- [ ] Mobile responsivo sem quebras

---

## Bloco 8 — Pacientes
**Arquivo:** `src/components/pacientes/pacientes-table.tsx`  
**Tempo:** ~20 min

### Task 1 — Hover states nas linhas da tabela
As linhas da tabela não têm estado de hover explícito. Adicionar:
```tsx
// thead
<thead className="bg-surface-alt/50 border-b border-border">

// tr da tabela
<tr
  onClick={() => router.push(`/dashboard/pacientes/${p.id}`)}
  className="border-b border-border/40 cursor-pointer hover:bg-surface-alt/40 transition-colors last:border-0"
>
```

### Task 2 — Coluna de ações: checar alinhamento
Verificar se a coluna de email/telefone/data está com truncate correto em viewports menores.

**Verificação:**
- [ ] Hover nas linhas da tabela funcionando
- [ ] Linha clicável navega para o paciente
- [ ] Sem layout shifts no hover

---

## Bloco 9 — Agenda (audit + polish)
**Arquivo:** `src/app/dashboard/agendamentos/_components/`  
**Tempo:** ~30 min

### Task 1 — Audit visual das 3 views
Antes de implementar: navegar pelo app autenticado e tirar screenshots das views mês, semana e dia. Identificar os problemas específicos.

**Pontos a verificar:**
- Cabeçalho da página: tem o mesmo padrão do Dashboard (título + subtítulo + CTA)?
- Células do calendário: radius, hover state, eventos com pills coloridos?
- Sheet de detalhe do agendamento: header customizado ou shadcn puro?
- Status badges dos agendamentos: usando tokens ou cores hardcoded?

### Task 2 — Polish baseado no audit
Aplicar correções pontuais identificadas no audit. Priorizar:
- Cabeçalho padronizado se ausente
- Hover states nas células
- Sheet com header customizado (igual ao Financeiro)

---

## Bloco 10 — Configurações (audit + polish)
**Arquivo:** `src/app/dashboard/configuracoes/`  
**Tempo:** ~25 min

### Task 1 — Audit visual
Verificar as páginas:
- `/dashboard/configuracoes` — página principal
- `/dashboard/configuracoes/usuarios` — gestão de usuários
- `/dashboard/configuracoes/whatsapp` — integração WhatsApp

**Pontos a verificar:**
- Headers das páginas padronizados?
- Formulários usando tokens ou cores hardcoded?
- Cards/seções com `rounded-3xl` consistente?
- Separadores e hierarquia visual?

### Task 2 — Polish
Aplicar correções de:
- Headers sem padronização
- Campos de formulário com estilos inconsistentes
- Botões de ação com padrão do sistema

---

## ⚠️ Backlog — Dex: Integração no Sistema (DISCUTIR)

> Discussão iniciada em 2026-06-02. Dex hoje é um chatbot flutuante sem presença real no sistema.
> A proposta é transformá-lo na **identidade inteligente operacional** — aparecendo onde a IA trabalha, não só quando o usuário abre o painel.

**Iniciativas priorizadas (a detalhar em spec próprio):**

1. **Rebrand de ações de IA → "Dex"** — botões "Gerar com IA" viram "Gerar com Dex" (logo + teal), loaders genéricos viram DexLoader com mensagem contextual. Baixo esforço, alto impacto visual imediato.

2. **DexLoader universal** — componente `<DexLoader message="..." />` reutilizável que substitui todos os spinners durante processamento de IA no sistema (planejamento, fichas, orçamento por voz).

3. **Dex briefing no Dashboard** — card inteligente de bom-dia com contexto do dia: consultas, pacientes sem retorno, orçamentos pendentes. O Dex aparece útil *sem o usuário pedir nada*.

4. **Dex no planejamento** — geração do plano de tratamento vira experiência Dex animada (bolinha + streaming do conteúdo).

> **Próximo passo:** Abrir sessão de brainstorming dedicada ao Dex antes de implementar.

---

## Checklist Final de Qualidade

Após todos os blocos, verificar o sistema completo:

```
[ ] Landing page — features section renderiza 3 colunas
[ ] Login — único layout (2 colunas sempre)
[ ] Planos — cards com alturas alinhadas
[ ] Dashboard — sem regressão (referência 9/10)
[ ] Odontograma — dentes 1.6x, legenda como popover
[ ] Ficha Clínica — timeline colapsável, formulário em seções
[ ] Tratamento — sem legenda duplicada, Modo Paciente removido
[ ] Apresentar — slide 0 com progresso + quadrantes
[ ] Pacientes — hover states nas linhas
[ ] Orçamentos — cards rounded-3xl, status diferenciados
[ ] Financeiro — custo/hora em destaque, sheet com header
[ ] Agenda — headers + hover states + sheet custom
[ ] Configurações — headers + formulários padronizados
[ ] Sidebar — sem emerald-400, sem ChevronRight no tema
[ ] Notification Bell — sem cores hardcoded
[ ] Dark mode — sem regressão em nenhuma tela
[ ] TypeScript — zero erros em todos os arquivos modificados
```

---

## Notas de Execução

- Executar `npx tsc --noEmit` após cada bloco
- Testar dark mode após Blocos 1, 2, 4
- Não alterar lógica de negócio — somente visual
- Commit por bloco concluído (não por task individual)
- Se travar em algo, pular e continuar — anotar para revisitar

---

## Resumo de Arquivos Modificados

| Arquivo | Bloco |
|---|---|
| `src/components/odontograma/Odontograma.tsx` | 1 |
| `src/components/pacientes/FichasTab.tsx` | 2 |
| `src/components/pacientes/PlanejamentoTab.tsx` | 3 |
| `src/components/layout/notification-bell.tsx` | 4 |
| `src/components/layout/sidebar-content.tsx` | 4 |
| `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` | 5 |
| `src/app/dashboard/financeiro/_components/financeiro-client.tsx` | 6 |
| `src/app/page.tsx` (landing) | 7 |
| `src/app/(auth)/login/page.tsx` | 7 |
| `src/app/planos/page.tsx` | 7 |
| `src/components/pacientes/pacientes-table.tsx` | 8 |
| `src/app/dashboard/agendamentos/_components/` | 9 |
| `src/app/dashboard/configuracoes/` | 10 |
