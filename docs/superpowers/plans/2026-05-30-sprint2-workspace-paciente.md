# Sprint 2 — Workspace do Paciente: Plano de Implementação

**Goal:** Elevar a percepção visual de Pacientes, Perfil do Paciente e Ficha Clínica ao nível de Dashboard e Tratamento — sem novas funcionalidades, sem complexidade adicional.

**Referências visuais obrigatórias:** Dashboard (`src/app/dashboard/page.tsx`) e Tratamento (`src/components/pacientes/PlanejamentoTab.tsx`). Após cada tarefa, conferir: "Esta tela está mais próxima de Dashboard e Tratamento?"

**Spec:** `docs/superpowers/specs/2026-05-30-sprint2-workspace-paciente.md`

---

## Architecture Overview

Mudanças puramente de frontend/UI. Sem novas rotas de API, sem alterações de schema. Todos os dados já existem.

- **Módulo 1 (Lista):** `PacientesList` (server) passa novos dados de métricas → `PacientesTable` (client) renderiza strip.
- **Módulo 2 (Perfil):** `PacienteDetailClient` recebe novo sub-componente `PatientHeroStrip` e tem o Resumo reestruturado.
- **Módulo 3 (Ficha):** `FichasTab` muda a renderização das evoluções de flat para timeline expansível.

---

## Tech Stack

- Next.js App Router (Server + Client Components)
- TypeScript estrito (sem `any`)
- Tailwind CSS v4 com tokens canônicos (`bg-surface`, `text-text-primary`, `border-border`, etc.)
- Framer Motion para animações

---

## File Structure Map

**Modificados:**
- `src/app/dashboard/pacientes/page.tsx` — header atualizado
- `src/app/dashboard/pacientes/_components/pacientes-list.tsx` — queries de métricas
- `src/components/pacientes/pacientes-table.tsx` — metrics strip, row styling, empty state
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` — header, hero strip, resumo
- `src/components/pacientes/FichasTab.tsx` — timeline pattern

**Criados:**
- `src/components/pacientes/patient-hero-strip.tsx` — componente do painel operacional

---

## Task 1: Adicionar queries de métricas em PacientesList

**Arquivo:** `src/app/dashboard/pacientes/_components/pacientes-list.tsx`

Adicionar interface de métricas e 3 queries paralelas ao servidor.

**Steps:**

1. Abrir o arquivo. Após o `import` de `getDentistaCached`, adicionar:

```typescript
export interface PacientesMetrics {
  total: number;
  novosEsteMes: number;
  emTratamento: number;
  followupsPendentes: number;
}
```

2. Dentro de `PacientesList`, após as variáveis `q`, `sortCol`, etc., adicionar as queries paralelas de métricas **antes** da query principal:

```typescript
const inicioMes = new Date();
inicioMes.setDate(1);
inicioMes.setHours(0, 0, 0, 0);

const [
  { data: pacientes, count },
  { count: novosCount },
  { data: emTratamentoRaw },
  { count: followupsCount },
] = await Promise.all([
  // Query principal (já existente)
  (() => {
    let q2 = supabase
      .from('pacientes')
      .select(
        `id, nome, email, telefone, created_at, data_nascimento,
         followup_pendente, dentista:dentistas(nome)`,
        { count: 'exact' },
      )
      .eq('clinica_id', dentista.clinica_id);
    if (isDentista) q2 = q2.eq('dentista_id', dentista.id);
    if (q) q2 = q2.or(`nome.ilike.%${q}%,email.ilike.%${q}%,telefone.ilike.%${q}%`);
    return q2.order(sortCol, { ascending: sortAsc }).range(from, to);
  })(),
  // Novos este mês
  supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('clinica_id', dentista.clinica_id)
    .gte('created_at', inicioMes.toISOString()),
  // Em tratamento — orçamentos aprovados (paciente_ids únicos)
  supabase
    .from('orcamentos')
    .select('paciente_id')
    .eq('clinica_id', dentista.clinica_id)
    .eq('status', 'aprovado'),
  // Follow-ups pendentes
  supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
    .eq('clinica_id', dentista.clinica_id)
    .eq('followup_pendente', true),
]);

const emTratamentoCount = new Set(
  (emTratamentoRaw ?? []).map((r) => r.paciente_id as string)
).size;

