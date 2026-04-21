'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Bot, ArrowRight, ChevronRight, ChevronLeft, X, Loader2, Sparkles, Check } from 'lucide-react';
import { SimAgendamento }     from './sim-agendamento';
import { SimOrcamento }       from './sim-orcamento';
import { SimPerfilPaciente }  from './sim-perfil-paciente';
import type { PlanoId }   from '@/lib/planos';

// Chaves escopadas por dentista
const onboardingKey = (id: string) => `dex_onboarding_v1_${id}`;
const tourStepKey   = (id: string) => `dex_tour_v2_step_${id}`;

export const DEX_ONBOARDING_KEY = 'dex_onboarding_v1'; // mantido para DexWidget

// ── Constants ─────────────────────────────────────────────────────────────────
const DEX_SIZE     = 76;
const DEX_FAB_SIZE = 56;
const BUBBLE_W     = 320;

// ── Types ─────────────────────────────────────────────────────────────────────
type StepId = 'INTRO' | 'AGENDA' | 'PACIENTES' | 'PERFIL_PACIENTE' | 'ORCAMENTOS' | 'FINANCEIRO' | 'WHATSAPP' | 'CONFIG_EQUIPE' | 'CONFIG_CLINICA' | 'FINALE';

interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
  simulacao?: 'agendamento' | 'perfilPaciente' | 'orcamento';
  details?: string;
  bullets?: string[];
}

interface Rect { top: number; left: number; right: number; bottom: number; width: number; height: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function dexNear(rect: Rect, dims: { w: number; h: number }): { top: number; left: number } {
  const centX = Math.max(8, Math.min(rect.left + rect.width / 2 - DEX_SIZE / 2, dims.w - DEX_SIZE - 8));
  const aboveTop = rect.top - DEX_SIZE - 22;
  if (aboveTop > 60) return { top: aboveTop, left: centX };
  const rightLeft = rect.right + 22;
  if (rightLeft + DEX_SIZE < dims.w - 8)
    return { top: Math.max(8, rect.top + rect.height / 2 - DEX_SIZE / 2), left: rightLeft };
  return { top: rect.bottom + 22, left: centX };
}

function bubbleNear(
  dexPos: { top: number; left: number },
  dims: { w: number; h: number },
): { top: number; left: number } {
  const rightLeft = dexPos.left + DEX_SIZE + 14;
  if (rightLeft + BUBBLE_W < dims.w - 8) return { top: dexPos.top, left: rightLeft };
  const leftLeft = dexPos.left - BUBBLE_W - 14;
  if (leftLeft > 8) return { top: dexPos.top, left: leftLeft };
  return {
    top: dexPos.top + DEX_SIZE + 14,
    left: Math.max(8, Math.min(dexPos.left - BUBBLE_W / 2 + DEX_SIZE / 2, dims.w - BUBBLE_W - 8)),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DexIcon({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(145deg, #34b094 0%, #1a7965 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
      boxShadow: [
        '0 0 0 3px rgba(47,156,133,0.22)',
        '0 0 28px rgba(47,156,133,0.65)',
        '0 0 56px rgba(47,156,133,0.22)',
        '0 8px 32px rgba(0,0,0,0.55)',
      ].join(', '),
    }}>
      <Bot style={{ width: size * 0.48, height: size * 0.48, color: '#fff', strokeWidth: 1.75 }} />
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ border: '2px solid rgba(47,156,133,0.6)' }}
        animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function FloatingDex({ layoutId, size }: { layoutId?: string; size?: number }) {
  const s = size ?? DEX_SIZE;
  return (
    <motion.div layoutId={layoutId} layout transition={{ type: 'spring', damping: 24, stiffness: 200 }}>
      <motion.div animate={{ y: [0, -13, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
        <DexIcon size={s} />
      </motion.div>
    </motion.div>
  );
}

function Spotlight({ rect }: { rect: Rect }) {
  const pad = 10;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: rect.top - pad, left: rect.left - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        borderRadius: 14,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.74)',
        border: '2px solid rgba(47,156,133,0.80)',
        outline: '5px solid rgba(47,156,133,0.15)',
        zIndex: 9995, pointerEvents: 'none',
      }}
    />
  );
}

function CurvedArrow({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) {
  const cp1x = fromX + (toX - fromX) * 0.30;
  const cp1y = fromY;
  const cp2x = fromX + (toX - fromX) * 0.70;
  const cp2y = toY;
  const d = `M ${fromX} ${fromY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${toX} ${toY}`;
  const angle = (Math.atan2(toY - cp2y, toX - cp2x) * 180) / Math.PI;
  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9996, overflow: 'visible' }}>
      <motion.path
        d={d} stroke="#2f9c85" strokeWidth="2.5" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut', delay: 0.35 }}
      />
      <motion.polygon
        points="-7,-4 0,0 -7,4"
        transform={`translate(${toX},${toY}) rotate(${angle})`}
        fill="#2f9c85"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.95 }}
      />
    </svg>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div key={i}
          animate={{ width: i === current ? 18 : 5, opacity: i <= current ? 1 : 0.28 }}
          transition={{ duration: 0.3 }}
          style={{ height: 5, borderRadius: 3, background: '#2f9c85' }}
        />
      ))}
    </div>
  );
}

