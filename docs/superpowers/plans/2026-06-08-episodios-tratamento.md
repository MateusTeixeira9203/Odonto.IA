# Plano de Implementação — Episódios de Tratamento + Cards Clicáveis + Sync Ficha

**Spec:** `docs/superpowers/specs/2026-06-08-episodios-tratamento-design.md`  
**Data:** 2026-06-08  
**Stack:** Next.js App Router · TypeScript estrito · Supabase · Tailwind v4 · Framer Motion

---

## Arquitetura

O perfil do paciente (`/dashboard/pacientes/[id]`) tem três camadas:
- **Server Component** (`page.tsx`) → busca dados SSR via `getPatientWorkspaceData`
- **Client Component** (`paciente-detail-client.tsx`) → gerencia estado global do perfil (tabs, modais, hero strip)
- **Tab Components** (`FichasTab.tsx`, `PlanejamentoTab.tsx`) → carregados dinamicamente, buscam seus dados independentemente via Supabase client

As mudanças desta feature tocam todas as três camadas.

---

## Mapa de Arquivos

### Criados (novos)
- `src/app/dashboard/pacientes/[id]/tratamento-actions.ts` — server actions para CRUD de tratamentos

### Modificados
- `src/components/pacientes/FichasTab.tsx` — major: episódios, modal, histórico, remove toggle
- `src/components/pacientes/PlanejamentoTab.tsx` — medium: sync ficha ao marcar concluído
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` — small: cards clicáveis

### Banco de Dados (manual no Supabase)
- Nova tabela `tratamentos`
- Coluna `tratamento_id` em `fichas`

---

## Task 1: Migration Supabase

**Arquivo:** Supabase Dashboard → SQL Editor (manual)

Esta task não tem testes automatizados — é uma migration de banco. Execute o SQL abaixo no SQL Editor do projeto Supabase e confirme que as tabelas existem.

**SQL a executar:**

```sql
-- 1. Tabela tratamentos
CREATE TABLE IF NOT EXISTS public.tratamentos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinica_id   uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nome         text,
  status       text NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'concluido')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz
);

-- 2. RLS
ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinica_isolamento" ON public.tratamentos
  FOR ALL
  USING (
    clinica_id IN (
      SELECT clinica_id FROM public.dentistas WHERE id = auth.uid()
    )
  );

-- 3. FK em fichas
ALTER TABLE public.fichas
  ADD COLUMN IF NOT EXISTS tratamento_id uuid
  REFERENCES public.tratamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fichas_tratamento_id
  ON public.fichas(tratamento_id);
```

**Verificação:**
```sql
-- Deve retornar a estrutura da tabela
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tratamentos' ORDER BY ordinal_position;

-- Deve mostrar a coluna tratamento_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'fichas' AND column_name = 'tratamento_id';
```

**Commit:** `git commit -m "Task 1: migration tratamentos + fichas.tratamento_id (manual Supabase)"`

---

## Task 2: Server Actions — CRUD de Tratamentos

**Arquivo:** `src/app/dashboard/pacientes/[id]/tratamento-actions.ts` (criar novo)

Crie o arquivo com exatamente este conteúdo:

```typescript
"use server";

import { requireClinicContext } from "@/server/auth/clinic";
import { revalidatePath } from "next/cache";

export type Tratamento = {
  id: string;
  nome: string | null;
  status: "ativo" | "concluido";
  created_at: string;
  encerrado_em: string | null;
};

/** Busca o tratamento ativo do paciente (no máximo um). */
export async function buscarTratamentoAtivo(
  pacienteId: string
): Promise<{ tratamento: Tratamento | null; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) return { tratamento: null, error: error.message };
  return { tratamento: (data as Tratamento | null) };
}

/** Busca todos os tratamentos concluídos do paciente (histórico). */
export async function buscarHistoricoTratamentos(
  pacienteId: string
): Promise<{ tratamentos: Tratamento[]; error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data, error } = await supabase
    .from("tratamentos")
    .select("id, nome, status, created_at, encerrado_em")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "concluido")
    .order("encerrado_em", { ascending: false });

  if (error) return { tratamentos: [], error: error.message };
  return { tratamentos: (data as Tratamento[]) ?? [] };
}