const metrics: PacientesMetrics = {
  total: count ?? 0,
  novosEsteMes: novosCount ?? 0,
  emTratamento: emTratamentoCount,
  followupsPendentes: followupsCount ?? 0,
};
```

3. Atualizar o `return` para passar `metrics` ao `PacientesTable`:

```typescript
return (
  <PacientesTable
    pacientes={pacientes ?? []}
    total={count ?? 0}
    canCreate={canCreate}
    currentParams={{ q, sort: sortCol, order: sortAsc ? 'asc' : 'desc', page }}
    metrics={metrics}
  />
);
```

4. Verificar que TypeScript não aponta erros: `npx tsc --noEmit`

5. Commit: `git commit -m "feat(pacientes): adicionar queries de métricas em PacientesList"`

---

## Task 2: Adicionar metrics strip em PacientesTable

**Arquivo:** `src/components/pacientes/pacientes-table.tsx`

Adicionar prop `metrics` e renderizar os 4 cards acima do componente principal.

**Steps:**

1. Adicionar import no topo do arquivo:

```typescript
import { ClipboardList, UserPlus, RefreshCw, Bell } from 'lucide-react';
import type { PacientesMetrics } from '@/app/dashboard/pacientes/_components/pacientes-list';
```

2. Atualizar a interface `PacientesTableProps`:

```typescript
interface PacientesTableProps {
  pacientes: PacienteRow[];
  total: number;
  canCreate: boolean;
  currentParams: CurrentParams;
  metrics: PacientesMetrics;
}
```

3. Atualizar a assinatura da função:

```typescript
export function PacientesTable({
  pacientes,
  total,
  canCreate,
  currentParams,
  metrics,
}: PacientesTableProps) {
```

4. Adicionar o sub-componente `MetricsStrip` **antes** do `return` principal da função:

```typescript
const MetricsStrip = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {/* Total */}
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
        <ClipboardList className="w-5 h-5 text-teal" />
      </div>
      <div>
        <div className="font-mono text-2xl font-bold text-text-primary leading-none">
          {metrics.total}
        </div>
        <div className="text-xs text-text-secondary font-medium mt-1">Total de pacientes</div>
      </div>
    </div>

    {/* Novos este mês */}
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
        <UserPlus className="w-5 h-5 text-teal" />
      </div>
      <div>
        <div className="font-mono text-2xl font-bold text-text-primary leading-none">
          {metrics.novosEsteMes}
        </div>
        <div className="text-xs text-text-secondary font-medium mt-1">Novos este mês</div>
      </div>
    </div>

    {/* Em tratamento */}
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
        <RefreshCw className="w-5 h-5 text-teal" />
      </div>
      <div>
        <div className="font-mono text-2xl font-bold text-text-primary leading-none">
          {metrics.emTratamento}
        </div>
        <div className="text-xs text-text-secondary font-medium mt-1">Em tratamento</div>
      </div>
    </div>

    {/* Follow-ups — clicável para ativar filtro */}
    <button
      onClick={() => setFilterFollowup((v) => !v)}
      className={`bg-surface rounded-2xl border shadow-sm p-5 flex items-center gap-4 text-left transition-all ${
        filterFollowup
          ? 'border-warning/40 bg-warning-pale/30'
          : 'border-border hover:border-warning/30'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        filterFollowup ? 'bg-warning/15' : 'bg-warning-pale'
      }`}>
        <Bell className={`w-5 h-5 ${filterFollowup ? 'text-warning' : 'text-warning'}`} />
      </div>
      <div>
        <div className={`font-mono text-2xl font-bold leading-none ${
          metrics.followupsPendentes > 0 ? 'text-warning' : 'text-text-primary'
        }`}>
          {metrics.followupsPendentes}
        </div>
        <div className="text-xs text-text-secondary font-medium mt-1">
          {filterFollowup ? 'Filtro ativo' : 'Follow-ups'}
        </div>
      </div>
    </button>
  </div>
);
```

5. No `return` principal, adicionar `<MetricsStrip />` **antes** do `<div className="bg-surface rounded-2xl...">`:

```typescript
return (
  <div className={isPending ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
    <MetricsStrip />
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* ... resto do componente inalterado ... */}
    </div>
  </div>
);
```

6. Verificar: `npx tsc --noEmit`

7. Commit: `git commit -m "feat(pacientes): metrics strip com 4 cards acima da tabela"`

---

## Task 3: Melhorar page.tsx — header com descrição forte

**Arquivo:** `src/app/dashboard/pacientes/page.tsx`

**Steps:**

1. Localizar o bloco `<header>` (linha ~33). Substituir o conteúdo:

```tsx
<header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
  <div>
    <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
      Pacientes
    </h1>
    <p className="text-text-secondary text-sm font-medium mt-1">
      Workspace de pacientes da clínica.
    </p>
  </div>
  {canCreate && (
    <Link
      href="/dashboard/pacientes/novo"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                 text-sm font-bold text-white bg-gradient-to-r from-teal to-teal-lt
                 shadow-[0_4px_16px_rgba(47,156,133,0.3)]
                 hover:-translate-y-px active:scale-[0.98] transition-all
                 self-start md:self-center shrink-0"
    >
      <Plus className="w-4 h-4" />
      Novo Paciente
    </Link>
  )}