function NavRow({ onBack, onNext, showBack, label }: { onBack: () => void; onNext: () => void; showBack: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-0.5">
      {showBack && (
        <button onClick={onBack}
          className="flex items-center gap-1 py-1.5 px-3 rounded-lg font-semibold text-xs transition-all hover:opacity-80 active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', color: 'rgba(255,255,255,0.6)' }}
        >
          <ChevronLeft className="w-3 h-3" /> Voltar
        </button>
      )}
      <button onClick={onNext}
        className="flex items-center gap-1.5 py-1.5 px-4 rounded-lg font-bold text-xs text-white transition-all hover:opacity-90 active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 4px 14px -4px rgba(47,156,133,0.55)' }}
      >
        {label} <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DexOnboardingProps { nome: string; dentistaId: string; role?: string; plano?: PlanoId }

export function DexOnboarding({ nome, dentistaId, role = 'owner', plano }: DexOnboardingProps) {
  const router   = useRouter();
  const pathname = usePathname();

  const [active,        setActive]        = useState(false);
  const [stepIndex,     setStepIndex]     = useState(0);
  const [targetRect,    setTargetRect]    = useState<Rect | null>(null);
  const [dims,          setDims]          = useState({ w: 1440, h: 900 });
  const [transitioning, setTransitioning] = useState(false);
  const [bubbleReady,   setBubbleReady]   = useState(false);
  const navigatingRef = useRef(false);

  const firstName = nome.split(' ')[0];

  const STEPS = useMemo<TourStep[]>(() => {
    const perfilPacienteStep: TourStep = {
      id: 'PERFIL_PACIENTE',
      path: '/dashboard/pacientes/demo',
      title: 'Prontuário Digital Completo',
      description: 'Ficha clínica, documentos e orçamentos do paciente em um só lugar. O DEX preenche evolução clínica por voz e identifica os dentes automaticamente.',
      bullets: [
        'Evolução clínica: grave por voz, a IA transcreve e identifica dentes',
        'Documentos: fotos, raio-x e PDFs organizados por data',
        'Orçamentos: gerado a partir do planejamento e enviado pelo WhatsApp',
      ],
      simulacao: 'perfilPaciente',
    };

    const orcamentoStep: TourStep = {
      id: 'ORCAMENTOS',
      path: '/dashboard/orcamentos',
      title: 'Orçamentos e Pagamentos',
      description: 'Todos os orçamentos da clínica em um painel. Acompanhe status, aprove, envie pelo WhatsApp e registre pagamentos — tudo sem sair da tela.',
      bullets: [
        'Status em tempo real: rascunho → enviado → aprovado',
        'DEX simplifica o orçamento em linguagem acessível para o paciente',
        'Secretária registra pagamentos direto na recepção',
      ],
      simulacao: 'orcamento',
    };

    const financeiroStep: TourStep = {
      id: 'FINANCEIRO',
      path: '/dashboard/financeiro',
      title: 'Financeiro sem Planilhas',
      description: 'Veja receitas, despesas e lucro real da clínica em tempo real. As receitas entram automaticamente quando pagamentos são registrados — você só lança as despesas.',
      targetId: 'financeiro-link',
      bullets: [
        'Despesas fixas e variáveis registradas em segundos',
        'Receitas geradas automaticamente pelos pagamentos',
        'Gráfico de lucro líquido mês a mês',
      ],
    };

    if (role === 'secretaria') {
      return [
        {
          id: 'INTRO',
          path: '/dashboard',
          title: '',
          description: `Olá, ${firstName}! Eu sou o DEX — a IA do DentIA. Você é a central de operações da clínica e eu vou te mostrar tudo que precisa saber em menos de 2 minutos. Vamos?`,
        },
        {
          id: 'AGENDA',
          path: '/dashboard/agendamentos',
          title: 'Central de Agendamentos',
          description: 'Aqui chegam todos os pedidos de consulta — inclusive os do bot do WhatsApp. Confirme, reagende ou cancele sem precisar ligar para ninguém.',
          bullets: [
            'Pedidos do bot do WhatsApp caem direto aqui',
            'Veja a agenda de todos os dentistas ao mesmo tempo',
            'Confirme, edite ou cancele com um clique',
          ],
          simulacao: 'agendamento' as const,
        },
        {
          id: 'ORCAMENTOS',
          path: '/dashboard/orcamentos',
          title: 'Orçamentos e Pagamentos',
          description: 'Acompanhe todos os orçamentos gerados pelos dentistas. Quando o paciente pagar, registre aqui na recepção — o sistema atualiza o status automaticamente.',
          bullets: [
            'Veja o valor aprovado e o que ainda está pendente',
            'Registre pagamentos em 2 cliques (dinheiro, PIX, cartão)',
            'Histórico de pagamentos automático por paciente',
          ],
          simulacao: 'orcamento' as const,
        },
        { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Qualquer dúvida, é só me chamar aqui no canto. Bom trabalho e bom atendimento!' },
      ];
    }

    if (role === 'dentista') {
      return [
        {
          id: 'INTRO',
          path: '/dashboard',
          title: '',
          description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX. Em 2 minutos você vai ver como atender mais, escrever menos e receber mais rápido — tudo com IA. Vamos lá?`,
        },
        {
          id: 'AGENDA',
          path: '/dashboard/agendamentos',
          title: 'Agenda no Piloto Automático',
          description: 'A secretária e o bot do WhatsApp organizam tudo aqui. Você chega na clínica e a agenda já está montada — sem ligações, sem conflitos de horário.',
          bullets: [
            'Agendamentos pelo WhatsApp chegam automaticamente',
            'Conflitos de horário bloqueados na hora',
            'Você só foca no atendimento',
          ],
          simulacao: 'agendamento' as const,
        },
        perfilPacienteStep,
        orcamentoStep,
        financeiroStep,
        { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Me chame sempre que precisar — estou aqui no canto da tela. Bom atendimento, Doutor(a)!' },
      ];
    }

    // admin (owner)
    const temEquipe = plano === 'BASICO' || plano === 'CLINICA';

    return [
      {
        id: 'INTRO',
        path: '/dashboard',
        title: '',
        description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX, a IA do DentIA. Em 2 minutos você vai ver como sua clínica vai rodar no piloto automático — agenda, fichas, orçamentos, financeiro e bot WhatsApp. Vamos?`,
      },
      {
        id: 'AGENDA',
        path: '/dashboard/agendamentos',
        title: 'Agenda que se Organiza Sozinha',
        description: 'Pacientes agendam pelo WhatsApp a qualquer hora, 24h por dia. O bot verifica disponibilidade, evita conflitos e registra tudo aqui — sem uma ligação.',
        bullets: [
          'Agendamentos 24h pelo bot do WhatsApp',
          'Conflitos de horário bloqueados automaticamente',
          'Secretária confirma ou reagenda com um clique',
        ],
        simulacao: 'agendamento' as const,
      },
      perfilPacienteStep,
      orcamentoStep,
      financeiroStep,
      {
        id: 'WHATSAPP',
        path: '/dashboard/bot',
        title: 'Bot WhatsApp 24h',
        description: 'O bot atende seus pacientes a qualquer hora: identifica quem é, coleta dados, mostra os dentistas disponíveis e confirma o horário — tudo automático.',
        targetId: 'whatsapp-link',
        bullets: [
          'Funciona 24h sem precisar de ninguém na recepção',
          'Cria o perfil do paciente novo automaticamente',
          'Conecte seu WhatsApp em menos de 1 minuto aqui',
        ],
      },
      ...(temEquipe ? [{
        id: 'CONFIG_EQUIPE' as const,
        path: '/dashboard/configuracoes',
        title: 'Adicione sua Equipe',
        description: 'Cadastre sua secretária agora — com ela no sistema, o bot funciona no piloto automático, os pagamentos são registrados na recepção e você não perde nenhum detalhe.',
        details: 'Sem secretária cadastrada, o fluxo de agendamento automático fica incompleto.',
        targetId: 'dex-tour-equipe',
      }] : []),
      {
        id: 'CONFIG_CLINICA',
        path: '/dashboard/configuracoes',
        title: 'Configure em 2 Minutos',
        description: 'Defina seus horários de atendimento e a tabela de procedimentos com preços — esses dados alimentam o bot, o agendamento e os orçamentos gerados pela IA.',
        targetId: 'dex-tour-procedimentos',
        bullets: [
          'Horários de atendimento por dia da semana',
          'Catálogo de procedimentos com preço padrão',
          'Bot usa esses dados para confirmar disponibilidade',
        ],
      },
      { id: 'FINALE', path: '/dashboard', title: 'Sua clínica inteligente começa agora!', description: 'Me chame sempre que precisar — estou aqui no canto. Bom trabalho, Doutor(a)!' },
    ];
  }, [role, firstName, plano]);

  const NAV_STEPS = useMemo(() => STEPS.filter(s => s.id !== 'INTRO' && s.id !== 'FINALE'), [STEPS]);
  const step = STEPS[stepIndex];

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(onboardingKey(dentistaId))) return;

    setDims({ w: window.innerWidth, h: window.innerHeight });
    const saved = localStorage.getItem(tourStepKey(dentistaId));
    const idx   = saved ? parseInt(saved, 10) : 0;
    setStepIndex(isNaN(idx) ? 0 : idx);

    const welcomeOpen = new URLSearchParams(window.location.search).get('welcome') === 'true';
    if (welcomeOpen) {
      let postWelcomeTimer: ReturnType<typeof setTimeout> | null = null;
      const onDismissed = () => {
        postWelcomeTimer = setTimeout(() => setActive(true), 600);
      };
      window.addEventListener('welcome-modal-dismissed', onDismissed, { once: true });
      return () => {
        window.removeEventListener('welcome-modal-dismissed', onDismissed);
        if (postWelcomeTimer !== null) clearTimeout(postWelcomeTimer);
      };
    }

    const t = setTimeout(() => setActive(true), 900);
    return () => clearTimeout(t);
  }, [dentistaId]);

  // ── Navigate to correct page ──────────────────────────────────────────────
  useEffect(() => {
    if (!active || !step) return;
    if (pathname === step.path) {
      navigatingRef.current = false;
      setTransitioning(false);
      return;
    }
    if (!navigatingRef.current) {
      navigatingRef.current = true;
      setTransitioning(true);
      const t = setTimeout(() => router.push(step.path), 1400);
      return () => {
        clearTimeout(t);
        navigatingRef.current = false;
      };
    }
  }, [active, step, pathname, router]);

  // ── Bubble appears after DEX settles ─────────────────────────────────────
  useEffect(() => {
    setBubbleReady(false);
    if (!active) return;
    const delay = step?.simulacao ? 1200 : 520;
    const t = setTimeout(() => setBubbleReady(true), delay);
    return () => clearTimeout(t);
  }, [stepIndex, active, step?.simulacao]);

  // ── Measure spotlight target ──────────────────────────────────────────────
  useEffect(() => {
    setTargetRect(null);
    if (!active || !step?.targetId || pathname !== step.path) return;
    const measure = () => {
      const r = getRect(step.targetId!);
      if (r) { setTargetRect(r); return; }
      setTimeout(() => setTargetRect(getRect(step.targetId!)), 400);
    };
    const t = setTimeout(measure, 260);
    return () => clearTimeout(t);
  }, [active, step, pathname]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const complete = useCallback(() => {
    localStorage.setItem(onboardingKey(dentistaId), 'done');
    localStorage.removeItem(tourStepKey(dentistaId));
    window.dispatchEvent(new Event('dex-onboarding-done'));
    setActive(false);
  }, [dentistaId]);

  const skip = useCallback(() => complete(), [complete]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= STEPS.length) { complete(); return; }
    setTargetRect(null);
    setBubbleReady(false);
    setStepIndex(idx);
    localStorage.setItem(tourStepKey(dentistaId), String(idx));
  }, [complete, dentistaId, STEPS.length]);

  const next = useCallback(() => goTo(stepIndex + 1), [stepIndex, goTo]);
  const back = useCallback(() => goTo(stepIndex - 1), [stepIndex, goTo]);

  if (!active || !step) return null;

  const navIdx    = NAV_STEPS.findIndex(s => s.id === step.id);
  const isLast    = stepIndex === STEPS.length - 1;
  const centerLeft = dims.w / 2 - DEX_SIZE / 2;
  const centerTop  = dims.h / 2 - DEX_SIZE / 2 - 90;
  const fabLeft    = dims.w - 24 - DEX_FAB_SIZE;
  const fabTop     = dims.h - 24 - DEX_FAB_SIZE;

  const SkipBtn = (
    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      onClick={skip}
      className="fixed top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10 backdrop-blur-sm"
      style={{ color: 'rgba(255,255,255,0.45)', zIndex: 9999 }}
    >
      <X className="w-3.5 h-3.5" /> Pular Tour
    </motion.button>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TRANSITION OVERLAY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (transitioning) {
    return (
      <motion.div
        key="transition"
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: 'rgba(0,0,0,0.90)', zIndex: 9999 }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        {SkipBtn}
        <motion.div layoutId="dex-spotlight" layout transition={{ type: 'spring', damping: 24, stiffness: 200 }}>
          <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <DexIcon size={88} />
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#2f9c85' }} />
          Vamos para a próxima tela...
        </motion.p>
      </motion.div>
    );
  }

  if (pathname !== step.path) return null;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INTRO — full-screen with dramatic entrance
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step.id === 'INTRO') {
    return (
      <>
        <motion.div
          className="fixed inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, rgba(47,156,133,0.08) 0%, rgba(0,0,0,0.82) 70%)',
            backdropFilter: 'blur(4px)',
            zIndex: 9990,
          }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />

        {/* Particle dots background */}
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9991 }}>
          {[...Array(6)].map((_, i) => (
            <motion.div key={i}
              className="absolute rounded-full"
              style={{
                width: 3, height: 3,
                background: 'rgba(47,156,133,0.4)',
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 20}%`,
              }}
              animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 2.8 + i * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
            />
          ))}
        </div>

        <motion.div className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 9999 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {SkipBtn}

          <motion.div
            layoutId="dex-spotlight" layout
            transition={{ type: 'spring', damping: 24, stiffness: 200 }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
              <DexIcon size={110} />
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {bubbleReady && (
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 18, stiffness: 160 }}
                className="mt-8 w-[380px] max-w-[92vw] rounded-3xl px-8 py-7 relative"
                style={{
                  background: 'linear-gradient(160deg, rgba(13,13,15,0.99) 0%, rgba(9,22,20,0.99) 100%)',
                  border: '1.5px solid rgba(47,156,133,0.45)',
                  boxShadow: '0 32px 80px -12px rgba(0,0,0,0.95), 0 0 60px rgba(47,156,133,0.14)',
                }}
              >
                {/* Tail pointing up */}
                <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-5 h-5 rotate-45"
                  style={{ background: 'rgba(13,13,15,0.99)', borderTop: '1.5px solid rgba(47,156,133,0.45)', borderLeft: '1.5px solid rgba(47,156,133,0.45)' }} />

                <div className="flex items-center gap-2 mb-4 justify-center">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#2f9c85' }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2f9c85' }}>DEX — IA do DentIA</span>
                </div>

                <p className="text-white/90 text-sm leading-relaxed mb-6 text-center">{step.description}</p>

                <button onClick={next}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 8px 32px -4px rgba(47,156,133,0.60)' }}
                >
                  Ver o sistema em ação <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FINALE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step.id === 'FINALE') {
    return (
      <>
        <motion.div className="fixed inset-0"
          style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9990, pointerEvents: 'none' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />

        <motion.div className="fixed inset-0" style={{ zIndex: 9999, pointerEvents: 'none' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {/* Center success badge */}
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 160 }}
            className="fixed top-[30%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
            style={{ pointerEvents: 'none' }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 0 40px rgba(47,156,133,0.5)' }}>
              <Check className="w-8 h-8 text-white" />
            </div>
            <p className="text-white font-bold text-xl tracking-wide">Tour concluído!</p>
          </motion.div>

          {/* DEX glides to FAB corner */}
          <motion.div
            style={{ position: 'fixed', width: DEX_SIZE, height: DEX_SIZE }}
            initial={{ x: centerLeft, y: centerTop, scale: 1 }}
            animate={{
              x: fabLeft - (DEX_SIZE - DEX_FAB_SIZE) / 2,
              y: fabTop  - (DEX_SIZE - DEX_FAB_SIZE) / 2,
              scale: DEX_FAB_SIZE / DEX_SIZE,
            }}
            transition={{ type: 'spring', damping: 18, stiffness: 90, delay: 0.3 }}
          >
            <DexIcon size={DEX_SIZE} />
          </motion.div>

          {/* Bubble to the left of FAB */}
          <motion.div
            initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.6 }}
            className="fixed rounded-2xl px-5 py-4"
            style={{
              right: 24 + DEX_FAB_SIZE + 14, bottom: 16, width: 240,
              background: 'rgba(9,9,11,0.97)',
              border: '1.5px solid rgba(47,156,133,0.5)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#2f9c85' }}>Eu moro aqui!</p>
            <p className="text-white/80 text-sm leading-relaxed">{step.description}</p>
            <div className="absolute right-[-9px] top-1/2 -translate-y-1/2 w-4 h-4 rotate-45"
              style={{ background: 'rgba(9,9,11,0.97)', borderTop: '1.5px solid rgba(47,156,133,0.5)', borderRight: '1.5px solid rgba(47,156,133,0.5)' }} />
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2"
            style={{ pointerEvents: 'auto' }}
          >
            <button onClick={complete}
              className="flex items-center gap-2 py-3.5 px-10 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 8px 32px -4px rgba(47,156,133,0.60)' }}
            >
              Começar a usar agora <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      </>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIMULATION steps — FULL-SCREEN SPLIT PANEL
  // Left 40%: DEX + content card | Right 60%: simulation at full scale
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step.simulacao) {
    const nextLabel = isLast ? 'Concluir' : 'Próximo';

    return (
      <motion.div
        key={`sim-panel-${step.id}`}
        className="fixed inset-0 flex"
        style={{ zIndex: 9990 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* ── LEFT PANEL ── */}
        <div
          className="relative flex flex-col items-center justify-center shrink-0 px-10"
          style={{
            width: '40%',
            background: 'linear-gradient(160deg, rgba(5,14,12,0.99) 0%, rgba(0,0,0,0.99) 100%)',
            borderRight: '1px solid rgba(47,156,133,0.18)',
          }}
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(47,156,133,0.07) 0%, transparent 65%)',
          }} />

          <div className="relative w-full max-w-[320px] flex flex-col items-start gap-6">
            {/* DEX icon + label */}
            <div className="flex items-center gap-3">
              <motion.div
                layoutId="dex-spotlight"
                layout
                transition={{ type: 'spring', damping: 22, stiffness: 180 }}
              >
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
                  <DexIcon size={52} />
                </motion.div>
              </motion.div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#2f9c85' }}>DEX</p>
                <p className="text-white/40 text-[10px]">Inteligência Artificial</p>
              </div>
            </div>

            {/* Step tag */}
            <div>
              <AnimatePresence>
                {bubbleReady && (
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#2f9c85' }}>
                      {step.title}
                    </p>
                    <p className="text-white/85 text-sm leading-relaxed mb-5">
                      {step.description}
                    </p>

                    {/* Bullet points */}
                    {step.bullets && step.bullets.length > 0 && (
                      <ul className="flex flex-col gap-2.5 mb-6">
                        {step.bullets.map((bullet, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.12, type: 'spring', damping: 22, stiffness: 200 }}
                            className="flex items-start gap-2.5"
                          >
                            <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(47,156,133,0.18)', border: '1px solid rgba(47,156,133,0.35)' }}>
                              <Check className="w-2.5 h-2.5" style={{ color: '#2f9c85' }} />
                            </div>
                            <span className="text-white/65 text-xs leading-relaxed">{bullet}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-col gap-3">
                      <StepDots total={NAV_STEPS.length} current={navIdx} />
                      <NavRow onBack={back} onNext={next} showBack={stepIndex > 1} label={nextLabel} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Skip btn */}
          <button onClick={skip}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <X className="w-3.5 h-3.5" /> Pular Tour
          </button>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.75)' }}
        >
          {/* Subtle radial glow behind simulation */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at center, rgba(47,156,133,0.06) 0%, transparent 65%)',
          }} />

          <AnimatePresence mode="wait">
            {step.simulacao === 'agendamento'    && <SimAgendamento    key="sim-ag" />}
            {step.simulacao === 'perfilPaciente' && <SimPerfilPaciente key="sim-perfil" />}
            {step.simulacao === 'orcamento'      && <SimOrcamento      key="sim-or" />}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SPOTLIGHT steps — CONFIG_EQUIPE & CONFIG_CLINICA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!step.simulacao && step.id !== 'INTRO' && step.id !== 'FINALE') {
    const dexPos    = targetRect ? dexNear(targetRect, dims) : { top: centerTop, left: centerLeft };
    const bubblePos = bubbleNear(dexPos, dims);
    const arrowToX  = targetRect ? targetRect.left + targetRect.width  / 2 : dims.w / 2;
    const arrowToY  = targetRect ? targetRect.top  + targetRect.height / 2 : dims.h / 2;
    const nextLabel = isLast ? 'Concluir' : 'Próximo';

    return (
      <LayoutGroup>
        {targetRect
          ? <Spotlight key={`spot-${step.id}`} rect={targetRect} />
          : <motion.div key="spot-fallback" className="fixed inset-0"
              style={{ background: 'rgba(0,0,0,0.74)', zIndex: 9990 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        }

        <div style={{ position: 'fixed', zIndex: 9999 }}>{SkipBtn}</div>

        <motion.div
          layoutId="dex-spotlight" layout
          style={{ position: 'fixed', top: dexPos.top, left: dexPos.left, zIndex: 9997 }}
          transition={{ type: 'spring', damping: 24, stiffness: 200 }}
        >
          <motion.div animate={{ y: [0, -11, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <DexIcon size={DEX_SIZE} />
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {targetRect && bubbleReady && (
            <CurvedArrow key={`arrow-${step.id}`}
              fromX={dexPos.left + DEX_SIZE / 2} fromY={dexPos.top  + DEX_SIZE / 2}
              toX={arrowToX} toY={arrowToY}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {bubbleReady && (
            <motion.div
              key={`bubble-${step.id}`}
              style={{ position: 'fixed', top: bubblePos.top, left: bubblePos.left, zIndex: 9999, width: BUBBLE_W }}
              initial={{ opacity: 0, scale: 0.88, x: -12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.92, x: 8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            >
              <div className="rounded-2xl px-5 py-4"
                style={{
                  background: 'rgba(9,9,11,0.97)',
                  border: '1.5px solid rgba(47,156,133,0.45)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 28px rgba(47,156,133,0.10)',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#2f9c85' }}>
                  {step.title}
                </p>
                <p className="text-white/82 text-sm leading-relaxed mb-3">{step.description}</p>
                {step.details && (
                  <p className="text-white/50 text-xs leading-relaxed mb-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {step.details}
                  </p>
                )}
                <StepDots total={NAV_STEPS.length} current={navIdx} />
                <NavRow onBack={back} onNext={next} showBack={stepIndex > 0} label={nextLabel} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    );
  }

  return null;
}