/**
 * Cria um novo tratamento ativo e vincula as fichas selecionadas.
 * Pré-condição: não deve existir tratamento ativo para este paciente.
 */
export async function criarTratamento(
  pacienteId: string,
  nome: string | null,
  fichaIds: string[]
): Promise<{ id?: string; error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para criar tratamentos" };

  // Garante que não existe tratamento ativo
  const { data: existente } = await supabase
    .from("tratamentos")
    .select("id")
    .eq("clinica_id", clinicId)
    .eq("paciente_id", pacienteId)
    .eq("status", "ativo")
    .maybeSingle();

  if (existente) return { error: "Já existe um tratamento ativo para este paciente" };

  // Cria o tratamento
  const { data: novo, error: errInsert } = await supabase
    .from("tratamentos")
    .insert({
      clinica_id: clinicId,
      paciente_id: pacienteId,
      nome: nome?.trim() || null,
      status: "ativo",
    })
    .select("id")
    .single();

  if (errInsert || !novo) return { error: errInsert?.message ?? "Erro ao criar tratamento" };

  // Vincula fichas selecionadas
  if (fichaIds.length > 0) {
    await supabase
      .from("fichas")
      .update({ tratamento_id: (novo as { id: string }).id })
      .in("id", fichaIds)
      .eq("clinica_id", clinicId);
  }

  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return { id: (novo as { id: string }).id };
}

/** Adiciona fichas avulsas a um tratamento ativo existente. */
export async function vincularFichasAoTratamento(
  tratamentoId: string,
  fichaIds: string[],
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão" };
  if (fichaIds.length === 0) return {};

  const { error } = await supabase
    .from("fichas")
    .update({ tratamento_id: tratamentoId })
    .in("id", fichaIds)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}