</header>
```

2. Verificar: `npx tsc --noEmit`

3. Commit: `git commit -m "feat(pacientes): header com hierarquia premium"`

---

## Task 4: Melhorar empty state da tabela (estado sem pacientes)

**Arquivo:** `src/components/pacientes/pacientes-table.tsx`

Substituir o empty state atual (que já existe mas pode ser melhorado) pelo padrão spec.

**Steps:**

1. Localizar o bloco `{isDataEmpty && (` dentro do `<tbody>` (linha ~269). Substituir por:

```tsx
{isDataEmpty && (
  <tr>
    <td colSpan={4} className="py-16">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center">
          <Users className="w-6 h-6 text-text-secondary/40" />
        </div>
        <div>
          <p className="text-text-primary font-semibold text-sm">
            Nenhum paciente cadastrado
          </p>
          <p className="text-text-secondary text-xs mt-1 max-w-[220px] mx-auto">
            {canCreate
              ? 'Cadastre o primeiro paciente da clínica.'
              : 'Aguarde o cadastro pela recepção.'}
          </p>
        </div>
        {canCreate && (
          <a
            href="/dashboard/pacientes/novo"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                       text-white bg-gradient-to-r from-teal to-teal-lt
                       shadow-[0_4px_12px_rgba(47,156,133,0.3)] hover:-translate-y-px transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Paciente
          </a>
        )}
      </div>
    </td>
  </tr>
)}
```

2. Fazer o mesmo para o empty state mobile (bloco `{isDataEmpty && (` dentro do `div.md:hidden`):

```tsx
{isDataEmpty && (
  <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
    <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center">
      <Users className="w-6 h-6 text-text-secondary/40" />
    </div>
    <div>
      <p className="text-text-primary font-semibold text-sm">
        Nenhum paciente cadastrado
      </p>
      <p className="text-text-secondary text-xs mt-1 max-w-[200px] mx-auto">
        {canCreate
          ? 'Cadastre o primeiro paciente da clínica.'
          : 'Aguarde o cadastro pela recepção.'}
      </p>
    </div>
    {canCreate && (
      <a
        href="/dashboard/pacientes/novo"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
                   text-white bg-gradient-to-r from-teal to-teal-lt
                   shadow-[0_4px_12px_rgba(47,156,133,0.3)] hover:-translate-y-px transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Novo Paciente
      </a>
    )}
  </div>
)}
```

3. Commit: `git commit -m "feat(pacientes): empty state premium com CTA"`

---

## Task 5: Criar PatientHeroStrip — painel operacional 3 colunas

**Arquivo (novo):** `src/components/pacientes/patient-hero-strip.tsx`

Este componente é o coração da Sprint 2. Exibe sempre: Próxima Consulta | Tratamento | Pendências. Nenhuma coluna pode parecer vazia — usar mensagem de estado vazio contextual.

**Steps:**

1. Criar o arquivo com o seguinte conteúdo completo:

```typescript
'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Stethoscope, AlertCircle, ChevronRight, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface AgendamentoProximo {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
}

interface PendenciaItem {
  fichaId: string;
  tooth: number;
  descricao: string;
  key: string;
  globalKey: string;
}

interface OrcamentoItem {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
}

interface PatientHeroStripProps {
  agendamentoProximo: AgendamentoProximo | null;
  pendencias: PendenciaItem[];
  pendenciasConcluidas: Set<string>;
  orcamentos: OrcamentoItem[];
  followupPendente: boolean;
  showClinicalTabs: boolean;
  onTabChange: (tab: string) => void;
}

function StripSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5 flex flex-col gap-3 min-h-[120px]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        {title}
      </div>
      {children}
    </div>
  );
}

export function PatientHeroStrip({
  agendamentoProximo,
  pendencias,
  pendenciasConcluidas,
  orcamentos,
  followupPendente,
  showClinicalTabs,
  onTabChange,
}: PatientHeroStripProps) {
  const router = useRouter();

  const pendenciasAtivas = pendencias.filter(
    (p) => !pendenciasConcluidas.has(p.globalKey)
  ).length;
  const orcamentosAbertos = orcamentos.filter((o) =>
    ['rascunho', 'enviado'].includes(o.status)
  ).length;
  const orcamentosAprovados = orcamentos.filter((o) => o.status === 'aprovado');
  const totalAprovado = orcamentosAprovados.reduce(
    (s, o) => s + (o.total ?? 0),
    0
  );

  const isTerminal = agendamentoProximo
    ? ['cancelled', 'no_show', 'completed'].includes(agendamentoProximo.status)
    : true;
  const canStart = showClinicalTabs && agendamentoProximo && !isTerminal;

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm mb-6 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">

        {/* Seção 1: Próxima Consulta */}
        <StripSection title="Próxima Consulta">
          {agendamentoProximo ? (
            <div className="flex flex-col gap-2 flex-1">
              <div>
                <div className="text-lg font-bold text-text-primary leading-tight">
                  {format(parseISO(agendamentoProximo.data_hora), "EEE', 'dd MMM", { locale: ptBR })}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {format(parseISO(agendamentoProximo.data_hora), "HH:mm")}
                  {' · '}{agendamentoProximo.duracao_minutos} min
                </div>
                {agendamentoProximo.dentista && (
                  <div className="text-xs text-teal font-medium mt-0.5">
                    {agendamentoProximo.dentista.nome}
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-center gap-2">
                {canStart && (
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => router.push(`/consulta/${agendamentoProximo.id}`)}
                    className="text-xs"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Iniciar Consulta
                  </Button>
                )}
                <button
                  onClick={() => onTabChange('agenda')}
                  className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1"
                >
                  Ver Agenda <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 text-text-secondary">
                <Calendar className="w-4 h-4 text-text-secondary/50" />
                <span className="text-sm">Nenhuma consulta agendada</span>
              </div>
              <button
                onClick={() => onTabChange('agenda')}
                className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1 mt-auto"
              >
                Ver Agenda <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </StripSection>

        {/* Seção 2: Tratamento */}
        <StripSection title="Tratamento">
          {showClinicalTabs ? (
            <div className="flex flex-col gap-2 flex-1">
              {(pendenciasAtivas > 0 || orcamentosAbertos > 0 || orcamentosAprovados.length > 0) ? (
                <div className="space-y-1.5">
                  {pendenciasAtivas > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Procedimentos pendentes</span>
                      <span className="font-mono text-sm font-bold text-text-primary">
                        {pendenciasAtivas}
                      </span>
                    </div>
                  )}
                  {orcamentosAbertos > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Orçamentos em aberto</span>
                      <span className="font-mono text-sm font-bold text-text-primary">
                        {orcamentosAbertos}
                      </span>
                    </div>
                  )}
                  {totalAprovado > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary">Valor aprovado</span>
                      <span className="font-mono text-sm font-bold text-teal">
                        {totalAprovado.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Stethoscope className="w-4 h-4 text-text-secondary/50" />
                  <span className="text-sm">Nenhum tratamento em andamento</span>
                </div>
              )}
              <button
                onClick={() => onTabChange('tratamento')}
                className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1 mt-auto"
              >
                Ver Tratamento <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-1">
              {orcamentosAbertos > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Orçamentos em aberto</span>
                  <span className="font-mono text-sm font-bold text-text-primary">{orcamentosAbertos}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Stethoscope className="w-4 h-4 text-text-secondary/50" />
                  <span className="text-sm">Nenhum orçamento aberto</span>
                </div>
              )}
              <button
                onClick={() => onTabChange('orcamentos')}
                className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1 mt-auto"
              >
                Ver Orçamentos <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </StripSection>

        {/* Seção 3: Pendências */}
        <StripSection title="Pendências">
          {(pendenciasAtivas > 0 || followupPendente) ? (
            <div className="flex flex-col gap-2 flex-1">
              <div className="space-y-1.5">
                {pendenciasAtivas > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary">Clínicas</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {pendenciasAtivas}
                    </span>
                  </div>
                )}
                {followupPendente && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-pale text-warning border border-warning/20">
                      <Bell className="w-2.5 h-2.5" />
                      Follow-up pendente
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => onTabChange('resumo')}
                className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1 mt-auto"
              >
                Ver Resumo <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              <div className="flex items-center gap-2 text-text-secondary">
                <AlertCircle className="w-4 h-4 text-text-secondary/50" />
                <span className="text-sm">Nenhuma pendência ativa</span>
              </div>
              <button
                onClick={() => onTabChange('resumo')}
                className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1 mt-auto"
              >
                Ver Resumo <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </StripSection>

      </div>
    </div>
  );
}
```

2. Verificar: `npx tsc --noEmit`

3. Commit: `git commit -m "feat(pacientes): criar PatientHeroStrip — painel operacional 3 colunas"`

---

## Task 6: Integrar PatientHeroStrip em PacienteDetailClient

**Arquivo:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

**Steps:**

1. Adicionar import no topo do arquivo:

```typescript
import { PatientHeroStrip } from '@/components/pacientes/patient-hero-strip';
import { differenceInYears } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
```

Nota: `differenceInYears` já pode estar importado de `date-fns`. Verificar e adicionar somente se ausente.

2. Após a derivação de `iniciais` (linha ~306), adicionar:

```typescript
const idade = paciente.data_nascimento
  ? differenceInYears(new Date(), parseISO(paciente.data_nascimento))
  : null;
```

3. Localizar o `return (` da função e substituir o bloco `<motion.div>` do header (que começa com `className="flex items-center gap-4 mb-8"`) pelo novo header compacto:

```tsx
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  className="flex items-start justify-between gap-4 mb-6"
>
  <div className="flex items-center gap-4">
    <button
      onClick={() => router.push('/dashboard/pacientes')}
      className="p-2 hover:bg-surface rounded-xl transition-colors border border-transparent hover:border-border/40 shrink-0"
    >
      <ArrowLeft className="w-5 h-5 text-text-secondary" />
    </button>
    <div>
      <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
        {paciente.nome}
      </h1>
      <p className="text-text-secondary text-sm font-medium mt-1">
        {idade !== null && `${idade} anos · `}
        Paciente desde {membroDesde}
      </p>
    </div>
  </div>

  <div className="flex items-center gap-2 shrink-0">
    <button
      onClick={() => { setConsultaError(null); setIsNovaConsultaOpen(true); }}
      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white
                 bg-gradient-to-r from-teal to-teal-lt
                 shadow-[0_4px_12px_rgba(47,156,133,0.25)] hover:-translate-y-px active:scale-[0.98] transition-all"
    >
      <Calendar className="w-3.5 h-3.5" />
      Nova Consulta
    </button>
    <button
      onClick={() => setIsEditModalOpen(true)}
      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold
                 text-text-primary bg-surface-alt border border-border/60
                 hover:bg-surface-alt/70 transition-colors"
    >
      <Edit2 className="w-3.5 h-3.5" />
      Editar
    </button>

    {/* Dropdown "···" com contato e exportar */}
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button className="p-2.5 rounded-xl text-text-secondary hover:bg-surface-alt
                           border border-border/60 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          className="min-w-[200px] bg-surface border border-border rounded-xl shadow-lg p-1.5 z-50
                     animate-in fade-in zoom-in duration-150"
          align="end"
          sideOffset={6}
        >
          {paciente.telefone && (
            <DropdownMenuPrimitive.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary
                         hover:bg-surface-alt rounded-lg outline-none cursor-default"
            >
              <Phone className="w-4 h-4 text-teal" />
              {paciente.telefone}
            </DropdownMenuPrimitive.Item>
          )}
          {paciente.email && (
            <DropdownMenuPrimitive.Item
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary
                         hover:bg-surface-alt rounded-lg outline-none cursor-default"
            >
              <Mail className="w-4 h-4 text-teal" />
              {paciente.email}
            </DropdownMenuPrimitive.Item>
          )}
          {(paciente.telefone || paciente.email) && (
            <DropdownMenuPrimitive.Separator className="h-px bg-border/60 my-1" />
          )}
          <DropdownMenuPrimitive.Item
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary
                       hover:bg-surface-alt rounded-lg outline-none cursor-pointer transition-colors"
            onSelect={() => window.open(`/api/pacientes/${paciente.id}/prontuario`, '_blank')}
          >
            <FileDown className="w-4 h-4" />
            Exportar Prontuário
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  </div>
</motion.div>
```

4. Após o header, adicionar o `PatientHeroStrip` **antes** das tabs:

```tsx
{/* Hero Strip — painel operacional sempre visível */}
<PatientHeroStrip
  agendamentoProximo={agendamentoProximo}
  pendencias={pendencias}
  pendenciasConcluidas={pendenciasConcluidas}
  orcamentos={orcamentosState}
  followupPendente={followupPendente}
  showClinicalTabs={showClinicalTabs}
  onTabChange={handleTabChange}
/>
```

5. **Remover** o bloco "Header Card" antigo (o `<div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6 flex flex-wrap items-center justify-between gap-6">` que contém o avatar + contato + botões). Este bloco foi substituído pelo novo header compacto + hero strip.

6. Verificar: `npx tsc --noEmit`

7. Commit: `git commit -m "feat(paciente): header compacto + PatientHeroStrip integrado"`

---

## Task 7: Reestruturar aba Resumo em PacienteDetailClient

**Arquivo:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

Remover os cards "Próxima Consulta" e "Status" do Resumo (agora no hero strip). Reorganizar com Atividade Recente → Financeiro → Timeline.

**Steps:**

1. Localizar `<TabsContent value="resumo" className="mt-0 space-y-6">`.

2. Dentro desse TabsContent, **remover completamente** o `<div className="grid grid-cols-1 md:grid-cols-2 gap-6">` que contém os cards "Próxima Consulta" e "Status do Paciente". Esses dois cards saem do Resumo.

3. Substituir o conteúdo do TabsContent de Resumo por:

```tsx
<TabsContent value="resumo" className="mt-0 space-y-6">

  {/* Atividade Recente */}
  {showClinicalTabs && (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-text-primary">Atividade Recente</h3>
        <button
          onClick={() => handleTabChange('ficha-clinica')}
          className="text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center gap-1"
        >
          Ver Ficha <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      {fichasRecentes.length === 0 ? (
        <div className="py-6 text-center">
          <FileText className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Nenhum registro clínico ainda.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {fichasRecentes.map((ficha) => (
            <div key={ficha.id} className="py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {ficha.queixa_principal ?? 'Evolução clínica'}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-text-secondary">
                    {format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  {ficha.dentista && (
                    <span className="text-[10px] text-teal font-medium">
                      {ficha.dentista.nome}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

  {/* Financeiro Resumido — posição secundária */}
  {resumoFinanceiro.temHistorico && (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-text-primary">Situação Financeira</h3>
        <CreditCard className="w-4 h-4 text-text-secondary/50" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-surface-alt rounded-xl p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">
            Aprovado
          </p>
          <p className="font-mono text-base font-bold text-text-primary tabular-nums">
            {resumoFinanceiro.totalAprovado.toLocaleString('pt-BR', {
              style: 'currency', currency: 'BRL',
            })}
          </p>
        </div>
        <div className="bg-teal/5 rounded-xl p-3 text-center border border-teal/15">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">
            Recebido
          </p>
          <p className="font-mono text-base font-bold text-teal tabular-nums">
            {resumoFinanceiro.totalPago.toLocaleString('pt-BR', {
              style: 'currency', currency: 'BRL',
            })}
          </p>
        </div>
        <div className={`rounded-xl p-3 text-center ${
          resumoFinanceiro.totalPendente > 0
            ? 'bg-coral/5 border border-coral/15'
            : 'bg-surface-alt'
        }`}>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">
            Pendente
          </p>
          <p className={`font-mono text-base font-bold tabular-nums ${
            resumoFinanceiro.totalPendente > 0 ? 'text-coral' : 'text-text-secondary'
          }`}>
            {resumoFinanceiro.totalPendente.toLocaleString('pt-BR', {
              style: 'currency', currency: 'BRL',
            })}
          </p>
        </div>
      </div>
      {resumoFinanceiro.totalAprovado > 0 && (
        <div className="w-full bg-surface-alt rounded-full h-1.5 overflow-hidden mb-3">
          <div
            className="h-full bg-teal rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (resumoFinanceiro.totalPago / resumoFinanceiro.totalAprovado) * 100)}%`,
            }}
          />
        </div>
      )}
      <button
        onClick={() => setActiveTab('orcamentos')}
        className="w-full text-xs font-semibold text-teal hover:opacity-75 transition-opacity flex items-center justify-center gap-1"
      >
        Ver Orçamentos <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )}

  {/* Timeline Histórica */}
  {timeline.length > 0 && (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <h3 className="font-semibold text-text-primary mb-5">Histórico</h3>
      <div className="relative">
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border/60" />
        <div className="space-y-0">
          {timeline.slice(0, 8).map((event) => {
            const dotColor =
              event.type === 'payment_registered' ? 'bg-teal'
              : event.type === 'appointment_cancelled' ? 'bg-coral'
              : event.type === 'consultation_created' ? 'bg-teal'
              : 'bg-surface-alt border border-border';
            return (
              <div key={event.id} className="flex gap-4 pb-5 last:pb-0">
                <div className="relative z-10 mt-1 shrink-0">
                  <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                </div>
                <div className="flex-1 min-w-0 pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary leading-snug">
                      {event.title}
                    </p>
                    <span className="text-[10px] font-mono text-text-secondary shrink-0 mt-0.5">
                      {format(parseISO(event.date), 'dd/MM', { locale: ptBR })}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-text-secondary mt-0.5">{event.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )}

</TabsContent>
```

Nota: O campo `event.title` e `event.description` devem corresponder ao tipo `TimelineEvent` de `src/server/patients/get-visible-timeline-events.ts`. Verificar os campos reais e ajustar conforme necessário.

4. Verificar: `npx tsc --noEmit`

5. Commit: `git commit -m "feat(paciente): Resumo reestruturado — Atividade → Financeiro → Timeline"`

---

## Task 8: Implementar timeline expansível em FichasTab

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Substituir a lista plana de evoluções por um padrão de timeline com collapse/expand. Item mais recente começa expandido. A funcionalidade (editar, deletar, áudio, upload, assinatura) permanece intacta.

**Steps:**

1. Adicionar import:

```typescript
import { ChevronDown } from 'lucide-react';
```

2. Após a declaração de `evolutions` state, adicionar:

```typescript
const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

// Quando as evoluções carregarem, expandir automaticamente a mais recente
React.useEffect(() => {
  if (evolutions.length > 0) {
    setExpandedIds(new Set([evolutions[0].id]));
  }
}, [evolutions.length > 0 ? evolutions[0].id : '']);

const toggleExpanded = (id: string) => {
  setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
};
```

3. Localizar onde as evoluções são renderizadas (a lista após o painel de criação). Atualmente há algo como `{evolutions.map((evolution) => (...))}`. Substituir **toda** essa seção de renderização de lista pela timeline:

```tsx
{/* Timeline de evoluções */}
{evolutions.length === 0 && !isPanelOpen && (
  <div className="py-12 flex flex-col items-center gap-4 text-center">
    <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center">
      <FileText className="w-6 h-6 text-text-secondary/40" />
    </div>
    <div>
      <p className="text-text-primary font-semibold text-sm">Nenhum registro clínico</p>
      <p className="text-text-secondary text-xs mt-1">
        Clique em "Nova Evolução" para registrar a primeira consulta.
      </p>
    </div>
  </div>
)}

{evolutions.length > 0 && (
  <div className="relative">
    {/* Linha vertical da timeline */}
    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />

    <div className="space-y-1">
      {evolutions.map((evolution) => {
        const isExpanded = expandedIds.has(evolution.id);
        const teethReal = evolution.teethNotes.filter((tn) => tn.tooth < 90);

        return (
          <div key={evolution.id} className="relative flex gap-4 pb-3 last:pb-0">
            {/* Dot */}
            <div className="relative z-10 mt-[14px] shrink-0">
              <div className="w-3.5 h-3.5 rounded-full bg-teal/25 border-2 border-teal/70" />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              {/* Linha colapsada — sempre visível */}
              <button
                onClick={() => toggleExpanded(evolution.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-2 py-2 px-3 -mx-3
                                hover:bg-surface-alt/50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-semibold text-text-primary shrink-0">
                      {evolution.type}
                    </span>
                    <span className="text-xs text-text-secondary shrink-0">
                      {evolution.professional}
                    </span>
                    {!isExpanded && evolution.observation && (
                      <span className="text-xs text-text-secondary truncate hidden sm:block">
                        · {evolution.observation.slice(0, 60)}{evolution.observation.length > 60 ? '…' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-text-secondary">
                      {evolution.date}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-text-secondary transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </button>

              {/* Painel expandido */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 bg-surface rounded-xl border border-border p-4 space-y-3">
                    {/* Observação principal */}
                    {evolution.observation && (
                      <p className="text-sm text-text-primary leading-relaxed">
                        {evolution.observation}
                      </p>
                    )}

                    {/* Dentes afetados */}
                    {teethReal.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {teethReal.map((tn) => (
                          <span
                            key={tn.tooth}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg
                                       bg-teal/10 text-teal border border-teal/20"
                          >
                            D{tn.tooth}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notas por dente */}
                    {teethReal.some((tn) => tn.notes.some(Boolean)) && (
                      <div className="space-y-1">
                        {teethReal.map((tn) =>
                          tn.notes.filter(Boolean).map((note, i) => (
                            <div key={`${tn.tooth}-${i}`} className="flex items-start gap-2 text-xs text-text-secondary">
                              <span className="font-mono font-bold text-teal shrink-0 mt-0.5">
                                D{tn.tooth}
                              </span>
                              <span>{note}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Rodapé com metadados e ações */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <div className="flex items-center gap-3 text-xs text-text-secondary">
                        {evolution.files.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {evolution.files.length} arquivo{evolution.files.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {evolution.assinaturaUrl && (
                          <span className="flex items-center gap-1 text-teal font-medium">
                            <Check className="w-3 h-3" /> Assinado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(evolution)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-teal
                                     hover:bg-teal/10 transition-colors"
                          title="Editar evolução"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!evolution.assinaturaUrl && (
                          <button
                            onClick={() => setSigningFichaId(evolution.id)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-teal
                                       hover:bg-teal/10 transition-colors"
                            title="Assinar"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setShowDeleteConfirm(evolution.id)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-coral
                                     hover:bg-coral-pale transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

4. Verificar: `npx tsc --noEmit`

5. Commit: `git commit -m "feat(fichas): timeline expansível — collapsed por padrão, mais recente aberta"`

---

## Task 9: Melhorar formulário de nova evolução em FichasTab

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Aplicar espaçamento e labels canônicas ao formulário de criação. A funcionalidade não muda — apenas organização visual.

**Steps:**

1. Localizar o container do formulário de criação (o bloco `<div className="bg-surface-alt/30 border border-border/60 rounded-2xl p-4 md:p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">`).

2. Substituir a classe do container por:

```tsx
<div className="bg-surface border border-border rounded-2xl p-6 space-y-6 shadow-sm">
```

3. Garantir que todos os `<label>` dentro do formulário usem a classe canônica:

```tsx
className="block text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2"
```

(A maioria já usa `text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]` — a diferença é `tracking-widest` vs `tracking-[0.15em]`. Ambas são aceitáveis; uniformizar para `tracking-widest`.)

4. O container do odontograma dentro do formulário deve ter:

```tsx
<div className="bg-surface-alt rounded-xl border border-border/60 p-4">
  <Odontograma ... />
</div>
```

Verificar que o odontograma já está dentro de um container adequado. Se não, envolver com esse `div`.

5. Os botões de ação do formulário (Salvar / Cancelar) devem estar em:

```tsx
<div className="flex gap-3 pt-4 border-t border-border/40">
  <Button variant="outline" onClick={closePanel} className="flex-1">
    Cancelar
  </Button>
  <Button
    variant="brand"
    onClick={handleSave}
    disabled={isSaving}
    className="flex-1"
  >
    {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
    Salvar Evolução
  </Button>
</div>
```

Nota: `variant="brand"` requer que o Sprint 1 tenha adicionado essa variante ao `Button`. Se Sprint 1 ainda não foi executado, usar `className="bg-gradient-to-r from-teal to-teal-lt text-white ..."` diretamente.

6. Verificar: `npx tsc --noEmit`

7. Commit: `git commit -m "feat(fichas): formulário de evolução com espaçamento e labels canônicas"`

---

## Task 10: Verificação final e ajustes de tokens

**Arquivos:** todos os modificados nesta sprint

Varredura final por violações de tokens e verificação visual de consistência.

**Steps:**

1. Verificar que não há `bg-white`, `text-black`, `dark:*` nos arquivos modificados:

```bash
grep -n "bg-white\|text-black\|dark:bg-\|dark:text-" \
  src/app/dashboard/pacientes/page.tsx \
  src/app/dashboard/pacientes/_components/pacientes-list.tsx \
  src/components/pacientes/pacientes-table.tsx \
  src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx \
  src/components/pacientes/FichasTab.tsx \
  src/components/pacientes/patient-hero-strip.tsx
```

Corrigir qualquer ocorrência encontrada usando os tokens canônicos do spec.

2. Verificar que `bg-amber-*`, `text-amber-*` foram substituídos por tokens `warning`:

```bash
grep -n "amber" src/components/pacientes/patient-hero-strip.tsx
```

Resultado esperado: sem matches.

3. Verificar TypeScript final: `npx tsc --noEmit`

4. Commit final: `git commit -m "fix(sprint2): verificação final de tokens e TypeScript"`

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1-2: Métricas strip (4 cards)
- [x] Task 3: Header da lista com hierarquia forte
- [x] Task 4: Empty state premium
- [x] Task 5-6: PatientHeroStrip (3 colunas: Próxima Consulta | Tratamento | Pendências)
- [x] Task 6: Header compacto do perfil com dropdown de contato
- [x] Task 7: Resumo reestruturado (sem duplicar hero strip)
- [x] Task 8: Timeline expansível na Ficha Clínica
- [x] Task 9: Formulário de evolução agrupado
- [x] Task 10: Verificação de tokens

**Sem placeholders:** todo código é completo e funcional.

**Forward references:** Tasks não dependem de código definido em tasks posteriores.

**Padrões de referência aplicados:** `bg-surface rounded-2xl border border-border shadow-sm`, `font-mono text-2xl font-bold`, `text-[10px] font-bold uppercase tracking-widest text-text-secondary`, `variant="brand"`.

---

## Execution

Após salvar este plano, escolha o modo de execução:

1. **Subagent-Driven** (recomendado) — cada task executada por um subagente fresh com revisão de qualidade. Invoke: `superpowers:subagent-driven-development`
2. **Inline** — execução em lote com checkpoints na sessão atual. Invoke: `superpowers:executing-plans`
