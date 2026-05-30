# Block 10 — Operations Engine (Agenda + Consultation)
**Date:** 2026-05-21  
**Goal:** Transform Odonto.IA into a daily clinic operating system with premium agenda, full consultation workflow, and communication shell.

---

## Architecture Overview

**Current state (do not break):**
- `agendamentos-client.tsx` — ~1100 lines. Monthly calendar + day timeline. Check-in "Chegou!" button. Status dropdown (all statuses). Delete + edit modals. Google Calendar. Conflict detection.
- `consulta-client.tsx` — Voice dictation, DEX formatting, patient sidebar (last ficha, briefing, orçamentos, histórico fichas).
- Status flow already exists in DB: agendado → confirmado → na_recepcao → em_atendimento → realizado / cancelado / faltou.

**What we add (never touch existing logic unless explicitly stated):**
1. Fix TypeScript Agendamento type (na_recepcao, em_atendimento missing)
2. New server actions: `iniciarAtendimento`, `cancelarComMotivo`, `finalizarConsulta`
3. Week view component (separate file)
4. View mode toggle (Mês / Semana) in agendamentos-client
5. No-show quick button + cancel-with-motivo dialog in agendamentos-client  
6. Walk-in/encaixe (bypass conflict check via isEncaixe flag)
7. Enhanced patient context in consulta (alergias, tratamento ativo, etapas)
8. Finalizar consulta wizard (multi-step dialog)
9. Communication shell (service + UI placeholder)
10. Auto set em_atendimento when entering /consulta/[id] if status allows

---

## Tech Stack
- Next.js 15 App Router (server components + server actions)
- TypeScript strict (never `any`)
- Supabase Postgres + RLS via `requireClinicContext()`
- Tailwind CSS v4 + CSS variables (bg-card, text-foreground, text-muted-foreground, border-border, etc.)
- Framer Motion (`motion/react`)
- shadcn/ui (Dialog, Select, Button, Input, Label)
- date-fns with ptBR locale
- CSS color tokens: `#2f9c85` = teal, `bg-teal`, `text-teal`, `text-coral`

---

## Files

### Modified
- `src/types/database.ts`
- `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`
- `src/app/dashboard/agendamentos/actions.ts`
- `src/app/consulta/[agendamentoId]/page.tsx`
- `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`
- `src/app/consulta/[agendamentoId]/actions.ts`

### Created
- `src/app/dashboard/agendamentos/_components/week-view.tsx`
- `src/lib/communication-provider.ts`

---

## Task 1: Fix Agendamento TypeScript Type

**File:** `src/types/database.ts`

**Problem:** `Agendamento.status` union is missing `'na_recepcao'` and `'em_atendimento'`. These exist in DB and in `StatusAgendamento` (actions.ts) but not in the domain type. TypeScript will show warnings everywhere these statuses are used.

**Steps:**
1. Open `src/types/database.ts`
2. Find the `Agendamento` interface (line ~193)
3. Replace the status line:

```typescript
// BEFORE (line ~200):
  status: 'agendado' | 'confirmado' | 'cancelado' | 'realizado' | 'faltou';

// AFTER:
  status: 'agendado' | 'confirmado' | 'cancelado' | 'realizado' | 'faltou' | 'na_recepcao' | 'em_atendimento';
```

4. After the `Agendamento` interface closing brace, add a type alias export:

```typescript
export type AgendamentoStatus = Agendamento['status'];
```

5. Commit: `git commit -m "Task 1: sync Agendamento.status type with DB statuses"`

---

## Task 2: Server Actions — iniciarAtendimento, cancelarComMotivo, finalizarConsulta

**File:** `src/app/consulta/[agendamentoId]/actions.ts`  
**File:** `src/app/dashboard/agendamentos/actions.ts`

### 2a — Add `iniciarAtendimento` to consulta actions

Open `src/app/consulta/[agendamentoId]/actions.ts`. After the existing `salvarFichaConsulta` function, add:

```typescript
export async function iniciarAtendimento(agendamentoId: string): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status')
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ status: string }>();

  if (!ag) return { error: 'Agendamento não encontrado.' };
  const { 'cancelado': _c, 'faltou': _f, 'realizado': _r, ..._ } = {} as Record<string, unknown>;
  if (['cancelado', 'faltou', 'realizado'].includes(ag.status)) return {};

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'em_atendimento', updated_at: new Date().toISOString() })
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}
```

Also add the import at the top if missing:
```typescript
import { revalidatePath } from 'next/cache';
```

### 2b — Add `cancelarComMotivo` to agendamentos actions

Open `src/app/dashboard/agendamentos/actions.ts`. After `deletarAgendamento`, add:

```typescript
export async function cancelarComMotivo(
  id: string,
  motivo: string | null
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('google_event_id, dentista_id, observacoes')
    .eq('id', id)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ google_event_id: string | null; dentista_id: string; observacoes: string | null }>();

  const novasObs = motivo
    ? `[Cancelado: ${motivo}]${ag?.observacoes ? `\n${ag.observacoes}` : ''}`
    : ag?.observacoes ?? null;

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'cancelado', observacoes: novasObs, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };

  if (ag?.google_event_id && ag.dentista_id) {
    try {
      await deleteGoogleCalendarEvent(ag.dentista_id, ag.google_event_id);
      await supabase.from('agendamentos').update({ google_event_id: null }).eq('id', id);
    } catch (err) {
      console.error('[cancelarComMotivo] GCal sync falhou:', err);
    }
  }

  revalidatePath('/dashboard/agendamentos');
  return {};
}
```

### 2c — Add `marcarFaltou` shortcut to agendamentos actions

After `cancelarComMotivo`, add:

