# Plano: PlanejamentoTab — Mescla B+C

## Goal
Enriquecer a aba de Planejamento do paciente com:
1. Header de progresso do tratamento (barra + stats)
2. Seção colapsável de procedimentos da ficha com status individual + botão Agendar
3. Status badge + data estimada nas seções de apresentação existentes
4. Label do image picker mais claro ("Buscar da aba Documentos")

A apresentação em slides e o PDF continuam sem alteração.

## Architecture Overview
- Dois novos recursos de DB: tabela `planejamento_procedimentos` + colunas `status`/`data_estimada` em `planejamento_secoes`
- `PlanejamentoTab.tsx` é o único arquivo de componente alterado
- Procedimentos são sincronizados 1x com a tabela: ao carregar, busca fichas do paciente → insere procedimentos ainda não salvos → mostra com status persistido
- Status de seção e data estimada salvam via o mesmo mecanismo de upsert/debounce já existente

## Tech Stack
- Next.js 16 App Router, TypeScript strict (sem `any`)
- Supabase client-side (`createClient` de `@/lib/supabase/client`)
- Framer Motion (motion/react) — animações existentes mantidas
- Tailwind CSS v4 + design system da DentIA

## Files

### Modified
- `src/components/pacientes/PlanejamentoTab.tsx`

### Created
- `supabase/migrations/20260503000001_048_planejamento_procedimentos.sql`
- `supabase/migrations/20260503000002_049_planejamento_secoes_status.sql`

---

## Task 1 — Migrations: tabela planejamento_procedimentos + colunas em planejamento_secoes

**Files:**
- `supabase/migrations/20260503000001_048_planejamento_procedimentos.sql` (criar)
- `supabase/migrations/20260503000002_049_planejamento_secoes_status.sql` (criar)

**Steps:**

1. Criar arquivo `supabase/migrations/20260503000001_048_planejamento_procedimentos.sql`:

```sql
-- 048: tabela de procedimentos do planejamento (sincronizados das fichas)
create table if not exists planejamento_procedimentos (
  id           uuid        primary key default gen_random_uuid(),
  clinica_id   uuid        not null references clinicas(id)  on delete cascade,
  paciente_id  uuid        not null references pacientes(id) on delete cascade,
  descricao    text        not null,
  dente        integer,
  status       text        not null default 'pendente'
                           check (status in ('pendente', 'agendado', 'concluido')),
  ficha_ref    text,       -- formato fichaId::dente, apenas referência, sem FK
  ordem        integer     not null default 0,
  created_at   timestamptz not null default now()
);

alter table planejamento_procedimentos enable row level security;

create policy "clinica_isolamento_pp" on planejamento_procedimentos
  for all using (
    clinica_id = (select clinica_id from dentistas where id = auth.uid())
  );

create index idx_pp_paciente on planejamento_procedimentos(paciente_id);
create index idx_pp_clinica  on planejamento_procedimentos(clinica_id);
```

2. Criar arquivo `supabase/migrations/20260503000002_049_planejamento_secoes_status.sql`:

```sql
-- 049: adiciona status e data estimada em planejamento_secoes
alter table planejamento_secoes
  add column if not exists status        text default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido')),
  add column if not exists data_estimada date;
```

3. Verificação: `npm run typecheck` → 0 erros (migrações não afetam tipos TS ainda)

---

## Task 2 — Tipos, estado e imports novos em PlanejamentoTab.tsx

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Atualizar a interface `Section` para incluir os novos campos:

```typescript
// Substituir a interface Section existente por:
interface Section {
  id: string;
  title: string;
  content: string;
  imageIds: string[];
  status: 'pendente' | 'em_andamento' | 'concluido';
  dataEstimada: string | null;
}
```

2. Adicionar nova interface `PlanProc` logo após `Section`:

```typescript
interface PlanProc {
  id: string;
  descricao: string;
  dente: number | null;
  status: 'pendente' | 'agendado' | 'concluido';
  fichaRef: string | null;
  ordem: number;
}
```

3. Adicionar imports necessários no topo do arquivo. A linha de import do lucide-react deve ficar:

```typescript
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Calendar,
  Download,
  Sparkles,
  Loader2,
  Save,
  Presentation,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Circle,
} from 'lucide-react';
```

4. Adicionar import do useRouter logo após os imports existentes de react:

```typescript
import { useRouter } from 'next/navigation';
```

5. Dentro da função `PlanejamentoTab`, adicionar `useRouter` e os novos estados após a declaração dos estados existentes (após `const [slideDirection, setSlideDirection] = useState(1);`):

