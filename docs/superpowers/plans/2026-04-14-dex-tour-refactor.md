# Plano: DEX Tour Refatorado com Simulações Visuais

**Data:** 2026-04-14  
**Spec:** `docs/superpowers/specs/2026-04-14-dex-tour-refactor-design.md`

---

## Goal
Substituir o tour DEX estático (que só aponta para elementos sem mostrar nada) por um tour cinematográfico que simula agendamento, evolução clínica e orçamento com animações visuais, sem tocar no banco.

## Architecture Overview
- 3 novos componentes de simulação (`SimAgendamento`, `SimFicha`, `SimOrcamento`)
- Refactor do `DexOnboarding` existente: INTRO mais suave, transições mais lentas, novo bloco de renderização unificado
- Zero dependências novas

## Tech Stack
- React, Next.js App Router, TypeScript estrito
- `motion/react` (Framer Motion) para todas as animações
- `lucide-react` para ícones

---

## File Structure

### Criar
- `src/components/onboarding/sim-agendamento.tsx`
- `src/components/onboarding/sim-ficha.tsx`
- `src/components/onboarding/sim-orcamento.tsx`

### Modificar
- `src/components/onboarding/dex-onboarding.tsx`

---

## Task 1: Criar SimAgendamento

**File:** `src/components/onboarding/sim-agendamento.tsx`

Modal fake de criação de agendamento. Campos digitam sozinhos em sequência, botão pulsa, modal fecha. Total ~5.5s.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, User, Stethoscope } from 'lucide-react';

function useTypingText(text: string, startDelay: number, speed = 70): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, startDelay, speed]);
  return displayed;
}

interface SimAgendamentoProps { onComplete?: () => void }