```typescript
export async function marcarFaltou(id: string): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();
  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'faltou', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('clinica_id', clinicId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}
```

### 2d — Add `criarEncaixe` to agendamentos actions (bypass conflict check)

After `criarAgendamento`, add:

```typescript
export async function criarEncaixe(dados: {
  pacienteId: string;
  dataHora: string;
  duracaoMinutos: number;
  observacoes: string | null;
  dentistaId?: string;
}): Promise<{ error?: string; id?: string }> {
  const { supabase, user, clinicId } = await requireClinicContext();

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect('/onboarding');

  const dentistaAlvo = dados.dentistaId ?? dentistaPerfil.id;

  const { data, error } = await supabase
    .from('agendamentos')
    .insert({
      clinica_id:      clinicId,
      dentista_id:     dentistaAlvo,
      paciente_id:     dados.pacienteId,
      data_hora:       dados.dataHora,
      duracao_minutos: dados.duracaoMinutos,
      observacoes:     dados.observacoes ?? null,
      status:          'agendado',
      created_by:      dentistaPerfil.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return { id: data.id };
}
```

5. Commit: `git commit -m "Task 2: add iniciarAtendimento, cancelarComMotivo, marcarFaltou, criarEncaixe server actions"`

---

## Task 3: Auto-iniciar Atendimento ao Entrar na Consulta

**File:** `src/app/consulta/[agendamentoId]/page.tsx`

The page should set the appointment status to `em_atendimento` as soon as a dentist opens the consultation. This signals "in progress" to the secretary dashboard.

**Steps:**

1. Open `src/app/consulta/[agendamentoId]/page.tsx`
2. After the existing `requireClinicContext()` call, add a call to set `em_atendimento` only when role is not secretaria AND status is not already terminal:

At the top, import `revalidatePath`:
```typescript
import { revalidatePath } from 'next/cache';
```

In the `ConsultaPage` function, after the `ag` query but before rendering:

```typescript
// Auto-iniciar atendimento quando o dentista entra na consulta
const { role } = await requireClinicContext();
if (role !== 'secretaria' && ag && !['realizado', 'cancelado', 'faltou', 'em_atendimento'].includes(ag.status as string)) {
  await supabase
    .from('agendamentos')
    .update({ status: 'em_atendimento', updated_at: new Date().toISOString() })
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId);
  revalidatePath('/dashboard/agendamentos');
}
```

**Note:** `requireClinicContext()` was already called at the top — destructure `role` from it:
```typescript
const { supabase, clinicId, role } = await requireClinicContext();
```

3. Also pass the current `agendamentoStatus` to `ConsultaClient` so it can show an "Em Atendimento" indicator:

Add to `ConsultaClient` call:
```typescript
agendamentoStatus={(ag.status as string)}
```

4. Commit: `git commit -m "Task 3: auto set em_atendimento when dentist enters consulta page"`

---

## Task 4: Load Enhanced Patient Context in Consulta Page

**File:** `src/app/consulta/[agendamentoId]/page.tsx`

The current page loads: last ficha (queixa, anotacoes, dentes_afetados), orcamentos.  
We need to also load: alergias, historico_medico, medicamentos_em_uso (from last ficha), and active planejamento + etapas.

**Steps:**

1. In the parallel `Promise.all`, expand the fichas query:

```typescript
// Replace existing fichas query
supabase
  .from('fichas')
  .select('created_at, queixa_principal, anotacoes, dentes_afetados, alergias, historico_medico, medicamentos_em_uso, historico_dental')
  .eq('paciente_id', paciente.id)
  .eq('clinica_id', clinicId)
  .order('created_at', { ascending: false })
  .limit(5),
```

2. Add a planejamento query to the `Promise.all`:

```typescript
// Add to Promise.all
supabase
  .from('planejamentos')
  .select('id, titulo, status, planejamento_etapas(id, titulo, dente, dentes, descricao_simples, status, ordem)')
  .eq('paciente_id', paciente.id)
  .eq('clinica_id', clinicId)
  .in('status', ['rascunho', 'apresentado', 'aprovado'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle(),
```

3. Destructure and pass data to `ConsultaClient`:

```typescript
const [{ data: fichas }, { data: orcamentos }, planejamentoResult] = await Promise.all([...]);
const planejamento = planejamentoResult.data ?? null;

const alertasClinicos: string[] = [];
const ultimaFicha = fichas?.[0] ?? null;
if (ultimaFicha?.alergias) alertasClinicos.push(`Alergias: ${ultimaFicha.alergias}`);
if (ultimaFicha?.medicamentos_em_uso) alertasClinicos.push(`Medicamentos: ${ultimaFicha.medicamentos_em_uso}`);
```

4. Add new props to `ConsultaClient`:

```typescript
<ConsultaClient
  // ... existing props
  agendamentoStatus={(ag.status as string)}
  alertasClinicos={alertasClinicos}
  historicoDental={(ultimaFicha?.historico_dental as string | null) ?? null}
  planejamento={planejamento ? {
    id: planejamento.id as string,
    titulo: planejamento.titulo as string,
    status: planejamento.status as string,
    etapas: ((planejamento.planejamento_etapas as unknown[]) ?? []).map((e: unknown) => {
      const etapa = e as { id: string; titulo: string; dente: string | null; descricao_simples: string | null; status: string; ordem: number };
      return {
        id: etapa.id,
        titulo: etapa.titulo,
        dente: etapa.dente,
        descricao_simples: etapa.descricao_simples,
        status: etapa.status,
        ordem: etapa.ordem,
      };
    }).sort((a, b) => a.ordem - b.ordem),
  } : null}
/>
```