```typescript
const router = useRouter();

// Procedimentos da ficha sincronizados
const [planProcs, setPlanProcs]           = useState<PlanProc[]>([]);
const [procsExpanded, setProcsExpanded]   = useState(true);
const [updatingProcId, setUpdatingProcId] = useState<string | null>(null);
```

6. Verificação: `npm run typecheck` → espera erros temporários em `fetchData` e `saveSectionToDb` pois ainda não foram atualizados (próximas tasks). Se o único erro for nesses dois lugares, está correto.

---

## Task 3 — Atualizar fetchData: fichas + sync planProcs + mapear status das seções

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Substituir a função `fetchData` completa pela versão abaixo. Ela adiciona: busca de fichas para extrair procedimentos pendentes, sincronização com `planejamento_procedimentos`, e mapeamento dos novos campos de `planejamento_secoes`:

```typescript
const fetchData = useCallback(async () => {
  setLoadingData(true);
  try {
    const supabase = createClient();

    type FichaRow = {
      id: string;
      dentes_observacoes: Record<string, string> | null;
    };

    const [docsResult, budgetResult, secoesResult, fichasResult, existingProcsResult] =
      await Promise.all([
        supabase
          .from('paciente_documentos')
          .select('*')
          .eq('paciente_id', patientId)
          .in('categoria', ['Radiografias', 'Fotografias']),
        supabase
          .from('orcamentos')
          .select('*, orcamento_itens(*)')
          .eq('paciente_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('planejamento_secoes')
          .select('*')
          .eq('paciente_id', patientId)
          .order('ordem', { ascending: true }),
        supabase
          .from('fichas')
          .select('id, dentes_observacoes')
          .eq('paciente_id', patientId)
          .not('dentes_observacoes', 'is', null),
        supabase
          .from('planejamento_procedimentos')
          .select('*')
          .eq('paciente_id', patientId)
          .order('ordem', { ascending: true }),
      ]);

    if (docsResult.error) throw docsResult.error;
    setDocuments(
      (docsResult.data ?? []).map((doc: Record<string, unknown>) => ({
        id: doc.id as string,
        name: doc.nome as string,
        category: doc.categoria as string,
        url: doc.url as string,
        thumbnail: (doc.thumbnail as string | undefined) ?? (doc.url as string),
      }))
    );

    if (budgetResult.error) throw budgetResult.error;
    if (budgetResult.data) {
      setBudgetExists(true);
      setBudgetProcedures(
        (budgetResult.data.orcamento_itens as Array<Record<string, unknown>> ?? []).map(p => ({
          id: p.id as string,
          name: p.descricao as string,
          value: p.preco_total as number,
        }))
      );
    } else {
      setBudgetExists(false);
      setBudgetProcedures([]);
    }

    if (secoesResult.error) throw secoesResult.error;
    if (secoesResult.data && secoesResult.data.length > 0) {
      setSections(
        (secoesResult.data as Array<Record<string, unknown>>).map(row => ({
          id: row.id as string,
          title: row.titulo as string,
          content: (row.conteudo as string) ?? '',
          imageIds: (row.imagem_ids as string[]) ?? [],
          status: ((row.status as string) ?? 'pendente') as Section['status'],
          dataEstimada: (row.data_estimada as string | null) ?? null,
        }))
      );
    }

    // ── Sincroniza procedimentos das fichas ──────────────────────────────
    const rawProcs: { fichaRef: string; descricao: string; dente: number }[] = [];
    for (const ficha of (fichasResult.data ?? []) as FichaRow[]) {
      const obs = ficha.dentes_observacoes ?? {};
      for (const [dente, desc] of Object.entries(obs)) {
        if (typeof desc === 'string' && desc.trim()) {
          rawProcs.push({
            fichaRef: `${ficha.id}::${dente}`,
            descricao: desc.trim(),
            dente: parseInt(dente, 10),
          });
        }
      }
    }

    const existingRefs = new Set(
      (existingProcsResult.data ?? []).map((p: Record<string, unknown>) => p.ficha_ref as string)
    );
    const toInsert = rawProcs.filter(p => !existingRefs.has(p.fichaRef));

    const mapPlanProc = (row: Record<string, unknown>): PlanProc => ({
      id: row.id as string,
      descricao: row.descricao as string,
      dente: row.dente as number | null,
      status: (row.status as PlanProc['status']) ?? 'pendente',
      fichaRef: row.ficha_ref as string | null,
      ordem: row.ordem as number,
    });

    if (toInsert.length > 0) {
      const startOrdem = (existingProcsResult.data ?? []).length;
      await supabase.from('planejamento_procedimentos').insert(
        toInsert.map((p, i) => ({
          clinica_id: clinicaId,
          paciente_id: patientId,
          descricao: p.descricao,
          dente: p.dente,
          status: 'pendente',
          ficha_ref: p.fichaRef,
          ordem: startOrdem + i,
        }))
      );
      const { data: refreshed } = await supabase
        .from('planejamento_procedimentos')
        .select('*')
        .eq('paciente_id', patientId)
        .order('ordem', { ascending: true });
      setPlanProcs((refreshed ?? []).map(r => mapPlanProc(r as Record<string, unknown>)));
    } else {
      setPlanProcs(
        (existingProcsResult.data ?? []).map(r => mapPlanProc(r as Record<string, unknown>))
      );
    }
  } catch (error) {
    console.error('Erro ao buscar dados de planejamento:', JSON.stringify(error), error);
  } finally {
    setLoadingData(false);
  }
}, [patientId, clinicaId]);
```