export function SimAgendamento({ onComplete }: SimAgendamentoProps) {
  const [visible, setVisible]   = useState(true);
  const [showSave, setShowSave] = useState(false);

  const paciente  = useTypingText('Ana Souza', 400, 75);
  const data      = useTypingText('15/05/2025', 1600, 65);
  const horario   = useTypingText('14:30', 2700, 80);
  const proc      = useTypingText('Limpeza + Avaliação', 3600, 55);

  useEffect(() => {
    const t1 = setTimeout(() => setShowSave(true), 4900);
    const t2 = setTimeout(() => { setVisible(false); onComplete?.(); }, 6200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9994 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Novo Agendamento</h3>
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Paciente */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Paciente</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <User className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 min-h-5">{paciente}<span className="animate-pulse opacity-60">|</span></span>
              </div>
            </div>

            {/* Data + Horário */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Data</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-800 min-h-5">{data}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Horário</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-800 min-h-5">{horario}</span>
                </div>
              </div>
            </div>

            {/* Procedimento */}
            <div className="mb-6">
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Procedimento</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-800 min-h-5">{proc}</span>
              </div>
            </div>

            {/* Botão salvar */}
            <AnimatePresence>
              {showSave && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)', boxShadow: '0 8px 24px -4px rgba(47,156,133,0.5)' }}
                >
                  Salvar Agendamento ✓
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Commit:** `feat: criar SimAgendamento — modal animado para o tour DEX`

---

## Task 2: Criar SimFicha

**File:** `src/components/onboarding/sim-ficha.tsx`

Painel de evolução clínica fake. Texto digita sozinho, dente 46 ilumina, badge de IA aparece. Total ~6s.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Sparkles } from 'lucide-react';

function useTypingText(text: string, startDelay: number, speed = 38): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, startDelay, speed]);
  return displayed;
}

const EVOLUCAO =
  'Paciente relata dor ao mastigar no lado direito. Verificado desgaste em dente 46 com necessidade de restauração. Solicitado raio-x periapical.';

// 38ms × 145 chars ≈ 5510ms + 500ms delay = ~6s total para o texto
const TYPING_DURATION = 500 + EVOLUCAO.length * 38;

interface SimFichaProps { onComplete?: () => void }

export function SimFicha({ onComplete }: SimFichaProps) {
  const [visible,    setVisible]    = useState(true);
  const [showTooth,  setShowTooth]  = useState(false);
  const [showBadge,  setShowBadge]  = useState(false);

  const evolucao = useTypingText(EVOLUCAO, 500, 38);

  useEffect(() => {
    const t1 = setTimeout(() => setShowTooth(true), TYPING_DURATION);
    const t2 = setTimeout(() => setShowBadge(true), TYPING_DURATION + 900);
    const t3 = setTimeout(() => { setVisible(false); onComplete?.(); }, TYPING_DURATION + 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9994 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-[480px] max-w-[92vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(47,156,133,0.1)' }}>
                <Mic className="w-4 h-4" style={{ color: '#2f9c85' }} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Evolução Clínica</h3>
                <p className="text-xs text-gray-400">Ana Souza · hoje</p>
              </div>
            </div>

            {/* Área de texto */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4 min-h-[100px]">
              <p className="text-sm text-gray-800 leading-relaxed">
                {evolucao}
                <span className="animate-pulse opacity-50">|</span>
              </p>
            </div>

            {/* Dente destacado */}
            <AnimatePresence>
              {showTooth && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="flex items-center gap-3 mb-4 p-3 rounded-xl"
                  style={{ background: 'rgba(47,156,133,0.07)', border: '1px solid rgba(47,156,133,0.2)' }}
                >
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(47,156,133,0.5)','0 0 0 10px rgba(47,156,133,0)','0 0 0 0 rgba(47,156,133,0)'] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-white shrink-0"
                    style={{ background: '#2f9c85' }}
                  >
                    46
                  </motion.div>
                  <span className="text-sm font-medium" style={{ color: '#2f9c85' }}>
                    Dente 46 identificado — restauração necessária
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge IA */}
            <AnimatePresence>
              {showBadge && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 py-3 px-4 rounded-xl w-full justify-center font-bold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)', boxShadow: '0 8px 24px -4px rgba(47,156,133,0.5)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  IA pronta para gerar orçamento
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Commit:** `feat: criar SimFicha — painel de evolução clínica animado para o tour DEX`

---

## Task 3: Criar SimOrcamento

**File:** `src/components/onboarding/sim-orcamento.tsx`

Card de orçamento fake. Itens aparecem um a um, total incrementa como contador, badge pisca. Total ~5.5s.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Sparkles } from 'lucide-react';

const ITEMS = [
  { descricao: 'Limpeza (Profilaxia)',   valor: 150 },
  { descricao: 'Restauração (Dente 46)', valor: 320 },
  { descricao: 'Avaliação Clínica',      valor: 80  },
] as const;

const TOTAL = ITEMS.reduce((s, i) => s + i.valor, 0); // 550

function useCounter(target: number, active: boolean, duration = 1100): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function fmt(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface SimOrcamentoProps { onComplete?: () => void }

export function SimOrcamento({ onComplete }: SimOrcamentoProps) {
  const [visible,      setVisible]      = useState(true);
  const [visibleItems, setVisibleItems] = useState(0);
  const [countActive,  setCountActive]  = useState(false);
  const [showBadge,    setShowBadge]    = useState(false);

  const total = useCounter(TOTAL, countActive);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleItems(1), 500),
      setTimeout(() => setVisibleItems(2), 1600),
      setTimeout(() => setVisibleItems(3), 2700),
      setTimeout(() => setCountActive(true),  3600),
      setTimeout(() => setShowBadge(true),    4700),
      setTimeout(() => { setVisible(false); onComplete?.(); }, 6000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 9994 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-6"
            style={{ border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(47,156,133,0.1)' }}>
                <FileText className="w-4 h-4" style={{ color: '#2f9c85' }} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Orçamento — Ana Souza</h3>
                <p className="text-xs text-gray-400">Gerado automaticamente pela IA</p>
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2 mb-4">
              {ITEMS.slice(0, visibleItems).map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                  style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
                >
                  <span className="text-sm text-gray-700">{item.descricao}</span>
                  <span className="text-sm font-semibold font-mono" style={{ color: '#2f9c85' }}>
                    {fmt(item.valor)}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Total counter */}
            <AnimatePresence>
              {countActive && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between py-3 px-4 rounded-xl mb-4"
                  style={{ background: 'rgba(47,156,133,0.06)', border: '1.5px solid rgba(47,156,133,0.18)' }}
                >
                  <span className="text-sm font-bold text-gray-900">Total</span>
                  <span className="font-mono font-bold text-lg" style={{ color: '#2f9c85' }}>{fmt(total)}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge */}
            <AnimatePresence>
              {showBadge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 18 }}
                  className="flex items-center gap-2 justify-center py-2.5 rounded-xl font-semibold text-xs"
                  style={{ background: 'rgba(47,156,133,0.10)', color: '#2f9c85' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Orçamento gerado por IA — pronto para enviar
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Commit:** `feat: criar SimOrcamento — card de orçamento animado para o tour DEX`

---

## Task 4: Atualizar tipos e definições de steps no DexOnboarding

**File:** `src/components/onboarding/dex-onboarding.tsx`

### 4a — Adicionar imports no topo do arquivo

Logo após os imports existentes de lucide-react, adicionar:
```tsx
import { SimAgendamento } from './sim-agendamento';
import { SimFicha }       from './sim-ficha';
import { SimOrcamento }   from './sim-orcamento';
```

### 4b — Atualizar `TourStep` interface (linha ~22)

**Antes:**
```tsx
interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
}
```

**Depois:**
```tsx
interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
  simulacao?: 'agendamento' | 'ficha' | 'orcamento';
}
```

### 4c — Atualizar definição do `ahaMoment` (linha ~224)

**Antes:**
```tsx
const ahaMoment: TourStep = {
  id: 'FICHA_AHA',
  path: '/dashboard/pacientes/demo',
  title: 'Mágica da Evolução Clínica',
  description: 'Aqui você digita ou dita sua evolução clínica. Baseado no que você escrever, eu puxo os procedimentos da sua tabela e gero o orçamento financeiro na mesma hora, sem você precisar calcular nada.',
  targetId: 'nova-evolucao-panel',
};
```

**Depois:**
```tsx
const ahaMoment: TourStep = {
  id: 'FICHA_AHA',
  path: '/dashboard/pacientes/demo',
  title: 'Evolução Clínica',
  description: 'Você fala ou digita a evolução — eu transcrevo e já separo os procedimentos para gerar o orçamento na hora.',
  simulacao: 'ficha',
};
```

### 4d — Criar `orcamentoStep` (adicionar logo após `ahaMoment`)

```tsx
const orcamentoStep: TourStep = {
  id: 'ORCAMENTOS',
  path: '/dashboard/orcamentos',
  title: 'Orçamentos Inteligentes',
  description: 'Orçamento gerado em segundos pela IA com os preços da sua tabela. Pronto para enviar ao paciente.',
  simulacao: 'orcamento',
};
```

### 4e — Atualizar STEPS por role

#### Role `secretaria`:
**Antes:**
```tsx
return [
  { id: 'INTRO', path: '/dashboard', title: '', description: `Olá, ${firstName}! Eu sou o DEX...` },
  { id: 'AGENDA', path: '/dashboard/agendamentos', title: 'Agenda & WhatsApp', description: '...' },
  { id: 'ORCAMENTOS', path: '/dashboard/orcamentos', title: 'Acompanhamento de Orçamentos', description: '...' },
  { id: 'FINANCEIRO', path: '/dashboard/financeiro', title: 'Gestão de Despesas', description: '...' },
  { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: '...' }
];
```
**Depois:**
```tsx
return [
  { id: 'INTRO', path: '/dashboard', title: '', description: `Olá, ${firstName}! Eu sou o DEX, seu assistente clínico. Vou te mostrar o sistema em 1 minuto. Vamos lá?` },
  { id: 'AGENDA', path: '/dashboard/agendamentos', title: 'Agenda & WhatsApp', description: 'Aqui você gerencia a agenda de todos os dentistas. O bot do WhatsApp também agenda consultas direto aqui.', simulacao: 'agendamento' },
  orcamentoStep,
  { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom trabalho!' },
];
```

#### Role `dentista`:
**Antes:**
```tsx
return [
  { id: 'INTRO', ... },
  { id: 'AGENDA', ... },
  ahaMoment,
  { id: 'FINALE', ... }
];
```
**Depois:**
```tsx
return [
  { id: 'INTRO', path: '/dashboard', title: '', description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX. Vou te mostrar o sistema em 1 minuto. Vamos lá?` },
  { id: 'AGENDA', path: '/dashboard/agendamentos', title: 'Sua Agenda', description: 'Acompanhe seus pacientes do dia. O bot do WhatsApp agenda consultas direto aqui.', simulacao: 'agendamento' },
  ahaMoment,
  orcamentoStep,
  { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom atendimento!' },
];
```

#### Role `admin` (bloco `return` final do `useMemo`):
**Antes:**
```tsx
return [
  { id: 'INTRO', ... },
  { id: 'AGENDA', ... },
  ahaMoment,
  { id: 'FINANCEIRO', ... },
  { id: 'CONFIG_EQUIPE', ... },
  { id: 'CONFIG_CLINICA', ... },
  { id: 'FINALE', ... }
];
```
**Depois:**
```tsx
return [
  { id: 'INTRO', path: '/dashboard', title: '', description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX. Vou te mostrar o sistema em 1 minuto. Vamos lá?` },
  { id: 'AGENDA', path: '/dashboard/agendamentos', title: 'Agenda Inteligente', description: 'Sua agenda integrada ao bot de WhatsApp. Pacientes agendados lá aparecem aqui na hora.', simulacao: 'agendamento' },
  ahaMoment,
  orcamentoStep,
  { id: 'CONFIG_EQUIPE', path: '/dashboard/configuracoes', title: 'Sua Equipe', description: 'Adicione sua secretária e outros dentistas. O DentIA cresce com a sua equipe!', targetId: 'dex-tour-equipe' },
  { id: 'CONFIG_CLINICA', path: '/dashboard/configuracoes', title: 'Configurações Essenciais', description: 'Defina seus horários e sua tabela de preços para que eu possa gerar orçamentos com precisão.', targetId: 'dex-tour-procedimentos' },
  { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom trabalho, Doutor(a)!' },
];
```

**Commit:** `refactor: atualizar tipos e definições de steps do tour DEX`

---

## Task 5: Suavizar INTRO e ajustar timing da transição

**File:** `src/components/onboarding/dex-onboarding.tsx`

### 5a — Suavizar overlay do INTRO (linha ~421)

**Antes:**
```tsx
<motion.div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.90)', zIndex: 9990 }}
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
```

**Depois:**
```tsx
<motion.div
  className="fixed inset-0"
  style={{
    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.68) 100%)',
    backdropFilter: 'blur(3px)',
    zIndex: 9990,
  }}
  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
/>
```

### 5b — Atualizar texto do INTRO (linha ~452)

**Antes:**
```tsx
Olá,{' '}
<strong style={{ color: '#2f9c85' }}>{firstName}</strong>!{' '}
Eu sou o <strong className="text-white">DEX</strong>, seu assistente clínico.
Vamos configurar sua clínica para o sucesso?
```

**Depois:**
```tsx
Olá,{' '}
<strong style={{ color: '#2f9c85' }}>{firstName}</strong>!{' '}
Eu sou o <strong className="text-white">DEX</strong>, a inteligência artificial do DentIA.{' '}
Vou te mostrar como dominar sua clínica em 1 minuto. Vamos lá?
```

### 5c — Desacelerar transição entre páginas (linha ~310)

**Antes:**
```tsx
const t = setTimeout(() => router.push(step.path), 850);
```

**Depois:**
```tsx
const t = setTimeout(() => router.push(step.path), 1400);
```

### 5d — Aumentar delay do bubble para steps com simulação (linha ~319)

**Antes:**
```tsx
useEffect(() => {
  setBubbleReady(false);
  if (!active) return;
  const t = setTimeout(() => setBubbleReady(true), 520);
  return () => clearTimeout(t);
}, [stepIndex, active]);
```

**Depois:**
```tsx
useEffect(() => {
  setBubbleReady(false);
  if (!active) return;
  // Steps com simulação: tooltip aparece 1.4s depois (simulação começa primeiro)
  const delay = step?.simulacao ? 1400 : 520;
  const t = setTimeout(() => setBubbleReady(true), delay);
  return () => clearTimeout(t);
}, [stepIndex, active, step?.simulacao]);
```

**Commit:** `refactor: suavizar INTRO do tour DEX e ajustar timings de transição`

---

## Task 6: Novo bloco de renderização unificado para steps com simulação

**File:** `src/components/onboarding/dex-onboarding.tsx`

### O que remover

Remover o bloco completo dos "CENTERED steps" (linha ~617 até o final do `return` — o último `return` do componente, que vai do `<>` até `</>`).

### O que adicionar

Adicionar **antes** do bloco `// SPOTLIGHT steps` (antes da linha ~542), o novo bloco de simulação:

```tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIMULATION steps — AGENDA / FICHA_AHA / ORCAMENTOS
// DEX fica no canto superior direito; simulação auto-play ao centro
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (step.simulacao) {
  const dexPos    = { top: 80, left: dims.w - DEX_SIZE - 80 };
  const bubblePos = bubbleNear(dexPos, dims);
  const nextLabel = isLast ? 'Concluir' : 'Próximo';

  return (
    <>
      {/* Overlay leve — simulação é o foco visual */}
      <motion.div className="fixed inset-0"
        style={{ background: 'rgba(0,0,0,0.52)', zIndex: 9990 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      />

      {/* Componente de simulação */}
      <AnimatePresence>
        {step.simulacao === 'agendamento' && <SimAgendamento key="sim-ag" />}
        {step.simulacao === 'ficha'       && <SimFicha       key="sim-fi" />}
        {step.simulacao === 'orcamento'   && <SimOrcamento   key="sim-or" />}
      </AnimatePresence>

      {/* Skip */}
      <div style={{ position: 'fixed', zIndex: 9999 }}>{SkipBtn}</div>

      {/* DEX — canto superior direito, glide via layoutId */}
      <motion.div
        layoutId="dex-spotlight"
        layout
        style={{ position: 'fixed', top: dexPos.top, left: dexPos.left, zIndex: 9997 }}
        transition={{ type: 'spring', damping: 22, stiffness: 180 }}
      >
        <motion.div animate={{ y: [0, -11, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
          <DexIcon size={DEX_SIZE} />
        </motion.div>
      </motion.div>

      {/* Bubble — aparece após delay estendido (simulação primeiro) */}
      <AnimatePresence mode="wait">
        {bubbleReady && (
          <motion.div
            key={`bubble-${step.id}`}
            style={{ position: 'fixed', top: bubblePos.top, left: bubblePos.left, zIndex: 9999, width: BUBBLE_W }}
            initial={{ opacity: 0, scale: 0.88, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.93, x: 8 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            <div className="rounded-2xl px-5 py-4"
              style={{
                background: 'rgba(9,9,11,0.97)',
                border: '1.5px solid rgba(47,156,133,0.45)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#2f9c85' }}>
                {step.title}
              </p>
              <p className="text-white/82 text-sm leading-relaxed mb-4">{step.description}</p>
              <StepDots total={NAV_STEPS.length} current={navIdx} />
              <NavRow onBack={back} onNext={next} showBack={stepIndex > 1} label={nextLabel} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

> **Nota:** O bloco `// SPOTLIGHT steps` existente (CONFIG_EQUIPE, CONFIG_CLINICA) continua exatamente como está, agora tratando apenas esses dois steps de configuração.

**Commit:** `feat: adicionar bloco de simulação ao tour DEX com overlay leve e DEX posicionado`

---

## Self-Review Checklist

- [x] **Spec coverage:** Tasks 1–3 cobrem as 3 simulações. Tasks 4–6 cobrem INTRO, transições, steps por role e renderer.
- [x] **Sem placeholders:** Todo código é completo, sem TBDs.
- [x] **Consistência de tipos:** `simulacao?: 'agendamento' | 'ficha' | 'orcamento'` é referenciado de forma idêntica em Task 4 (interface) e Task 6 (renderer).
- [x] **Sem referências futuras:** Tasks 1–3 são independentes. Task 4 depende apenas dos imports definidos na mesma task. Tasks 5–6 dependem dos steps atualizados na Task 4 — executar em ordem.
- [x] **Ordem de execução:** 1 → 2 → 3 → 4 → 5 → 6.