5. Commit: `git commit -m "Task 4: load alergias, tratamento ativo e etapas para consulta workspace"`

---

## Task 5: Enhanced ConsultaClient — Sidebar + Finalizar Wizard

**File:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`

This is the largest task. We:
1. Add new props to the interface
2. Add "Em Atendimento" header badge
3. Add alergias alert section to sidebar
4. Add active tratamento + etapas section to sidebar
5. Replace the current save flow with a "Finalizar Consulta" wizard (multi-step dialog)

### 5a — New imports to add at top of file:

```typescript
import { AlertTriangle, Activity, ChevronRight, CalendarPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { iniciarAtendimento } from '../actions';
```

### 5b — Update props interface:

Find `interface ConsultaClientProps` and add:

```typescript
interface EtapaItem {
  id: string;
  titulo: string;
  dente: string | null;
  descricao_simples: string | null;
  status: string;
  ordem: number;
}

interface PlanejamentoResumo {
  id: string;
  titulo: string;
  status: string;
  etapas: EtapaItem[];
}

interface ConsultaClientProps {
  agendamentoId: string;
  paciente: Paciente;
  hora: string;
  observacoesAgendamento: string | null;
  ultimaQueixa: string | null;
  ultimasAnotacoes: string | null;
  fichas: Ficha[];
  orcamentos: Orcamento[];
  // NEW:
  agendamentoStatus: string;
  alertasClinicos: string[];
  historicoDental: string | null;
  planejamento: PlanejamentoResumo | null;
}
```

### 5c — Add finalizar wizard state:

In the `ConsultaClient` function body, after existing state declarations, add:

```typescript
const [wizardOpen, setWizardOpen] = useState(false);
const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
const [wizardForm, setWizardForm] = useState({
  resumo: '',
  conduta: '',
  proximosPassos: '',
  followUpData: '',
  novoAgendamento: false,
});
const [isFinalizando, setIsFinalizando] = useState(false);
```

### 5d — "Em Atendimento" badge in header:

Find the header `<span className="font-heading text-lg text-text-primary">` line. After it, add:

```tsx
{agendamentoStatus === 'em_atendimento' && (
  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal text-white uppercase tracking-wider">
    Em Atendimento
  </span>
)}
```

### 5e — Alertas clínicos section in sidebar (add BEFORE the "Última consulta" section):

After the paciente name section (`</div>` at line ~227), add:

```tsx
{/* Alertas clínicos */}
{alertasClinicos.length > 0 && (
  <div className="p-4 border-b border-border bg-coral/5">
    <div className="flex items-center gap-2 mb-2">
      <AlertTriangle className="w-3.5 h-3.5 text-coral shrink-0" />
      <span className="text-[10px] font-bold text-coral uppercase tracking-widest">Alertas</span>
    </div>
    <div className="space-y-1">
      {alertasClinicos.map((alerta, i) => (
        <p key={i} className="text-xs text-coral/80 leading-relaxed">{alerta}</p>
      ))}
    </div>
  </div>
)}
```

### 5f — Planejamento ativo section in sidebar (add after orçamentos section, before closing `</aside>`):

```tsx
{/* Planejamento ativo */}
{planejamento && (
  <div className="p-4 border-b border-border">
    <div className="flex items-center gap-2 mb-2">
      <Activity className="w-3.5 h-3.5 text-text-secondary shrink-0" />
      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
        Tratamento Ativo
      </span>
    </div>
    <p className="text-xs font-semibold text-text-primary mb-2 truncate">{planejamento.titulo}</p>
    <div className="space-y-1.5">
      {planejamento.etapas.slice(0, 5).map((etapa) => (
        <div key={etapa.id} className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            etapa.status === 'concluido' ? 'bg-teal' :
            etapa.status === 'pendente' ? 'bg-amber-400' :
            'bg-border'
          }`} />
          <span className={`text-[11px] leading-tight ${
            etapa.status === 'concluido' ? 'line-through text-text-secondary' : 'text-text-primary'
          }`}>
            {etapa.titulo}{etapa.dente ? ` — ${etapa.dente}` : ''}
          </span>
        </div>
      ))}
      {planejamento.etapas.length > 5 && (
        <p className="text-[10px] text-text-secondary ml-3.5">+{planejamento.etapas.length - 5} etapas</p>
      )}
    </div>
  </div>
)}
```

### 5g — Replace "Salvar na Ficha" button with "Finalizar Consulta":

Find the button that calls `handleSalvar` in the evolucao confirmation screen. Replace it with:

```tsx
<button
  onClick={() => setWizardOpen(true)}
  disabled={isSaving}
  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
  style={{ background: '#2f9c85', color: '#fff', boxShadow: '0 2px 12px rgba(47,156,133,0.30)' }}
>
  {isSaving
    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
    : <><Check className="w-4 h-4" /> Finalizar Consulta</>
  }
</button>
```

### 5h — Add Finalizar Wizard Dialog (add before the closing `</div>` of the component):

```tsx
{/* ── Wizard: Finalizar Consulta ──────────────────────────────── */}
<Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
  <DialogContent className="rounded-3xl bg-card border-border p-0 gap-0 overflow-hidden max-w-lg">
    {/* Header */}
    <div className="px-6 pt-6 pb-5 border-b border-border" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
      <DialogTitle className="font-heading text-2xl text-white">Finalizar Consulta</DialogTitle>
      <p className="text-white/70 text-xs mt-1">
        Etapa {wizardStep} de 2 — {wizardStep === 1 ? 'Resumo clínico' : 'Próximos passos'}
      </p>
      {/* Progress bar */}
      <div className="mt-3 h-1 bg-white/20 rounded-full">
        <div
          className="h-full bg-white rounded-full transition-all duration-300"
          style={{ width: `${(wizardStep / 2) * 100}%` }}
        />
      </div>
    </div>

    <div className="p-6 space-y-5">

      {/* Step 1 — Resumo + Conduta */}
      {wizardStep === 1 && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resumo da consulta
            </Label>
            <textarea
              value={wizardForm.resumo}
              onChange={e => setWizardForm(f => ({ ...f, resumo: e.target.value }))}
              placeholder="O que foi realizado nesta consulta..."
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm min-h-[100px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conduta clínica
            </Label>
            <textarea
              value={wizardForm.conduta}
              onChange={e => setWizardForm(f => ({ ...f, conduta: e.target.value }))}
              placeholder="Orientações e condutas adotadas..."
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setWizardOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl bg-teal text-white hover:bg-teal/90"
              onClick={() => setWizardStep(2)}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      )}

      {/* Step 2 — Próximos passos + Follow-up */}
      {wizardStep === 2 && (
        <>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Próximos passos
            </Label>
            <textarea
              value={wizardForm.proximosPassos}
              onChange={e => setWizardForm(f => ({ ...f, proximosPassos: e.target.value }))}
              placeholder="Instruções para o paciente, retorno, cuidados..."
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Follow-up opcional */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data de retorno (opcional)
            </Label>
            <input
              type="date"
              value={wizardForm.followUpData}
              onChange={e => setWizardForm(f => ({ ...f, followUpData: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal/20 transition-all text-foreground"
            />
            <p className="text-[11px] text-muted-foreground">
              Se preenchida, cria um lembrete de follow-up.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setWizardStep(1)}>
              Voltar
            </Button>
            <Button
              className="flex-1 rounded-xl bg-teal text-white hover:bg-teal/90"
              disabled={isFinalizando}
              onClick={() => void handleFinalizar()}
            >
              {isFinalizando
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                : <><Check className="w-4 h-4 mr-2" /> Concluir</>
              }
            </Button>
          </div>
        </>
      )}
    </div>
  </DialogContent>
</Dialog>
```

### 5i — Add `handleFinalizar` function in component body:

After `handleSalvar`, add:

```typescript
const handleFinalizar = async () => {
  if (!evolucao) return;
  setIsFinalizando(true);

  // Concatenate wizard fields into anotacoes
  const anotacoesCompletas = [
    evolucao.anotacoes,
    wizardForm.resumo ? `\n\nResumo: ${wizardForm.resumo}` : '',
    wizardForm.conduta ? `\nConduta: ${wizardForm.conduta}` : '',
    wizardForm.proximosPassos ? `\nPróximos passos: ${wizardForm.proximosPassos}` : '',
    wizardForm.followUpData ? `\nRetorno previsto: ${wizardForm.followUpData}` : '',
  ].filter(Boolean).join('');

  const result = await salvarFichaConsulta({
    agendamentoId,
    pacienteId: paciente.id,
    queixa_principal: evolucao.queixa_principal,
    anotacoes: anotacoesCompletas,
    dentes_afetados: evolucao.dentes_afetados,
    dentes_observacoes: evolucao.dentes_observacoes,
  });

  if (result.error) {
    toast.error(result.error);
    setIsFinalizando(false);
    return;
  }

  setWizardOpen(false);
  setSaved(true);
  setTimeout(() => router.push(`/dashboard/pacientes/${paciente.id}`), 1800);
};
```

6. Commit: `git commit -m "Task 5: enhanced consulta sidebar (alertas, tratamento) + finalizar wizard"`

---

## Task 6: Week View Component

**File:** `src/app/dashboard/agendamentos/_components/week-view.tsx` (NEW)

This component receives the month's appointments and selected week. It renders a 7-column time grid (Google Calendar style).

```typescript
'use client';

import { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isToday as isDateToday,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Stethoscope } from 'lucide-react';
import type { AgendamentoRow } from '../page';

const HOUR_START = 7;   // 07:00
const HOUR_END   = 20;  // 20:00
const SLOT_HEIGHT = 64; // px per hour

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  agendado:       { bg: '#f5f3ef', border: '#d4d1ca', text: '#6b7280' },
  confirmado:     { bg: 'rgba(47,156,133,0.08)', border: 'rgba(47,156,133,0.25)', text: '#2f9c85' },
  na_recepcao:    { bg: 'rgba(47,156,133,0.15)', border: 'rgba(47,156,133,0.40)', text: '#2f9c85' },
  em_atendimento: { bg: '#2f9c85', border: '#2f9c85', text: '#fff' },
  realizado:      { bg: 'rgba(47,156,133,0.06)', border: '#d4d1ca', text: '#9ca3af' },
  cancelado:      { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  faltou:         { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.20)', text: '#ef4444' },
};

interface WeekViewProps {
  agendamentos: AgendamentoRow[];
  selectedWeek: Date;          // any day within the target week
  onWeekChange: (d: Date) => void;
  onAppointmentClick: (apt: AgendamentoRow) => void;
  onDayClick: (d: Date) => void;
  isSecretaria: boolean;
  filtroDentistaId: string;
  dentistas: { id: string; nome: string }[];
}

export function WeekView({
  agendamentos,
  selectedWeek,
  onWeekChange,
  onAppointmentClick,
  onDayClick,
  isSecretaria,
  filtroDentistaId,
  dentistas,
}: WeekViewProps) {
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 0 }); // Sunday
  const weekEnd   = endOfWeek(selectedWeek, { weekStartsOn: 0 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Filter appointments for this week
  const weekApts = useMemo(() => {
    return agendamentos.filter(apt => {
      const d = parseISO(apt.data_hora);
      return d >= weekStart && d <= weekEnd;
    });
  }, [agendamentos, weekStart, weekEnd]);

  // Group by day
  const aptsByDay = useMemo(() => {
    const map: Record<string, AgendamentoRow[]> = {};
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = weekApts.filter(a => isSameDay(parseISO(a.data_hora), day));
    }
    return map;
  }, [weekApts, days]);

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const totalHeight = (HOUR_END - HOUR_START) * SLOT_HEIGHT;

  function getAptStyle(apt: AgendamentoRow) {
    const d = parseISO(apt.data_hora);
    const hourDecimal = d.getHours() + d.getMinutes() / 60;
    const top = (hourDecimal - HOUR_START) * SLOT_HEIGHT;
    const height = Math.max((apt.duracao_minutos / 60) * SLOT_HEIGHT - 4, 24);
    const colors = STATUS_COLORS[apt.status] ?? STATUS_COLORS.agendado;
    return { top, height, ...colors };
  }

  return (
    <div className="flex flex-col h-full">
      {/* Week header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWeekChange(subWeeks(selectedWeek, 1))}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors border border-border"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} –{' '}
            {format(weekEnd, "d 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <button
            onClick={() => onWeekChange(addWeeks(selectedWeek, 1))}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors border border-border"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
        <button
          onClick={() => onWeekChange(new Date())}
          className="text-xs font-semibold text-teal hover:text-teal/80 transition-colors px-3 py-1.5 rounded-lg bg-teal/5 hover:bg-teal/10"
        >
          Hoje
        </button>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border shrink-0">
        <div className="w-14 shrink-0" /> {/* time gutter */}
        {days.map(day => {
          const isToday = isDateToday(day);
          const key = format(day, 'yyyy-MM-dd');
          const count = aptsByDay[key]?.length ?? 0;
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className="flex-1 text-center py-2.5 cursor-pointer hover:bg-accent transition-colors"
            >
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isToday ? 'text-teal' : 'text-muted-foreground'}`}>
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div className={`text-lg font-bold leading-none rounded-full w-8 h-8 flex items-center justify-center mx-auto ${
                isToday ? 'bg-teal text-white' : 'text-foreground'
              }`}>
                {format(day, 'd')}
              </div>
              {count > 0 && (
                <div className="text-[10px] text-teal font-semibold mt-0.5">{count}x</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ minHeight: `${totalHeight}px` }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 relative">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
              >
                <span className="text-[10px] font-mono text-muted-foreground leading-none -mt-2">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const dayApts = aptsByDay[key] ?? [];
            return (
              <div key={key} className="flex-1 relative border-l border-border">
                {/* Hour lines */}
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/50"
                    style={{ top: `${(h - HOUR_START) * SLOT_HEIGHT}px` }}
                  />
                ))}

                {/* Appointments */}
                {dayApts.map(apt => {
                  const { top, height, bg, border, text } = getAptStyle(apt);
                  return (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer hover:brightness-95 transition-all overflow-hidden"
                      style={{ top: `${top}px`, height: `${height}px`, background: bg, border: `1px solid ${border}` }}
                    >
                      <div className="flex items-center gap-1 h-full">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: text }}>
                            {format(parseISO(apt.data_hora), 'HH:mm')} · {apt.paciente?.nome?.split(' ')[0] ?? '—'}
                          </p>
                          {height > 36 && isSecretaria && apt.dentista && (
                            <p className="text-[10px] truncate mt-0.5" style={{ color: text, opacity: 0.7 }}>
                              Dr(a). {apt.dentista.nome.split(' ')[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

7. Commit: `git commit -m "Task 6: create WeekView component (premium time-grid, multi-column)"`

---

## Task 7: Add Week View + View Toggle to AgendamentosClient

**File:** `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`

### 7a — New imports:

At top of file, add:
```typescript
import { WeekView } from './week-view';
import { LayoutGrid, CalendarDays as CalendarWeek, AlignLeft } from 'lucide-react';
```

### 7b — New state variables (after existing state declarations):

```typescript
type ViewMode = 'month' | 'week';
const [viewMode, setViewMode] = useState<ViewMode>('month');
const [selectedWeek, setSelectedWeek] = useState(() => new Date());
```

### 7c — Add view toggle UI (inside the header `<div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">`):

Add BEFORE the dentista filter buttons:

```tsx
{/* View mode toggle */}
<div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1">
  <button
    onClick={() => setViewMode('month')}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
      viewMode === 'month' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    <LayoutGrid className="w-3.5 h-3.5" />
    Mês
  </button>
  <button
    onClick={() => setViewMode('week')}
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
      viewMode === 'week' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    <CalendarWeek className="w-3.5 h-3.5" />
    Semana
  </button>
</div>
```

### 7d — Render week view conditionally:

Find the outer grid `<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">`.

Before it, add:

```tsx
{/* Week view — full width when active */}
{viewMode === 'week' && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    style={{ height: '700px' }}
  >
    <WeekView
      agendamentos={agendamentosFiltrados}
      selectedWeek={selectedWeek}
      onWeekChange={setSelectedWeek}
      onAppointmentClick={handleOpenDetail}
      onDayClick={(d) => {
        setSelectedDate(d);
        setViewMode('month');
      }}
      isSecretaria={isSecretaria}
      filtroDentistaId={filtroDentistaId}
      dentistas={dentistas}
    />
  </motion.div>
)}
```

Then wrap the existing month/day grid with `{viewMode === 'month' && (`:

```tsx
{viewMode === 'month' && (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
    {/* ... existing calendar + day list ... */}
  </div>
)}
```

8. Commit: `git commit -m "Task 7: integrate WeekView into agendamentos with view mode toggle"`

---

## Task 8: No-show Quick Button + Cancel With Motivo Dialog

**File:** `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`

### 8a — Import new actions:

Add to existing imports from `../actions`:
```typescript
import {
  // existing imports...
  cancelarComMotivo,
  marcarFaltou,
  criarEncaixe,
} from '../actions';
```

### 8b — New state for cancel dialog:

After existing state declarations, add:
```typescript
const [cancelDialog, setCancelDialog] = useState<{ aptId: string } | null>(null);
const [cancelMotivo, setCancelMotivo] = useState('');
const [isCancelling, setIsCancelling] = useState(false);
```

### 8c — Add no-show button to appointment card:

In the appointment card action buttons section (after the "Chegou!" button), add no-show button:

```tsx
{/* No-show — secretary only, for scheduled/confirmed appointments */}
{isSecretaria && ['agendado', 'confirmado'].includes(apt.status) && (
  <button
    onClick={() => void handleFaltou(apt.id)}
    className="px-3 py-2.5 min-h-[44px] text-sm font-semibold text-coral border border-coral/20 bg-coral/5 hover:bg-coral/10 rounded-lg transition-colors flex items-center gap-1.5"
  >
    <AlertTriangle className="w-4 h-4" />
    Faltou
  </button>
)}

{/* Cancel — secretary only */}
{isSecretaria && !['cancelado', 'faltou', 'realizado'].includes(apt.status) && (
  <button
    onClick={() => { setCancelDialog({ aptId: apt.id }); setCancelMotivo(''); }}
    className="px-3 py-2.5 min-h-[44px] text-sm font-semibold text-muted-foreground border border-border hover:bg-muted rounded-lg transition-colors flex items-center gap-1.5"
  >
    Cancelar
  </button>
)}
```

### 8d — Add handlers:

```typescript
const handleFaltou = async (id: string) => {
  const result = await marcarFaltou(id);
  if (!result.error) {
    setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'faltou' } : a));
  } else {
    toast.error(result.error);
  }
};

const handleCancelar = async () => {
  if (!cancelDialog) return;
  setIsCancelling(true);
  const result = await cancelarComMotivo(cancelDialog.aptId, cancelMotivo || null);
  if (!result.error) {
    setAgendamentos(prev => prev.map(a => a.id === cancelDialog.aptId ? { ...a, status: 'cancelado' } : a));
    if (selectedApt?.id === cancelDialog.aptId) {
      setSelectedApt(prev => prev ? { ...prev, status: 'cancelado' } : prev);
    }
    setCancelDialog(null);
  } else {
    toast.error(result.error);
  }
  setIsCancelling(false);
};
```

### 8e — Add cancel dialog (before the last `</div>` of the component):

```tsx
{/* Cancel with motivo dialog */}
<Dialog open={!!cancelDialog} onOpenChange={(open) => { if (!open) setCancelDialog(null); }}>
  <DialogContent className="rounded-2xl bg-card border-border max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-foreground font-heading">Cancelar agendamento</DialogTitle>
      <DialogDescription className="text-muted-foreground text-sm">
        Informe o motivo do cancelamento (opcional).
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <textarea
        value={cancelMotivo}
        onChange={e => setCancelMotivo(e.target.value)}
        placeholder="Ex: Paciente remarcou, urgência, etc."
        className="w-full bg-muted border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 text-foreground placeholder:text-muted-foreground/50"
      />
    </div>
    <DialogFooter className="gap-2">
      <Button variant="outline" className="rounded-xl" onClick={() => setCancelDialog(null)}>
        Voltar
      </Button>
      <Button
        className="rounded-xl bg-coral text-white hover:bg-coral/90"
        disabled={isCancelling}
        onClick={() => void handleCancelar()}
      >
        {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Confirmar Cancelamento
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Note:** `AlertTriangle` must be imported from lucide-react. Check it's not already imported. Also need `DialogDescription` and `DialogFooter`.

9. Commit: `git commit -m "Task 8: no-show quick button + cancel with motivo dialog"`

---

## Task 9: Walk-in / Encaixe

**File:** `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`

The walk-in allows creating an appointment without conflict check, for when a patient arrives without a prior booking.

### 9a — Add encaixe state:

```typescript
const [isEncaixeOpen, setIsEncaixeOpen] = useState(false);
const [encaixeForm, setEncaixeForm] = useState({
  pacienteSearch: '',
  pacienteId: '',
  pacienteNome: '',
  hora: '09:00',
  duracao: '30',
  dentistaId: dentistas[0]?.id ?? '',
});
const [encaixeSugestoes, setEncaixeSugestoes] = useState<{ id: string; nome: string }[]>([]);
const [showEncaixeSugestoes, setShowEncaixeSugestoes] = useState(false);
const [encaixeSaving, setEncaixeSaving] = useState(false);
const [encaixeError, setEncaixeError] = useState<string | null>(null);
```

### 9b — Add encaixe button in header (next to "Novo Agendamento"):

```tsx
{canEdit && isSecretaria && (
  <button
    onClick={() => setIsEncaixeOpen(true)}
    className="bg-card border border-border text-foreground hover:bg-accent px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
  >
    <Stethoscope className="w-4 h-4" />
    Encaixe
  </button>
)}
```

Note: Import `Stethoscope` from lucide-react if not already there.

### 9c — Add encaixe handler:

```typescript
const buscarEncaixePacientes = useCallback(async (nome: string) => {
  if (nome.length < 2) { setEncaixeSugestoes([]); return; }
  const supabase = createClient();
  const { data } = await supabase.from('pacientes').select('id, nome').ilike('nome', `%${nome}%`).limit(6);
  setEncaixeSugestoes(data ?? []);
}, []);

const handleCriarEncaixe = async () => {
  if (!encaixeForm.pacienteId) { setEncaixeError('Selecione um paciente.'); return; }
  if (isSecretaria && !encaixeForm.dentistaId) { setEncaixeError('Selecione um dentista.'); return; }
  setEncaixeError(null);
  setEncaixeSaving(true);

  const hoje = format(selectedDate, 'yyyy-MM-dd');
  const [hora, minuto] = encaixeForm.hora.split(':').map(Number);
  const [ano, mes, dia] = hoje.split('-').map(Number);
  const dataHora = new Date(ano, mes - 1, dia, hora, minuto).toISOString();

  const result = await criarEncaixe({
    pacienteId: encaixeForm.pacienteId,
    dataHora,
    duracaoMinutos: parseInt(encaixeForm.duracao, 10) || 30,
    observacoes: '[Encaixe]',
    ...(isSecretaria && encaixeForm.dentistaId ? { dentistaId: encaixeForm.dentistaId } : {}),
  });

  if (result.error) {
    setEncaixeError(result.error);
  } else {
    const novoAgt: AgendamentoRow = {
      id: result.id ?? crypto.randomUUID(),
      clinica_id: _clinicaId,
      paciente_id: encaixeForm.pacienteId,
      dentista_id: isSecretaria ? encaixeForm.dentistaId : dentistaAtualId,
      data_hora: dataHora,
      duracao_minutos: parseInt(encaixeForm.duracao, 10) || 30,
      status: 'agendado',
      origem: 'manual',
      observacoes: '[Encaixe]',
      created_at: new Date().toISOString(),
      paciente: { id: encaixeForm.pacienteId, nome: encaixeForm.pacienteNome },
      dentista: dentistas.find(d => d.id === encaixeForm.dentistaId) ?? null,
      criador: null,
    };
    setAgendamentos(prev => [...prev, novoAgt]);
    setIsEncaixeOpen(false);
    toast.success('Encaixe criado com sucesso!');
  }
  setEncaixeSaving(false);
};
```

### 9d — Add encaixe dialog (after cancel dialog, before last `</div>`):

```tsx
<Dialog open={isEncaixeOpen} onOpenChange={setIsEncaixeOpen}>
  <DialogContent className="rounded-2xl bg-card border-border max-w-md p-0 overflow-hidden">
    <div className="px-6 pt-5 pb-4 border-b border-border" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
      <DialogTitle className="font-heading text-xl text-white">Encaixe / Walk-in</DialogTitle>
      <p className="text-white/70 text-xs mt-0.5">Atendimento sem agendamento prévio — sem verificação de conflito.</p>
    </div>
    <DialogDescription className="sr-only">Criar encaixe para paciente sem agendamento.</DialogDescription>

    <div className="p-6 space-y-4">
      {encaixeError && (
        <p className="text-sm text-coral bg-coral/5 border border-coral/20 rounded-xl px-3 py-2">{encaixeError}</p>
      )}

      {/* Dentista (secretary only) */}
      {isSecretaria && dentistas.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dentista</Label>
          <Select
            value={encaixeForm.dentistaId}
            onValueChange={v => v && setEncaixeForm(f => ({ ...f, dentistaId: v }))}
          >
            <SelectTrigger className="rounded-xl bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {dentistas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Paciente autocomplete */}
      <div className="space-y-1.5 relative">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente</Label>
        <Input
          placeholder="Digite o nome do paciente..."
          value={encaixeForm.pacienteSearch}
          autoComplete="off"
          onChange={e => {
            const v = e.target.value;
            setEncaixeForm(f => ({ ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }));
            setShowEncaixeSugestoes(true);
            void buscarEncaixePacientes(v);
          }}
          className="rounded-xl bg-muted border-border"
        />
        {showEncaixeSugestoes && encaixeSugestoes.length > 0 && (
          <div className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
            {encaixeSugestoes.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setEncaixeForm(f => ({ ...f, pacienteSearch: p.nome, pacienteId: p.id, pacienteNome: p.nome }));
                  setShowEncaixeSugestoes(false);
                }}
                className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors text-foreground"
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hora</Label>
          <Input
            type="time"
            value={encaixeForm.hora}
            onChange={e => setEncaixeForm(f => ({ ...f, hora: e.target.value }))}
            className="rounded-xl bg-muted border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duração</Label>
          <Select value={encaixeForm.duracao} onValueChange={v => v && setEncaixeForm(f => ({ ...f, duracao: v }))}>
            <SelectTrigger className="rounded-xl bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="45">45 min</SelectItem>
              <SelectItem value="60">1 hora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Data: {format(selectedDate, "dd/MM/yyyy")} (dia selecionado na agenda)
      </p>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsEncaixeOpen(false)}>
          Cancelar
        </Button>
        <Button
          className="flex-1 rounded-xl bg-teal text-white hover:bg-teal/90"
          disabled={encaixeSaving}
          onClick={() => void handleCriarEncaixe()}
        >
          {encaixeSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Criar Encaixe
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

10. Commit: `git commit -m "Task 9: walk-in/encaixe feature with bypass conflict check"`

---

## Task 10: Communication Shell Service + UI

**File:** `src/lib/communication-provider.ts` (NEW)

```typescript
// Communication provider abstraction — shell ready for WhatsApp integration
// DO NOT implement real sending. Mock only. Replace with real provider later.

export type CommunicationAction =
  | 'confirmar_consulta'
  | 'lembrete'
  | 'follow_up'
  | 'reagendamento';

export interface CommunicationPayload {
  pacienteNome: string;
  pacienteTelefone: string | null;
  dataHora: string;
  dentistaNome?: string;
  clinicaNome?: string;
}

export interface CommunicationResult {
  success: boolean;
  message: string;
  provider: 'mock' | 'whatsapp' | 'sms';
}

const TEMPLATES: Record<CommunicationAction, (p: CommunicationPayload) => string> = {
  confirmar_consulta: (p) =>
    `Olá ${p.pacienteNome}! Sua consulta está confirmada para ${new Date(p.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Até lá!`,
  lembrete: (p) =>
    `Lembrete: você tem consulta amanhã às ${new Date(p.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Confirma presença?`,
  follow_up: (p) =>
    `Olá ${p.pacienteNome}! Tudo bem após sua consulta? Qualquer dúvida estamos à disposição.`,
  reagendamento: (p) =>
    `Olá ${p.pacienteNome}! Precisamos reagendar sua consulta. Entre em contato para escolher um novo horário.`,
};

export async function sendCommunication(
  action: CommunicationAction,
  payload: CommunicationPayload
): Promise<CommunicationResult> {
  // MOCK: log to console, return success
  const message = TEMPLATES[action](payload);
  console.info('[communication-provider] MOCK send:', { action, to: payload.pacienteTelefone, message });
  
  // Simulate async
  await new Promise(r => setTimeout(r, 500));
  
  return {
    success: true,
    message: `[MOCK] Mensagem preparada: "${message.slice(0, 60)}..."`,
    provider: 'mock',
  };
}

export function getActionLabel(action: CommunicationAction): string {
  const labels: Record<CommunicationAction, string> = {
    confirmar_consulta: 'Confirmar Consulta',
    lembrete: 'Enviar Lembrete',
    follow_up: 'Follow-up Pós-consulta',
    reagendamento: 'Solicitar Reagendamento',
  };
  return labels[action];
}

export function getActionDescription(action: CommunicationAction): string {
  const descs: Record<CommunicationAction, string> = {
    confirmar_consulta: 'Envia confirmação da consulta ao paciente via WhatsApp.',
    lembrete: 'Lembrete automático 24h antes da consulta.',
    follow_up: 'Mensagem de acompanhamento após atendimento.',
    reagendamento: 'Solicita novo horário ao paciente.',
  };
  return descs[action];
}
```

**Communication UI in appointment detail modal** (in `agendamentos-client.tsx`):

In the detail modal view mode (`detailMode === 'view'`), after the status dropdown section, add:

```tsx
{/* Communication shell — secretary only */}
{isSecretaria && selectedApt && selectedApt.paciente && (
  <div className="mt-5 border-t border-border pt-4">
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
      <BotMessageSquare className="w-3.5 h-3.5" />
      Comunicação
    </p>
    <div className="grid grid-cols-2 gap-2">
      {(['confirmar_consulta', 'lembrete', 'follow_up', 'reagendamento'] as const).map(action => (
        <CommunicationButton
          key={action}
          action={action}
          apt={selectedApt}
        />
      ))}
    </div>
    <p className="text-[10px] text-muted-foreground mt-2 italic">
      WhatsApp real em breve. Ações simuladas por ora.
    </p>
  </div>
)}
```

**CommunicationButton component** (add as a module-level function in the same file):

```typescript
function CommunicationButton({
  action,
  apt,
}: {
  action: 'confirmar_consulta' | 'lembrete' | 'follow_up' | 'reagendamento';
  apt: AgendamentoRow;
}) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    const { sendCommunication, getActionLabel } = await import('@/lib/communication-provider');
    const result = await sendCommunication(action, {
      pacienteNome: apt.paciente?.nome ?? '',
      pacienteTelefone: null,
      dataHora: apt.data_hora,
    });
    toast.success(result.message);
    setLoading(false);
  };

  const labels: Record<string, string> = {
    confirmar_consulta: 'Confirmar',
    lembrete: 'Lembrete',
    follow_up: 'Follow-up',
    reagendamento: 'Reagendar',
  };

  return (
    <button
      onClick={() => void handleSend()}
      disabled={loading}
      className="px-3 py-2 text-xs font-semibold border border-border rounded-xl hover:bg-muted transition-colors text-foreground disabled:opacity-50 flex items-center justify-center gap-1.5"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <BotMessageSquare className="w-3 h-3" />}
      {labels[action]}
    </button>
  );
}
```

11. Commit: `git commit -m "Task 10: communication shell service + UI placeholders"`

---

## Self-Review Checklist

- [x] Task 1: TypeScript type fix — `na_recepcao`, `em_atendimento` in `Agendamento.status`
- [x] Task 2: Server actions — `iniciarAtendimento`, `cancelarComMotivo`, `marcarFaltou`, `criarEncaixe`
- [x] Task 3: Auto set `em_atendimento` when entering consulta page
- [x] Task 4: Load alergias, tratamento, etapas in consulta page
- [x] Task 5: Enhanced sidebar (alertas, tratamento) + finalizar wizard
- [x] Task 6: WeekView component (time grid, multi-column)
- [x] Task 7: View toggle (Mês/Semana) + WeekView integration
- [x] Task 8: No-show button + cancel with motivo dialog
- [x] Task 9: Walk-in/encaixe modal
- [x] Task 10: Communication shell abstraction + UI

## Etapas não cobertas neste plano (backlog futuro)
- Availability helper (show free slots visually): futuro, requer horarios_disponiveis configurados
- Dashboard integration: already done (SecretariaDashboard has real data)
- Patient flow navigation: existing "Ver Ficha" button already links to patient
- Real WhatsApp integration: awaiting official API contract
- Drag-and-drop appointments: deferred (complex UX)

---

## Execution

Run with: `/subagent-driven-development`