2. Atualizar a função `saveSectionToDb` para incluir `status` e `data_estimada`. Substituir o bloco de `upsert` (dentro do `if (isUUID(section.id))`) por:

```typescript
await supabase.from('planejamento_secoes').upsert({
  id: section.id,
  clinica_id: clinicaId,
  paciente_id: patientId,
  titulo: section.title,
  conteudo: section.content,
  imagem_ids: section.imageIds,
  ordem: idx,
  status: section.status,
  data_estimada: section.dataEstimada ?? null,
  updated_at: new Date().toISOString(),
});
```

3. Atualizar a função `addSection` para incluir os novos campos no insert e no objeto local. Substituir a chamada de insert e o `newSection` por:

```typescript
const { data, error } = await supabase
  .from('planejamento_secoes')
  .insert({
    clinica_id: clinicaId,
    paciente_id: patientId,
    titulo: '',
    conteudo: '',
    imagem_ids: [],
    ordem: newOrder,
    status: 'pendente',
    data_estimada: null,
  })
  .select('id')
  .single();

if (error ?? !data) {
  console.error('Erro ao criar seção:', error);
  return;
}

const newSection: Section = {
  id: (data as Record<string, unknown>).id as string,
  title: '',
  content: '',
  imageIds: [],
  status: 'pendente',
  dataEstimada: null,
};
setSections(prev => [...prev, newSection]);
```

4. Adicionar a função `updateProcStatus` logo após `toggleImageSelection`:

```typescript
const updateProcStatus = async (procId: string, newStatus: PlanProc['status']): Promise<void> => {
  setUpdatingProcId(procId);
  setPlanProcs(prev => prev.map(p => p.id === procId ? { ...p, status: newStatus } : p));
  const supabase = createClient();
  await supabase
    .from('planejamento_procedimentos')
    .update({ status: newStatus })
    .eq('id', procId);
  setUpdatingProcId(null);
};
```

5. Verificação: `npm run typecheck` → 0 erros.

---

## Task 4 — Header de progresso (substituir header atual)

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Adicionar cálculos de progresso logo antes do `return` (após a declaração de `totalBudget`):

```typescript
const totalBudget = budgetProcedures.reduce((acc, curr) => acc + curr.value, 0);
const concluidosCount = planProcs.filter(p => p.status === 'concluido').length;
const progressPercent = planProcs.length > 0
  ? Math.round((concluidosCount / planProcs.length) * 100)
  : 0;
const totalSlides = sections.length + 1;
```

2. Substituir o bloco `{/* Cabeçalho da Apresentação */}` inteiro (o `<div className="bg-surface rounded-3xl...">` que vai até o `</div>` do botão Gerar PDF) pelo seguinte:

```tsx
{/* Cabeçalho — Progresso + Ações */}
<div className="bg-surface rounded-3xl border border-border/60 shadow-sm p-8">
  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
    <div className="flex-1">
      <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-2">
        Apresentação ao Paciente
      </div>
      <input
        type="text"
        value={planningTitle}
        onChange={(e) => setPlanningTitle(e.target.value)}
        className="font-heading text-3xl text-text-primary bg-transparent border-none outline-none w-full focus:ring-0 p-0"
        placeholder="Título do Planejamento"
      />

      {/* Barra de progresso */}
      {planProcs.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary">
              Progresso do tratamento
            </span>
            <span className="font-mono text-xs font-bold text-teal">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-surface-alt rounded-full h-2">
            <div
              className="bg-teal h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-lg font-bold text-text-primary">
                {planProcs.length}
              </span>
              <span className="text-xs text-text-secondary">procedimentos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-lg font-bold text-teal">
                {concluidosCount}
              </span>
              <span className="text-xs text-text-secondary">concluídos</span>
            </div>
            {budgetExists && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-lg font-bold text-text-primary">
                  R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-text-secondary">orçamento</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center gap-3 flex-shrink-0">
      <button
        onClick={() => { setCurrentSlide(0); setIsPresentationOpen(true); }}
        disabled={sections.length === 0}
        className="bg-teal/10 text-teal px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-teal/20 transition-all border border-teal/20 disabled:opacity-50"
      >
        <Presentation className="w-4 h-4" />
        Apresentar
      </button>
      <button
        onClick={handleGerarPDF}
        className="bg-text-primary text-bg px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:opacity-80 transition-all shadow-md"
      >
        <Download className="w-4 h-4" /> Gerar PDF
      </button>
    </div>
  </div>
</div>
```