/** Encerra o tratamento ativo. */
export async function encerrarTratamento(
  tratamentoId: string,
  pacienteId: string
): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();

  if (role === "secretaria") return { error: "Sem permissão para encerrar tratamentos" };

  const { error } = await supabase
    .from("tratamentos")
    .update({
      status: "concluido",
      encerrado_em: new Date().toISOString(),
    })
    .eq("id", tratamentoId)
    .eq("clinica_id", clinicId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pacientes/${pacienteId}`);
  return {};
}
```

**Verificação TypeScript:**
```bash
cd "C:/Users/mateu/OneDrive/Área de Trabalho/DentIA"
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```
Esperado: zero erros no `src/`.

**Commit:** `git commit -m "Task 2: server actions CRUD tratamentos"`

---

## Task 3: Cards Clicáveis — Hero Strip

**Arquivo:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

Esta task tem três sub-mudanças cirúrgicas no Hero Strip (linhas ~935–1125).

### 3a — Card Próxima Consulta clicável

Localize a div do Col 1 (linha ~938):
```tsx
<div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-border/50 hover:bg-surface-alt/30 transition-colors group">
```

Substitua por:
```tsx
<div
  className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-border/50 hover:bg-surface-alt/30 transition-colors group cursor-pointer"
  onClick={() => handleTabChange('agenda')}
  role="button"
  tabIndex={0}
  onKeyDown={e => e.key === 'Enter' && handleTabChange('agenda')}
>
```

Nos botões internos (Iniciar Consulta e Agendar agora), adicione `e.stopPropagation()`:
```tsx
// Botão "Iniciar Consulta" (linha ~968)
onClick={() => { e.stopPropagation(); router.push(`/consulta/${agendamentoProximo.id}`); }}

// Botão "Agendar agora" (linha ~979)
onClick={(e) => { e.stopPropagation(); setConsultaError(null); setIsNovaConsultaOpen(true); }}
```

### 3b — Card Tratamento clicável + ChevronRight

Localize a div do Col 2 (linha ~993):
```tsx
<div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-border/50 hover:bg-surface-alt/30 transition-colors">
```

Substitua por:
```tsx
<div
  className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-border/50 hover:bg-surface-alt/30 transition-colors cursor-pointer relative"
  onClick={() => handleTabChange('tratamento')}
  role="button"
  tabIndex={0}
  onKeyDown={e => e.key === 'Enter' && handleTabChange('tratamento')}
>
  <ChevronRight className="absolute top-4 right-4 w-3.5 h-3.5 text-text-secondary/30 group-hover:text-text-secondary/60 transition-colors" />
```

> `ChevronRight` já está importado no arquivo.

### 3c — Badge "Aguardando aprovação" clicável

Localize (linha ~1113):
```tsx
{orcamentosAguardando.length > 0 && (
  <div className="flex items-center justify-between">
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-coral/10 text-coral">
      <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0" />
      Aguardando aprovação
    </span>
    <span className="text-sm font-bold text-coral">{orcamentosAguardando.length}</span>
  </div>
)}
```

Substitua por:
```tsx
{orcamentosAguardando.length > 0 && (
  <button
    className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
    onClick={() => handleTabChange('orcamentos')}
  >
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-coral/10 text-coral">
      <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0" />
      Aguardando aprovação
    </span>
    <span className="text-sm font-bold text-coral">{orcamentosAguardando.length}</span>
  </button>
)}
```

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 3: hero strip cards clicáveis (consulta→agenda, tratamento→tratamento, pendências→orcamentos)"`

---

## Task 4: Sync Tratamento → Ficha no PlanejamentoTab

**Arquivo:** `src/components/pacientes/PlanejamentoTab.tsx`

### 4a — Extrair helper de sync

Após a função `getNextStatus` (linha ~469), adicione o helper:

```typescript
/**
 * Sincroniza status de conclusão de procedimento com a tabela fichas.
 * fichaRef = "fichaId::dente::lineIndex"
 * fichaKey  = "dente_lineIndex" (chave em procedimentos_concluidos)
 */
async function syncFichaConclusion(
  supabase: ReturnType<typeof createClient>,
  clinicaId: string,
  fichaRef: string | null,
  newStatus: PlanProc['status']
): Promise<void> {
  if (!fichaRef) return; // procedimento sem ficha vinculada — ignora

  const parts = fichaRef.split('::');
  if (parts.length !== 3) return;
  const [fichaId, dente, lineIndex] = parts;
  const fichaKey = `${dente}_${lineIndex}`;

  try {
    const { data } = await supabase
      .from('fichas')
      .select('procedimentos_concluidos')
      .eq('id', fichaId)
      .single();

    const current: string[] = (data as { procedimentos_concluidos: string[] } | null)
      ?.procedimentos_concluidos ?? [];

    if (newStatus === 'concluido') {
      if (current.includes(fichaKey)) return; // já marcado
      await supabase
        .from('fichas')
        .update({ procedimentos_concluidos: [...current, fichaKey] })
        .eq('id', fichaId)
        .eq('clinica_id', clinicaId);
    } else {
      // Desmarcando — remove a chave
      await supabase
        .from('fichas')
        .update({ procedimentos_concluidos: current.filter(k => k !== fichaKey) })
        .eq('id', fichaId)
        .eq('clinica_id', clinicaId);
    }
  } catch (err) {
    console.warn('[syncFichaConclusion] best-effort sync falhou:', err);
  }
}
```

### 4b — Atualizar updateProcStatus

Localize (linha ~475):
```typescript
const updateProcStatus = async (procId: string, newStatus: PlanProc['status']): Promise<void> => {
  setUpdatingProcId(procId);
  setPlanProcs(prev => prev.map(p => p.id === procId ? { ...p, status: newStatus } : p));
  const supabase = createClient();
  await supabase.from('planejamento_procedimentos').update({ status: newStatus }).eq('id', procId);
  setUpdatingProcId(null);
};
```

Substitua por:
```typescript
const updateProcStatus = async (procId: string, newStatus: PlanProc['status']): Promise<void> => {
  setUpdatingProcId(procId);
  // Optimistic update
  const proc = planProcs.find(p => p.id === procId);
  setPlanProcs(prev => prev.map(p => p.id === procId ? { ...p, status: newStatus } : p));

  const supabase = createClient();
  await supabase
    .from('planejamento_procedimentos')
    .update({ status: newStatus })
    .eq('id', procId);

  // Sync best-effort com a ficha de origem
  if (proc) {
    await syncFichaConclusion(supabase, clinicaId, proc.fichaRef ?? null, newStatus);
  }

  setUpdatingProcId(null);
};
```

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 4: sync updateProcStatus → fichas.procedimentos_concluidos"`

---

## Task 5: Remover Toggle de Conclusão da FichasTab

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### 5a — Remover handleToggleProcedimento

Localize e remova completamente a função (linhas ~412–431):
```typescript
const handleToggleProcedimento = async (fichaId: string, key: string, current: string[]): Promise<void> => {
  // ... todo o bloco
};
```

### 5b — Converter botões clicáveis em spans read-only

Localize o bloco de renderização de procedimentos (linhas ~1254–1276):
```tsx
{tn.notes.filter(Boolean).map((n, i) => {
  const procKey = `${tn.tooth}_${i}`;
  const done = evo.procedimentosConcluidos.includes(procKey);
  return (
    <button
      key={i}
      onClick={() => void handleToggleProcedimento(evo.id, procKey, evo.procedimentosConcluidos)}
      className="flex items-center gap-2 text-left group/proc w-full"
    >
      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border group-hover/proc:border-teal'}`}>
        {done && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className={`text-[11px] font-medium transition-all ${done ? 'line-through text-text-secondary' : 'text-text-primary group-hover/proc:text-teal'}`}>
        {n}
      </span>
    </button>
  );
})}
```

Substitua por (read-only, sem interação):
```tsx
{tn.notes.filter(Boolean).map((n, i) => {
  const procKey = `${tn.tooth}_${i}`;
  const done = evo.procedimentosConcluidos.includes(procKey);
  return (
    <div key={i} className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border/60'}`}>
        {done && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <span className={`text-[11px] font-medium ${done ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
        {n}
      </span>
    </div>
  );
})}
```

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 5: remove toggle de conclusão da FichasTab (read-only, controlado pelo Tratamento)"`

---

## Task 6: FichasTab — Adicionar tratamento_id ao fetch e tipos

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### 6a — Atualizar tipo FichaDB

Localize `type FichaDB` (linha ~89) e adicione o campo:
```typescript
type FichaDB = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  status: string;
  dentista?: { nome: string } | null;
  procedimentos_concluidos: string[];
  procedimentos: string[] | null;
  conduta: string | null;
  retorno_sugerido: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  tratamento_id: string | null; // ← novo
};
```

### 6b — Atualizar tipo Evolution

Localize `interface Evolution` (linha ~73) e adicione:
```typescript
interface Evolution {
  id: string;
  date: string;
  type: string;
  observation: string;
  teethNotes: ToothNote[];
  professional: string;
  files: string[];
  procedimentosConcluidos: string[];
  procedimentos: string[];
  conduta: string | null;
  retornoSugerido: string | null;
  assinaturaUrl: string | null;
  assinadoEm: string | null;
  tratamentoId: string | null; // ← novo
}
```

### 6c — Atualizar mapFichaToEvolution

No `mapFichaToEvolution` (linha ~116), adicione o mapeamento:
```typescript
const mapFichaToEvolution = (f: FichaDB): Evolution => ({
  // ... campos existentes ...
  tratamentoId: f.tratamento_id ?? null, // ← novo
});
```

### 6d — Atualizar query fetchFichas

Na query `.select(...)` do `fetchFichas` (linha ~248), adicione `tratamento_id`:
```typescript
.select("id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, procedimentos, conduta, retorno_sugerido, assinatura_url, assinado_em, tratamento_id, dentista:dentistas(nome)")
```

### 6e — Adicionar imports das server actions e estado de tratamento

No topo do arquivo, após os imports existentes, adicione:
```typescript
import {
  buscarTratamentoAtivo,
  buscarHistoricoTratamentos,
  criarTratamento,
  vincularFichasAoTratamento,
  encerrarTratamento,
  type Tratamento,
} from '@/app/dashboard/pacientes/[id]/tratamento-actions';
import { format as fmtDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
```

> `format` e `parseISO` de `date-fns` já podem estar no arquivo. Use alias `fmtDate` para evitar conflito.

### 6f — Adicionar estados de tratamento na FichasTab

Após os estados existentes (perto da linha ~175), adicione:
```typescript
// ── Episódios de Tratamento ──────────────────────────────────────────────
const [tratamentoAtivo, setTratamentoAtivo] = React.useState<Tratamento | null>(null);
const [historicoTratamentos, setHistoricoTratamentos] = React.useState<Tratamento[]>([]);
const [loadingTratamento, setLoadingTratamento] = React.useState(true);
const [historicoAberto, setHistoricoAberto] = React.useState(false);

// Modal "Iniciar Tratamento"
const [modalIniciarOpen, setModalIniciarOpen] = React.useState(false);
const [novoTratNome, setNovoTratNome] = React.useState('');
const [novoTratFichasSelecionadas, setNovoTratFichasSelecionadas] = React.useState<Set<string>>(new Set());
const [salvandoTratamento, setSalvandoTratamento] = React.useState(false);
const [tratamentoError, setTratamentoError] = React.useState<string | null>(null);

// Modal "Adicionar fichas ao tratamento ativo"
const [modalAdicionarOpen, setModalAdicionarOpen] = React.useState(false);
const [adicionarFichasSelecionadas, setAdicionarFichasSelecionadas] = React.useState<Set<string>>(new Set());
const [adicionandoFichas, setAdicionandoFichas] = React.useState(false);

// Encerrar tratamento
const [encerrando, setEncerrando] = React.useState(false);
const [confirmarEncerramentoOpen, setConfirmarEncerramentoOpen] = React.useState(false);
```

### 6g — Buscar tratamento ao montar

Adicione um `useEffect` logo após o useEffect de fetchFichas:
```typescript
React.useEffect(() => {
  if (!patientId || !clinicaId) return;
  void (async () => {
    setLoadingTratamento(true);
    const [ativo, historico] = await Promise.all([
      buscarTratamentoAtivo(patientId),
      buscarHistoricoTratamentos(patientId),
    ]);
    setTratamentoAtivo(ativo.tratamento);
    setHistoricoTratamentos(historico.tratamentos);
    setLoadingTratamento(false);
  })();
}, [patientId, clinicaId]);
```

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 6: FichasTab — tipos e estado para episódios de tratamento"`

---

## Task 7: FichasTab — Handlers de Tratamento

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Adicione os handlers após os estados (antes do `return`):

```typescript
// ── Handlers de Tratamento ───────────────────────────────────────────────

const handleIniciarTratamento = async (): Promise<void> => {
  setSalvandoTratamento(true);
  setTratamentoError(null);
  const result = await criarTratamento(
    patientId,
    novoTratNome.trim() || null,
    Array.from(novoTratFichasSelecionadas)
  );
  if (result.error) {
    setTratamentoError(result.error);
    setSalvandoTratamento(false);
    return;
  }
  // Atualiza estado local
  const [ativo, historico] = await Promise.all([
    buscarTratamentoAtivo(patientId),
    buscarHistoricoTratamentos(patientId),
  ]);
  setTratamentoAtivo(ativo.tratamento);
  setHistoricoTratamentos(historico.tratamentos);
  // Refetch fichas para refletir tratamento_id atualizado
  await fetchFichas();
  // Reset modal
  setModalIniciarOpen(false);
  setNovoTratNome('');
  setNovoTratFichasSelecionadas(new Set());
  setSalvandoTratamento(false);
};

const handleEncerrarTratamento = async (): Promise<void> => {
  if (!tratamentoAtivo) return;
  setEncerrando(true);
  const result = await encerrarTratamento(tratamentoAtivo.id, patientId);
  if (result.error) {
    setEncerrando(false);
    return;
  }
  const [ativo, historico] = await Promise.all([
    buscarTratamentoAtivo(patientId),
    buscarHistoricoTratamentos(patientId),
  ]);
  setTratamentoAtivo(ativo.tratamento);
  setHistoricoTratamentos(historico.tratamentos);
  setConfirmarEncerramentoOpen(false);
  setEncerrando(false);
};

const handleAdicionarFichasAoTratamento = async (): Promise<void> => {
  if (!tratamentoAtivo) return;
  setAdicionandoFichas(true);
  await vincularFichasAoTratamento(
    tratamentoAtivo.id,
    Array.from(adicionarFichasSelecionadas),
    patientId
  );
  await fetchFichas();
  setModalAdicionarOpen(false);
  setAdicionarFichasSelecionadas(new Set());
  setAdicionandoFichas(false);
};
```

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 7: FichasTab — handlers criarTratamento, encerrarTratamento, vincularFichas"`

---

## Task 8: FichasTab — UI de Episódios (Banner + Seções + Histórico)

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Esta é a maior task. Adicione toda a UI de episódios logo **antes** do botão "+ Nova Ficha" atual (no início do bloco `return`).

### 8a — Calcular fichas avulsas e fichas do tratamento ativo

Adicione computed values antes do `return`:
```typescript
// Fichas agrupadas por episódio
const fichasDoTratamentoAtivo = tratamentoAtivo
  ? evolutions.filter(e => e.tratamentoId === tratamentoAtivo.id)
  : [];
const fichasAvulsas = evolutions.filter(e => e.tratamentoId === null);

// Fichas vinculadas a tratamentos já encerrados (para histórico expandido)
const fichasPorTratamento = (tratId: string) =>
  evolutions.filter(e => e.tratamentoId === tratId);

// Fichas disponíveis para vincular (avulsas — usadas nos modais)
const fichasDisponiveis = evolutions.filter(e => e.tratamentoId === null);
```

### 8b — Banner do Tratamento Ativo

No `return`, logo acima do botão "+ Nova Ficha", insira:

```tsx
{/* ── EPISÓDIO DE TRATAMENTO ───────────────────────────────── */}
{!loadingTratamento && (
  <div className="mb-6 space-y-4">

    {/* Banner tratamento ativo */}
    {tratamentoAtivo ? (
      <div className="rounded-2xl border border-teal/20 bg-teal/5 overflow-hidden">
        {/* Header do episódio */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-teal/10">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-teal animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-teal leading-tight">
                {tratamentoAtivo.nome ?? 'Tratamento ativo'}
              </p>
              <p className="text-[10px] text-teal/70 font-medium">
                Desde {fmtDate(parseISO(tratamentoAtivo.created_at), "dd 'de' MMM yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setConfirmarEncerramentoOpen(true)}
            disabled={encerrando}
            className="text-xs font-bold text-teal/70 hover:text-teal transition-colors flex items-center gap-1 disabled:opacity-40"
          >
            {encerrando ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Encerrar
          </button>
        </div>

        {/* Fichas do episódio */}
        <div className="px-5 py-4">
          {fichasDoTratamentoAtivo.length === 0 ? (
            <p className="text-xs text-teal/60 italic">Nenhuma ficha vinculada ainda</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {fichasDoTratamentoAtivo.map(f => (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface border border-teal/20 text-text-primary"
                >
                  <FileText className="w-3 h-3 text-teal/60" />
                  {f.type} · {f.date.split(' ')[0]}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => { setAdicionarFichasSelecionadas(new Set()); setModalAdicionarOpen(true); }}
            className="text-xs font-semibold text-teal hover:text-teal-lt transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Adicionar ficha existente
          </button>
        </div>
      </div>
    ) : (
      /* Botão "Iniciar Tratamento" quando não há ativo */
      <button
        onClick={() => { setNovoTratFichasSelecionadas(new Set()); setNovoTratNome(''); setTratamentoError(null); setModalIniciarOpen(true); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-teal/30 text-sm font-semibold text-teal hover:border-teal/60 hover:bg-teal/5 transition-all"
      >
        <Plus className="w-4 h-4" />
        Iniciar Tratamento
      </button>
    )}
  </div>
)}
```

### 8c — Seção "Fichas Avulsas"

Substitua a listagem atual de `evolutions.map(...)` por duas seções:

```tsx
{/* Fichas avulsas */}
{fichasAvulsas.length > 0 && (
  <div className="mb-4">
    {tratamentoAtivo && (
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary/50 mb-3">
        Fichas avulsas
      </p>
    )}
    {fichasAvulsas.map(evo => (
      /* ... renderização atual de cada ficha (EvoCard) sem mudanças ... */
    ))}
  </div>
)}

{/* Fichas do tratamento ativo (caso já haja) */}
{fichasDoTratamentoAtivo.length > 0 && (
  <div className="mb-4">
    {fichasDoTratamentoAtivo.map(evo => (
      /* ... mesma renderização atual de cada ficha ... */
    ))}
  </div>
)}
```

> **Nota:** a renderização de cada `evo` permanece exatamente igual ao que já existe. Apenas agrupamos em duas seções.

### 8d — Histórico de Tratamentos (Accordion)

No final do JSX (após a listagem de fichas), adicione:

```tsx
{/* ── HISTÓRICO DE TRATAMENTOS ─────────────────────────────── */}
{historicoTratamentos.length > 0 && (
  <div className="mt-6 border-t border-border/40 pt-4">
    <button
      onClick={() => setHistoricoAberto(v => !v)}
      className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-text-secondary/50 hover:text-text-secondary transition-colors mb-3"
    >
      <span>Histórico de Tratamentos ({historicoTratamentos.length})</span>
      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historicoAberto ? 'rotate-180' : ''}`} />
    </button>

    <AnimatePresence>
      {historicoAberto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden space-y-3"
        >
          {historicoTratamentos.map(trat => {
            const fichas = fichasPorTratamento(trat.id);
            return (
              <div key={trat.id} className="rounded-xl border border-border/50 bg-surface overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {trat.nome ?? 'Tratamento'}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {fmtDate(parseISO(trat.created_at), "dd MMM yyyy", { locale: ptBR })}
                      {trat.encerrado_em && ` → ${fmtDate(parseISO(trat.encerrado_em), "dd MMM yyyy", { locale: ptBR })}`}
                      {' · '}{fichas.length} ficha{fichas.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-teal/10 text-teal">
                    Concluído
                  </span>
                </div>
                {fichas.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {fichas.map(f => (
                      <span
                        key={f.id}
                        className="text-[10px] text-text-secondary bg-surface-alt px-2 py-0.5 rounded"
                      >
                        {f.type} · {f.date.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```

> `ChevronDown` precisa ser importado de `lucide-react` se ainda não estiver.

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Commit:** `git commit -m "Task 8: FichasTab UI — banner episódio ativo, seções fichas, histórico accordion"`

---

## Task 9: FichasTab — Modais de Tratamento

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Adicione os modais antes do `</div>` final do componente.

### Modal "Iniciar Tratamento"

```tsx
{/* ── MODAL INICIAR TRATAMENTO ────────────────────────────── */}
<Dialog open={modalIniciarOpen} onOpenChange={setModalIniciarOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Iniciar Tratamento</DialogTitle>
      <DialogDescription>
        Crie um episódio de tratamento e vincule as fichas existentes.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-2">
      {/* Nome opcional */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          Nome do tratamento <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <input
          type="text"
          value={novoTratNome}
          onChange={e => setNovoTratNome(e.target.value)}
          placeholder="Ex: Faceta de Porcelana, Ortodontia…"
          maxLength={80}
          className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-surface-alt text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-teal/40"
        />
      </div>

      {/* Seleção de fichas */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-secondary">
          Fichas deste tratamento <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        {fichasDisponiveis.length === 0 ? (
          <p className="text-xs text-text-muted italic">Nenhuma ficha avulsa disponível</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
            {fichasDisponiveis.map(f => {
              const sel = novoTratFichasSelecionadas.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setNovoTratFichasSelecionadas(prev => {
                      const next = new Set(prev);
                      sel ? next.delete(f.id) : next.add(f.id);
                      return next;
                    });
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${sel ? 'border-teal/40 bg-teal/5' : 'border-border/50 hover:border-teal/20'}`}
                >
                  <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${sel ? 'bg-teal border-teal' : 'border-border'}`}>
                    {sel && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{f.type}</p>
                    <p className="text-[10px] text-text-secondary">{f.date}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tratamentoError && (
        <p className="text-xs text-coral font-medium">{tratamentoError}</p>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setModalIniciarOpen(false)} disabled={salvandoTratamento}>
        Cancelar
      </Button>
      <Button
        onClick={() => void handleIniciarTratamento()}
        disabled={salvandoTratamento}
        className="bg-teal hover:bg-teal-lt text-white"
      >
        {salvandoTratamento ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
        Iniciar Tratamento
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* ── MODAL ADICIONAR FICHAS AO TRATAMENTO ATIVO ──────────── */}
<Dialog open={modalAdicionarOpen} onOpenChange={setModalAdicionarOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Adicionar fichas ao tratamento</DialogTitle>
    </DialogHeader>

    <div className="py-2">
      {fichasDisponiveis.length === 0 ? (
        <p className="text-sm text-text-muted italic">Nenhuma ficha avulsa disponível para vincular</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
          {fichasDisponiveis.map(f => {
            const sel = adicionarFichasSelecionadas.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => {
                  setAdicionarFichasSelecionadas(prev => {
                    const next = new Set(prev);
                    sel ? next.delete(f.id) : next.add(f.id);
                    return next;
                  });
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${sel ? 'border-teal/40 bg-teal/5' : 'border-border/50 hover:border-teal/20'}`}
              >
                <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${sel ? 'bg-teal border-teal' : 'border-border'}`}>
                  {sel && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">{f.type}</p>
                  <p className="text-[10px] text-text-secondary">{f.date}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setModalAdicionarOpen(false)} disabled={adicionandoFichas}>
        Cancelar
      </Button>
      <Button
        onClick={() => void handleAdicionarFichasAoTratamento()}
        disabled={adicionandoFichas || adicionarFichasSelecionadas.size === 0}
        className="bg-teal hover:bg-teal-lt text-white"
      >
        {adicionandoFichas ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
        Vincular {adicionarFichasSelecionadas.size > 0 ? `(${adicionarFichasSelecionadas.size})` : ''}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{/* ── DIALOG CONFIRMAR ENCERRAMENTO ───────────────────────── */}
<Dialog open={confirmarEncerramentoOpen} onOpenChange={setConfirmarEncerramentoOpen}>
  <DialogContent className="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Encerrar tratamento?</DialogTitle>
      <DialogDescription>
        {tratamentoAtivo?.nome
          ? `Encerrar "${tratamentoAtivo.nome}"? `
          : 'Encerrar este tratamento? '}
        As fichas vinculadas serão mantidas no histórico.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmarEncerramentoOpen(false)} disabled={encerrando}>
        Cancelar
      </Button>
      <Button
        onClick={() => void handleEncerrarTratamento()}
        disabled={encerrando}
        variant="destructive"
      >
        {encerrando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
        Encerrar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Adicione ao import de lucide-react** (se não existirem): `ChevronDown`, `FileText`.

**Verificação TypeScript:**
```bash
npx tsc --noEmit 2>&1 | grep -v screenshots-sprint2
```

**Build completo de verificação:**
```bash
npx next build 2>&1 | tail -20
```
Esperado: build sem erros.

**Commit:** `git commit -m "Task 9: FichasTab modais — iniciar tratamento, adicionar fichas, confirmar encerramento"`

---

## Self-Review do Plano

- **Task 1** cobre: Schema (spec §1)
- **Task 2** cobre: Server actions (spec §2.1, §2.3, §2.4)
- **Task 3** cobre: Cards clicáveis (spec §3)
- **Task 4** cobre: Sync tratamento→ficha (spec §4.2, §4.3)
- **Task 5** cobre: Remover toggle da FichasTab (spec §4.1)
- **Tasks 6–9** cobrem: Episódios de tratamento UI completa (spec §2.1–§2.5)
- **Não-regressões** (spec §8): fichas sem `tratamento_id` continuam em `fichasAvulsas`, orçamentos não tocados, `fichaRef=null` não quebra sync (guarda no if inicial), RLS na migration

---

## Ordem de Execução Recomendada

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9
```

Tasks 3, 4, 5 são independentes entre si e podem ser feitas em paralelo após Task 2.
Tasks 6–9 são sequenciais (cada uma depende da anterior).
