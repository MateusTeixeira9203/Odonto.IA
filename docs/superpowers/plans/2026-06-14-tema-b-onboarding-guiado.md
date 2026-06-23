# Tema B — Onboarding guiado + Card de primeiros passos

**Data:** 2026-06-14
**Objetivo:** Substituir a apresentação passiva (slides + tour bugado) por uma jornada guiada "aprende fazendo": DEX se apresenta, leva o dentista pela mão até a demo do Modo Consulta, e um card de primeiros passos guia o resto. Tudo robusto, sem overlay frágil.

---

## Contexto e decisões fechadas

- **Momento de valor:** viver o Modo Consulta. A demo (`/consulta/demo`) entrega isso no dia 0.
- **Apresentação atual tem que sair:** `DexWelcome` (4 slides passivos) + `DexOnboarding` (tour overlay bugado, hoje código morto, nunca montado).
- **Nada de spotlight sobre a página real** (causa raiz dos bugs). Em vez disso: DEX mascote no canto + **botão real pulsando em teal vibrante**.
- **Botão de entrada da demo vive no card de primeiros passos** (passo 1) — porque o botão "Entrar no Modo Consulta" do hero só existe com agendamento, e o dentista novo não tem nenhum.

### Jornada final

```
Cadastro → onboarding (plano→dados→procedimentos→sucesso) → dashboard
   ↓
[Cena de abertura — tela escura, estilo slide 1 de hoje]
"Bom dia, Dr. Tal. Eu sou o Dex, seu copiloto. Vou te apresentar o sistema." → [Começar]
   ↓ (cena fecha e o DEX sobe pro canto)
[DEX mascote no canto + caixinha com olhinhos, pulsando enquanto fala]
"Deixei um paciente demo pronto. Clique no botão que está brilhando."
+ botão "Entrar no Modo Consulta" (no card de primeiros passos) PULSA em teal
   ↓ (clica → /consulta/demo)
[Dentro da demo — caixinha guia cada passo]
ao entrar: "Deixa que eu cuido do resto. Foque no paciente." (some em ~6s)
passo a passo: fale a queixa → Organizar com DEX → confira → salve
   ↓ (salva)
volta pro dashboard → guia encerra → DEX volta a ser o FAB normal no canto
[Card de primeiros passos assume — 5 passos, marca o passo 1]
```

---

## Máquina de estado (localStorage)

Chave: `dex_guide_phase_v1_${dentistaId}`. Valores:

| fase | onde | o que mostra |
|---|---|---|
| `welcome` (ou ausente) | dashboard | cena de abertura |
| `point_demo` | dashboard | mascote no canto + botão da demo pulsando |
| `in_demo` | /consulta/demo | caixinha guiando os passos |
| `done` | — | guia encerrado; FAB normal volta; card de passos segue por dados |

Sincronização dentro de uma mesma página: hook `useDexGuide` lê/escreve localStorage e emite um `CustomEvent('dex-guide-phase')` pra todos os componentes da página reagirem. Entre páginas (dashboard ↔ demo, layouts diferentes), cada superfície lê o localStorage no mount.