3. Verificação: `npm run typecheck` → 0 erros.

---

## Task 5 — Seção colapsável de procedimentos da ficha

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Adicionar helpers de cor de status de procedimento logo antes do `return`:

```typescript
const getProcStatusLabel = (status: PlanProc['status']): string => {
  if (status === 'agendado')  return 'Agendado';
  if (status === 'concluido') return 'Concluído';
  return 'Pendente';
};

const getProcStatusNext = (status: PlanProc['status']): PlanProc['status'] => {
  if (status === 'pendente')  return 'agendado';
  if (status === 'agendado')  return 'concluido';
  return 'pendente';
};

const getProcStatusColor = (status: PlanProc['status']): string => {
  if (status === 'concluido') return 'bg-teal/10 text-teal border-teal/20';
  if (status === 'agendado')  return 'bg-teal/5 text-teal-lt border-teal/10';
  return 'bg-surface-alt text-text-secondary border-border/60';
};
```

2. Inserir o bloco de seção de procedimentos logo após o bloco `{/* Cabeçalho */}` e antes do bloco `{/* Seções */}`. O bloco inteiro é:

```tsx
{/* Seção de Procedimentos da Ficha */}
{planProcs.length > 0 && (
  <div className="bg-surface rounded-3xl border border-border/60 shadow-sm overflow-hidden">
    {/* Cabeçalho colapsável */}
    <button
      onClick={() => setProcsExpanded(prev => !prev)}
      className="w-full p-6 flex items-center justify-between hover:bg-surface-alt/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
          Procedimentos da Ficha
        </div>
        <span className="px-2 py-0.5 rounded-full bg-teal/10 text-teal text-[10px] font-bold">
          {planProcs.length}
        </span>
      </div>
      {procsExpanded
        ? <ChevronUp className="w-4 h-4 text-text-secondary" />
        : <ChevronDown className="w-4 h-4 text-text-secondary" />
      }
    </button>

    <AnimatePresence initial={false}>
      {procsExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planProcs.map(proc => (
              <div
                key={proc.id}
                className="bg-surface-alt/50 border border-border/60 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {proc.dente && (
                      <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-0.5">
                        Dente {proc.dente}
                      </div>
                    )}
                    <p className="text-sm font-medium text-text-primary leading-snug">
                      {proc.descricao}
                    </p>
                  </div>
                  {updatingProcId === proc.id && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  {/* Botão de status — clica para avançar */}
                  <button
                    onClick={() => void updateProcStatus(proc.id, getProcStatusNext(proc.status))}
                    disabled={updatingProcId === proc.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${getProcStatusColor(proc.status)}`}
                  >
                    {proc.status === 'concluido' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : proc.status === 'agendado' ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    {getProcStatusLabel(proc.status)}
                  </button>

                  {/* Botão Agendar — só quando pendente ou agendado */}
                  {proc.status !== 'concluido' && (
                    <button
                      onClick={() => router.push('/dashboard/agendamentos')}
                      className="ml-auto p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors border border-transparent hover:border-teal/20"
                      title="Ir para agendamentos"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```

3. Verificação: `npm run typecheck` → 0 erros.

---

## Task 6 — Status badge + data estimada nas seções de apresentação

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Adicionar helpers de cor/label para status de seção logo antes do `return` (junto com os helpers de proc já adicionados):

```typescript
const getSectionStatusLabel = (status: Section['status']): string => {
  if (status === 'em_andamento') return 'Em Andamento';
  if (status === 'concluido')    return 'Concluído';
  return 'Pendente';
};

const getSectionStatusColor = (status: Section['status']): string => {
  if (status === 'concluido')    return 'bg-teal/10 text-teal border-teal/20';
  if (status === 'em_andamento') return 'bg-teal/5 text-teal-lt border-teal/10';
  return 'bg-surface-alt text-text-secondary border-border/60';
};
```

2. Dentro do cabeçalho de cada seção (o `<div className="p-6 border-b ...">` que contém título e botões de salvar/excluir), adicionar o badge de status e o campo de data logo após o `</input>` do título. O bloco a ser substituído é o `<div className="flex items-center gap-3">` do cabeçalho da seção:

```tsx
<div className="p-6 border-b border-border/40 flex items-center justify-between bg-surface-alt/30">
  <div className="flex items-center gap-3 flex-1 min-w-0">
    <div className="w-8 h-8 rounded-full bg-text-primary text-bg flex items-center justify-center font-mono text-xs font-bold shrink-0">
      {String(index + 1).padStart(2, '0')}
    </div>
    <div className="flex-1 min-w-0 space-y-1">
      <input
        type="text"
        value={section.title}
        onChange={(e) => updateSection(section.id, 'title', e.target.value)}
        placeholder="Título da Seção (ex: Situação Atual)"
        className="font-heading text-xl text-text-primary bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status selector */}
        <select
          value={section.status}
          onChange={(e) => updateSection(section.id, 'status', e.target.value as Section['status'])}
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border cursor-pointer outline-none transition-all ${getSectionStatusColor(section.status)}`}
          style={{ appearance: 'none' }}
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em Andamento</option>
          <option value="concluido">Concluído</option>
        </select>

        {/* Data estimada */}
        <input
          type="date"
          value={section.dataEstimada ?? ''}
          onChange={(e) => updateSection(section.id, 'dataEstimada', e.target.value || '')}
          className="text-[11px] text-text-secondary bg-transparent border border-border/60 rounded-lg px-2 py-1 focus:ring-0 focus:border-teal transition-colors outline-none"
          title="Data estimada para esta etapa"
        />
      </div>
    </div>
  </div>
  <div className="flex items-center gap-1 shrink-0 ml-2">
    {savingIds.has(section.id) ? (
      <div className="p-2 text-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    ) : (
      <button
        onClick={() => void saveSectionToDb(section.id)}
        className="p-2 text-text-secondary hover:text-teal transition-colors opacity-0 group-hover:opacity-100"
        title="Salvar seção"
      >
        <Save className="w-4 h-4" />
      </button>
    )}
    <button
      onClick={() => void removeSection(section.id)}
      className="p-2 text-text-secondary hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
</div>
```

3. O `updateSection` recebe `keyof Section` — como `status` e `dataEstimada` são parte da interface atualizada, funciona sem mudança.

4. Verificação: `npm run typecheck` → 0 erros.

---

## Task 7 — Image picker: label mais claro + typecheck final

**Files:** `src/components/pacientes/PlanejamentoTab.tsx`

**Steps:**

1. Localizar o botão "Selecionar do Histórico" dentro da seção de imagens de cada seção e substituir o texto:

```tsx
// DE:
<button
  onClick={() => setIsImagePickerOpen(section.id)}
  className="text-teal text-xs font-bold flex items-center gap-1 hover:text-teal-dark transition-colors"
>
  <Plus className="w-3 h-3" /> Selecionar do Histórico
</button>

// PARA:
<button
  onClick={() => setIsImagePickerOpen(section.id)}
  className="text-teal text-xs font-bold flex items-center gap-1 hover:text-teal-dark transition-colors"
>
  <Plus className="w-3 h-3" /> Buscar da aba Documentos
  {documents.length > 0 && (
    <span className="ml-1 text-text-secondary font-normal">({documents.length})</span>
  )}
</button>
```

2. No modal de seleção de imagens, atualizar o título de "Selecionar Imagens do Histórico" para "Documentos do Paciente":

```tsx
// DE:
<h3 className="font-heading text-xl text-text-primary">Selecionar Imagens do Histórico</h3>

// PARA:
<h3 className="font-heading text-xl text-text-primary">
  Documentos do Paciente
  {documents.length === 0 && (
    <span className="text-sm font-normal text-text-secondary ml-2">— nenhum documento encontrado</span>
  )}
</h3>
```

3. Adicionar mensagem de estado vazio quando não há documentos:

```tsx
// Dentro do <div className="flex-1 overflow-y-auto p-6">, antes do grid, adicionar:
{documents.length === 0 && (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <ImageIcon className="w-10 h-10 text-text-secondary/40 mb-3" />
    <p className="text-sm font-medium text-text-secondary">Nenhum documento encontrado</p>
    <p className="text-xs text-text-secondary/60 mt-1 max-w-xs">
      Adicione fotos ou radiografias na aba Documentos do paciente.
    </p>
  </div>
)}
```

4. Verificação final: `npm run typecheck && npm run lint` → typecheck: 0 erros; lint: nenhum novo erro nos arquivos alterados.