`prefers-reduced-motion`: todas as animações têm fallback (fade simples, sem voo/pulso).

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/onboarding/dex-welcome.tsx` | **deletar** |
| `src/components/onboarding/dex-onboarding.tsx` | **deletar** (código morto) |
| `src/components/onboarding/sim-*.tsx` | **deletar** (só usados pelo tour morto — confirmar) |
| `src/hooks/useDexGuide.ts` | criar |
| `src/components/onboarding/dex-guide.tsx` | criar (orquestrador do dashboard: cena + mascote) |
| `src/components/onboarding/dex-mascot.tsx` | criar (personagem canto + caixinha) |
| `src/components/dashboard/primeiros-passos-card.tsx` | criar |
| `src/lib/onboarding-progress.ts` | criar (deriva os 5 passos do banco) |
| `src/components/layout/dashboard-shell.tsx` | modificar (trocar DexWelcome→DexGuide) |
| `src/app/dashboard/page.tsx` | modificar (montar card + buscar progresso) |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | modificar (coach in-demo) |

---

## Task 1 — Remover apresentação antiga

**Passos:**

1. Confirmar que `sim-*.tsx` só são usados pelo tour morto:
   ```powershell
   Select-String -Path "src\**\*.tsx" -Pattern "sim-agendamento|sim-orcamento|sim-perfil-paciente|sim-bot|sim-financeiro|sim-modo-consulta|SimAgendamento|SimOrcamento|SimModoConsulta" | Select-Object Filename -Unique
   ```
   Se só aparecerem em `dex-onboarding.tsx` e neles mesmos → seguros pra deletar.

2. Em `src/components/layout/dashboard-shell.tsx`, remover o import e o mount do `DexWelcome` (linha ~9 e ~141). Substituir o mount por `DexGuide` (Task 4).

3. Deletar arquivos:
   ```powershell
   Remove-Item "src\components\onboarding\dex-welcome.tsx"
   Remove-Item "src\components\onboarding\dex-onboarding.tsx"
   Remove-Item "src\components\onboarding\sim-agendamento.tsx","src\components\onboarding\sim-orcamento.tsx","src\components\onboarding\sim-perfil-paciente.tsx","src\components\onboarding\sim-bot.tsx","src\components\onboarding\sim-financeiro.tsx","src\components\onboarding\sim-modo-consulta.tsx"
   ```

4. `npx tsc --noEmit` — corrigir qualquer import órfão remanescente.

> Nota: o `DEX_ONBOARDING_KEY` exportado por `dex-onboarding.tsx` é usado pelo DexWidget? Conferir antes. Se sim, mover a constante pra `useDexGuide.ts` e reapontar o import.

---

## Task 2 — Hook useDexGuide

**Arquivo:** `src/hooks/useDexGuide.ts` (criar)

```ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export type DexGuidePhase = 'welcome' | 'point_demo' | 'in_demo' | 'done';

const KEY = (id: string) => `dex_guide_phase_v1_${id}`;
const EVENT = 'dex-guide-phase';

export function useDexGuide(dentistaId: string) {
  const [phase, setPhaseState] = useState<DexGuidePhase>('done'); // default seguro p/ SSR

  useEffect(() => {
    const stored = localStorage.getItem(KEY(dentistaId)) as DexGuidePhase | null;
    setPhaseState(stored ?? 'welcome');
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; phase: DexGuidePhase }>).detail;
      if (detail.id === dentistaId) setPhaseState(detail.phase);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [dentistaId]);

  const setPhase = useCallback((next: DexGuidePhase) => {
    localStorage.setItem(KEY(dentistaId), next);
    setPhaseState(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { id: dentistaId, phase: next } }));
  }, [dentistaId]);

  return { phase, setPhase };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

---

## Task 3 — Componente DexMascot (personagem + caixinha)

**Arquivo:** `src/components/onboarding/dex-mascot.tsx` (criar)

O personagem: bloco arredondado teal com **olhinhos = retângulos arredondados altos**, pulsando enquanto fala. A caixinha de fala tem borda teal. `role="status"` + `aria-live="polite"` pra leitores de tela. Botão "Pular" sempre acessível (teclado).

```tsx
'use client';

import { motion } from 'motion/react';
import { prefersReducedMotion } from '@/hooks/useDexGuide';

interface DexMascotProps {
  step: number;
  totalSteps: number;
  text: string;
  onSkip?: () => void;
}

const TEAL = '#2f9c85';

export function DexFace({ size = 48 }: { size?: number }) {
  const reduce = prefersReducedMotion();
  const eyeW = size * 0.14;
  const eyeH = size * 0.32; // retângulos altos
  return (
    <motion.div
      style={{
        width: size, height: size, borderRadius: size * 0.32,
        background: `linear-gradient(135deg, ${TEAL} 0%, #1a7a65 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.12,
        flexShrink: 0,
      }}
      animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {[0, 1].map(i => (
        <motion.span
          key={i}
          style={{ width: eyeW, height: eyeH, borderRadius: eyeW, background: '#fff' }}
          animate={reduce ? undefined : { scaleY: [1, 0.15, 1] }}
          transition={{ duration: 0.24, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut', delay: 0.4 }}
        />
      ))}
    </motion.div>
  );
}

export function DexMascot({ step, totalSteps, text, onSkip }: DexMascotProps) {
  return (
    <div className="fixed bottom-7 right-7 z-[120] flex items-end gap-2.5 max-w-[360px]" role="status" aria-live="polite">
      <div className="bg-surface border-[1.5px] rounded-2xl px-4 py-3 shadow-xl" style={{ borderColor: TEAL }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold" style={{ color: TEAL }}>
            Dex · passo {step} de {totalSteps}
          </span>
          {onSkip && (
            <button onClick={onSkip} className="text-[11px] text-text-secondary hover:text-text-primary transition-colors">
              Pular
            </button>
          )}
        </div>
        <p className="text-[13px] text-text-primary leading-relaxed">{text}</p>
      </div>
      <DexFace size={52} />
    </div>
  );
}
```

---

## Task 4 — Componente DexGuide (orquestrador do dashboard)

**Arquivo:** `src/components/onboarding/dex-guide.tsx` (criar)

Cena de abertura (reaproveita o visual do slide 1: tela escura, DEX no centro, texto embaixo) → "Começar" anima o fechamento e troca pra fase `point_demo`. Saudação por horário + nome.

```tsx
'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useDexGuide, prefersReducedMotion } from '@/hooks/useDexGuide';
import { DexFace, DexMascot } from './dex-mascot';

const TEAL = '#2f9c85';

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

interface DexGuideProps {
  nome: string;
  dentistaId: string;
}

export function DexGuide({ nome, dentistaId }: DexGuideProps) {
  const { phase, setPhase } = useDexGuide(dentistaId);
  const firstName = nome.split(' ')[0];
  const reduce = prefersReducedMotion();

  return (
    <>
      {/* ── Cena de abertura ── */}
      <AnimatePresence>
        {phase === 'welcome' && (
          <motion.div
            key="welcome"
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(47,156,133,0.07) 0%, transparent 70%), rgba(0,0,0,0.95)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              onClick={() => setPhase('done')}
              className="absolute top-6 right-6 text-sm font-medium text-white/30 hover:text-white/60 transition-colors"
            >
              Pular
            </button>

            <motion.div
              className="flex flex-col items-center text-center gap-7 px-6 max-w-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <DexFace size={72} />
              <div className="flex flex-col gap-3">
                <h1 className="font-heading text-4xl md:text-5xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                  {saudacao()}, Dr(a). {firstName}.
                </h1>
                <p className="text-lg text-white/55 leading-relaxed max-w-md">
                  Eu sou o Dex, seu copiloto no sistema. Em 1 minuto eu te mostro como nunca mais digitar uma ficha.
                </p>
              </div>
              <motion.button
                onClick={() => setPhase('point_demo')}
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="px-8 py-3.5 rounded-2xl font-bold text-base text-white"
                style={{ background: TEAL, boxShadow: '0 8px 32px rgba(47,156,133,0.4)' }}
              >
                Começar →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mascote no canto apontando pra demo ── */}
      <AnimatePresence>
        {phase === 'point_demo' && (
          <motion.div
            key="mascot"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -120 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
          >
            <DexMascot
              step={1}
              totalSteps={3}
              text="Deixei um paciente demo pronto pra você testar. Clique no botão que está brilhando 👇"
              onSkip={() => setPhase('done')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

**Montagem** em `dashboard-shell.tsx` (substitui o `DexWelcome` removido na Task 1), só para não-secretária:

```tsx
import { DexGuide } from "@/components/onboarding/dex-guide";
// ...
{role !== 'secretaria' && <DexGuide nome={nome} dentistaId={dentistaId} />}
```

---

## Task 5 — Derivação dos 5 passos (server)

**Arquivo:** `src/lib/onboarding-progress.ts` (criar)

```ts
import { createClient } from '@/lib/supabase/server';

export interface PassoProgresso {
  id: 'demo' | 'paciente' | 'consulta_real' | 'planejamento' | 'procedimentos';
  done: boolean;
}

export interface OnboardingProgresso {
  passos: PassoProgresso[];
  completos: number;
  total: number;
}

export async function getOnboardingProgresso(
  clinicaId: string,
  dentistaId: string,
): Promise<OnboardingProgresso> {
  const supabase = await createClient();

  const [pacientes, consultaReal, planejamentos, clinica] = await Promise.all([
    supabase.from('pacientes').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId),
    supabase.from('fichas').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId).eq('origem', 'modo_consulta'),
    supabase.from('planejamentos').select('id', { count: 'exact', head: true })
      .eq('clinica_id', clinicaId),
    supabase.from('clinicas').select('procedimentos_pendente')
      .eq('id', clinicaId).maybeSingle<{ procedimentos_pendente: boolean }>(),
  ]);

  // "demo" não persiste no banco → vem de flag separada lida no client (localStorage).
  // "procedimentos" = concluído quando NÃO está pendente (Task 8). Usar tabela padrão
  // ou importar zera o flag; "Configurar depois" mantém pendente.
  const passos: PassoProgresso[] = [
    { id: 'demo',           done: false },
    { id: 'paciente',       done: (pacientes.count ?? 0) > 0 },
    { id: 'consulta_real',  done: (consultaReal.count ?? 0) > 0 },
    { id: 'planejamento',   done: (planejamentos.count ?? 0) > 0 },
    { id: 'procedimentos',  done: clinica.data?.procedimentos_pendente === false },
  ];

  const completos = passos.filter(p => p.done).length;
  return { passos, completos, total: passos.length };
}
```

---

## Task 6 — Card de primeiros passos

**Arquivo:** `src/components/dashboard/primeiros-passos-card.tsx` (criar)

Recebe o progresso do server. O passo `demo` faz OR com flag local (`dex_demo_done_v1_${id}`). Contém o botão de entrada da demo (passo 1), que pulsa quando `phase === 'point_demo'`. Dispensável (localStorage). Some em 100%.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X, ChevronRight, Mic } from 'lucide-react';
import { useDexGuide } from '@/hooks/useDexGuide';
import type { OnboardingProgresso } from '@/lib/onboarding-progress';

const PASSO_LABEL: Record<string, { label: string; href: string }> = {
  demo:          { label: 'Experimente o Modo Consulta', href: '/consulta/demo' },
  paciente:      { label: 'Cadastre seu primeiro paciente', href: '/dashboard/pacientes/novo' },
  consulta_real: { label: 'Faça sua primeira consulta com o DEX', href: '/dashboard/agendamentos' },
  planejamento:  { label: 'Apresente um planejamento', href: '/dashboard/pacientes' },
  procedimentos: { label: 'Configure seus procedimentos', href: '/dashboard/configuracoes?aba=procedimentos' },
};

const DISMISS_KEY = (id: string) => `dex_passos_dismiss_v1_${id}`;
const DEMO_DONE_KEY = (id: string) => `dex_demo_done_v1_${id}`;

interface Props {
  progresso: OnboardingProgresso;
  dentistaId: string;
}

export function PrimeirosPassosCard({ progresso, dentistaId }: Props) {
  const router = useRouter();
  const { phase, setPhase } = useDexGuide(dentistaId);
  const [dismissed, setDismissed] = useState(true);
  const [demoLocalDone, setDemoLocalDone] = useState(false);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY(dentistaId)));
    setDemoLocalDone(!!localStorage.getItem(DEMO_DONE_KEY(dentistaId)));
  }, [dentistaId]);

  const passos = progresso.passos.map(p =>
    p.id === 'demo' ? { ...p, done: p.done || demoLocalDone } : p
  );
  const completos = passos.filter(p => p.done).length;
  const pct = Math.round((completos / progresso.total) * 100);

  if (dismissed || completos === progresso.total) return null;

  const entrarDemo = () => {
    if (phase === 'point_demo') setPhase('in_demo');
    router.push('/consulta/demo');
  };

  const dispensar = () => {
    localStorage.setItem(DISMISS_KEY(dentistaId), '1');
    setDismissed(true);
    if (phase !== 'done') setPhase('done');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-3xl border border-teal/20 bg-teal/[0.04] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-text-primary">Primeiros passos</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-teal font-bold">{completos} de {progresso.total}</span>
          <button onClick={dispensar} aria-label="Dispensar primeiros passos"
            className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-teal/15 overflow-hidden mb-4">
        <motion.div className="h-full bg-teal" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }} />
      </div>

      <div className="flex flex-col gap-2">
        {passos.map(p => {
          const meta = PASSO_LABEL[p.id];
          const isDemoStep = p.id === 'demo';
          const pulse = isDemoStep && !p.done && phase === 'point_demo';
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                p.done ? 'bg-teal text-white' : 'border-[1.5px] border-teal/40'}`}>
                {p.done && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
              {isDemoStep && !p.done ? (
                <button
                  onClick={entrarDemo}
                  className={`flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-1.5 rounded-xl transition-all ${
                    pulse ? 'animate-pulse ring-2 ring-teal/50' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #2f9c85, #1a7a65)' }}
                >
                  <Mic className="w-3.5 h-3.5" /> Entrar no Modo Consulta
                </button>
              ) : (
                <button
                  onClick={() => !p.done && router.push(meta.href)}
                  disabled={p.done}
                  className={`flex items-center gap-1 text-sm text-left ${
                    p.done ? 'text-text-secondary line-through' : 'text-text-primary hover:text-teal'}`}
                >
                  {meta.label}
                  {!p.done && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
```

**Montagem** em `src/app/dashboard/page.tsx` (dentro do bloco dentista, antes do `<Suspense>`):

```tsx
import { getOnboardingProgresso } from '@/lib/onboarding-progress';
import { PrimeirosPassosCard } from '@/components/dashboard/primeiros-passos-card';
// ...
const progresso = await getOnboardingProgresso(dentista.clinica_id, dentista.id);
// no JSX, dentro da <div> do dashboard dentista:
<PrimeirosPassosCard progresso={progresso} dentistaId={dentista.id} />
```

---

## Task 7 — Coach dentro da demo + frase de valor

**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` (modificar)

Quando `isDemo` e o guia está ativo (`dex_guide_phase_v1` ∈ {`point_demo`, `in_demo`}), mostrar a caixinha do DEX guiando por estado, e ao entrar (aptStatus `in_progress`) exibir "Deixa que eu cuido do resto. Foque no paciente." que some em ~6s. Ao salvar a demo, gravar `dex_demo_done_v1` e fase `done`.

### 7.1 — Import do hook e da face

```tsx
import { useDexGuide } from '@/hooks/useDexGuide';
import { DexFace } from '@/components/onboarding/dex-mascot';
```

### 7.2 — Estado do coach (dentro do componente, só relevante em demo)

```tsx
const { phase, setPhase } = useDexGuide(/* dentistaId */ 'demo-guide');
const [valuePhrase, setValuePhrase] = useState(false);

useEffect(() => {
  if (!isDemo) return;
  if (aptStatus === 'in_progress' && !valuePhrase) {
    setValuePhrase(true);
    const t = setTimeout(() => setValuePhrase(false), 6000);
    return () => clearTimeout(t);
  }
}, [isDemo, aptStatus, valuePhrase]);
```

> O `dentistaId` real não está nas props da consulta. Opções: (a) passar `dentistaId` como prop do `/consulta/demo/page.tsx` (já temos `dentista.id` lá) e repassar ao ConsultaClient; (b) usar uma chave fixa de demo. Recomendado (a) — adicionar `dentistaId?: string` à `ConsultaClientProps`.

### 7.3 — Texto do coach por estado

```tsx
const coachText = !evolucao
  ? (aptStatus === 'in_progress'
      ? 'Fale a queixa do João — ou digite. Ex: "dor no molar inferior direito ao mastigar". Depois clique em Organizar com DEX.'
      : 'Clique em Iniciar Atendimento pra ativar o Modo Consulta.')
  : (saved ? 'Pronto! Montei a ficha sozinho.' : 'Viu? Estruturei tudo. Confira e salve.');
```

### 7.4 — Render do coach (faixa fixa, só em demo, guia ativo)

```tsx
{isDemo && phase !== 'done' && (
  <div className="fixed bottom-7 right-7 z-[120] flex items-end gap-2.5 max-w-[360px]" role="status" aria-live="polite">
    <div className="bg-surface border-[1.5px] border-teal rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-[13px] text-text-primary leading-relaxed">
        {valuePhrase ? 'Deixa que eu cuido do resto. Foque no paciente.' : coachText}
      </p>
    </div>
    <DexFace size={52} />
  </div>
)}
```

### 7.5 — Ao salvar a demo, encerrar o guia

No bloco `if (isDemo) { ... }` do `handleSalvar` (Task 2 do sprint anterior), após `setSaved(true)`:

```tsx
if (typeof window !== 'undefined') {
  // dentistaId real via prop; fallback p/ chave passada
  localStorage.setItem(`dex_demo_done_v1_${dentistaId ?? 'guide'}`, '1');
}
setPhase('done');
```

---

## Task 8 — Procedimentos: opção "Configurar depois" + alerta âmbar

### 8.1 — Migração: flag de pendência

**Arquivo:** `supabase/migrations/20260614000001_075_procedimentos_pendente.sql` (criar)

```sql
ALTER TABLE clinicas
  ADD COLUMN IF NOT EXISTS procedimentos_pendente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN clinicas.procedimentos_pendente IS
  'true quando o dentista escolheu "Configurar depois" no onboarding; mostra alerta âmbar nas configurações até configurar.';
```

Aplicar via MCP `apply_migration`.

### 8.2 — Server action: marcar/limpar pendência

**Arquivo:** `src/app/onboarding/actions.ts` (adicionar)

```ts
export async function definirProcedimentosPendente(pendente: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from('clinica_membros').select('clinica_id').eq('user_id', user.id).maybeSingle<{ clinica_id: string }>();
  if (!membership) return { error: 'Sem clínica.' };
  const { error } = await supabase
    .from('clinicas').update({ procedimentos_pendente: pendente }).eq('id', membership.clinica_id);
  if (error) return { error: error.message };
  return {};
}
```

> Confirmar o nome real da tabela/coluna de vínculo dentista↔clínica (pode ser `clinica_membros`, `dentistas.clinica_id`, etc.) na hora — usar `requireClinicContext` se já entregar o `clinicId`.

### 8.3 — Onboarding: 3ª opção "Configurar depois"

**Arquivo:** `src/app/onboarding/_components/onboarding-client.tsx` (modificar o step `procedimentos`)

Adicionar um terceiro botão abaixo dos dois existentes:

```tsx
<button
  type="button"
  onClick={async () => {
    await definirProcedimentosPendente(true);
    setStep('sucesso');
  }}
  className="w-full text-center text-sm font-semibold text-text-secondary hover:text-text-primary py-2 transition-colors"
>
  Configurar depois
</button>
```

E nos dois botões existentes ("Usar tabela padrão" e "Importar minha tabela"), garantir `definirProcedimentosPendente(false)` antes de seguir (resolve a pendência).

### 8.4 — Configurações: badge âmbar pulsante na aba Procedimentos

**Arquivo:** `src/app/dashboard/configuracoes/_components/configuracoes-client.tsx`

Já existe o padrão `showBadge = id === 'perfil' && !dentista.cro` (~linha 363). Adicionar análogo para procedimentos, lendo `config.procedimentos_pendente` (passar via props se ainda não vier). O badge usa âmbar pulsante:

```tsx
const showBadge =
  (id === 'perfil' && !dentista.cro) ||
  (id === 'procedimentos' && procedimentosPendente);
```

No render do badge (no item de nav), quando for procedimentos, aplicar cor âmbar + `animate-pulse`:

```tsx
{showBadge && (
  <span className={`ml-auto w-2 h-2 rounded-full ${
    id === 'procedimentos' ? 'bg-amber-500 animate-pulse' : 'bg-amber-500'}`} aria-hidden="true" />
)}
```

### 8.5 — Limpar pendência ao configurar

**Arquivo:** `src/app/dashboard/configuracoes/actions.ts` (ou onde vivem `criarProcedimento` / `atualizarProcedimento` / import)

Em `criarProcedimento`, `atualizarProcedimento` e na importação de tabela, após sucesso, setar `procedimentos_pendente = false` na clínica (o dentista configurou). Uma linha de `update` no mesmo handler.

---

## Verificação

1. `npx tsc --noEmit` — sem erros novos nos arquivos tocados.
2. Fluxo novo usuário (limpar localStorage `dex_*` + banco sem fichas):
   - Login → cena de abertura com saudação por horário + nome
   - "Começar" → cena fecha, DEX sobe pro canto, caixinha aparece
   - Card de primeiros passos no topo, botão "Entrar no Modo Consulta" pulsando teal
   - Clica → `/consulta/demo` → caixinha guia: iniciar → falar → organizar → salvar
   - Ao iniciar atendimento: frase "Deixa que eu cuido do resto" some em ~6s
   - Salvar demo → volta dashboard → passo 1 marcado, guia encerrado, FAB normal no canto
3. `prefers-reduced-motion`: ativar no SO → sem voo/pulso, só fade.
4. Acessibilidade: caixinha lida por leitor de tela (`aria-live`); "Pular" alcançável por teclado; foco visível.
5. Usuário existente (já tem fichas): card mostra passos já marcados; sem cena de abertura (fase `done`).
6. Dispensar o card → some e não volta.

---

## Já resolvido (fora deste plano)

- **Confirmação de email:** já existe. `cadastro-form.tsx` usa `supabase.auth.signUp`; se a confirmação está pendente, redireciona pra `/verifique-email`; `auth/callback` valida o OTP. Ação: só garantir que o toggle "Confirm email" está ligado no projeto Supabase.

## Fora de escopo (próximos temas)

- Tema C — métricas (frequência-alvo + TTV): a coluna `fichas.origem` já existe; falta a query/painel.
- Tema D — gatilhos D1/D3/D7: templates prontos; falta o cron (pg_cron).
