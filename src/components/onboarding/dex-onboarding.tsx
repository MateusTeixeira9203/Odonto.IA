'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Bot, ArrowRight, ChevronRight, ChevronLeft, X, Loader2 } from 'lucide-react';
import { SimAgendamento } from './sim-agendamento';
import { SimFicha }       from './sim-ficha';
import { SimOrcamento }   from './sim-orcamento';
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
type StepId = 'INTRO' | 'AGENDA' | 'PACIENTES' | 'FICHA_AHA' | 'ORCAMENTOS' | 'FINANCEIRO' | 'CONFIG_EQUIPE' | 'CONFIG_CLINICA' | 'FINALE';

interface TourStep {
  id: StepId;
  path: string;
  title: string;
  description: string;
  targetId?: string;
  simulacao?: 'agendamento' | 'ficha' | 'orcamento';
  details?: string;
}

interface Rect { top: number; left: number; right: number; bottom: number; width: number; height: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/** Position DEX as close to the target as possible, above or to its right */
function dexNear(rect: Rect, dims: { w: number; h: number }): { top: number; left: number } {
  const centX = Math.max(8, Math.min(rect.left + rect.width / 2 - DEX_SIZE / 2, dims.w - DEX_SIZE - 8));
  const aboveTop = rect.top - DEX_SIZE - 22;
  if (aboveTop > 60) return { top: aboveTop, left: centX };

  const rightLeft = rect.right + 22;
  if (rightLeft + DEX_SIZE < dims.w - 8)
    return { top: Math.max(8, rect.top + rect.height / 2 - DEX_SIZE / 2), left: rightLeft };

  return { top: rect.bottom + 22, left: centX };
}

/** Position bubble near DEX without overflowing */
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

/** Bold, solid DEX robot — circular with teal gradient and glowing ring */
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
      {/* Pulsing glow ring */}
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ border: '2px solid rgba(47,156,133,0.6)' }}
        animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** DEX with continuous float — use layoutId for same-page glide */
function FloatingDex({ layoutId, size }: { layoutId?: string; size?: number }) {
  const s = size ?? DEX_SIZE;
  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
    >
      <motion.div
        animate={{ y: [0, -13, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <DexIcon size={s} />
      </motion.div>
    </motion.div>
  );
}

/** Spotlight cutout — box-shadow dims everything outside the rect */
function Spotlight({ rect }: { rect: Rect }) {
  const pad = 10;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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

/** Self-drawing curved arrow */
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

/** Progress dots */
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

/** Reusable nav row */
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

  const [active,       setActive]       = useState(false);
  const [stepIndex,    setStepIndex]    = useState(0);
  const [targetRect,   setTargetRect]   = useState<Rect | null>(null);
  const [dims,         setDims]         = useState({ w: 1440, h: 900 });
  const [transitioning, setTransitioning] = useState(false);
  const [bubbleReady,  setBubbleReady]  = useState(false);
  const navigatingRef = useRef(false);

  const firstName = nome.split(' ')[0];

  const STEPS = useMemo<TourStep[]>(() => {
    const ahaMoment: TourStep = {
      id: 'FICHA_AHA',
      path: '/dashboard/pacientes/demo',
      title: 'Ficha Clínica — o coração do sistema',
      description: 'Fale ou digita a evolução e a IA transcreve, identifica cada procedimento — como "dente 46, restauração" — e já monta o orçamento com sua tabela de preços. Zero digitação manual.',
      details: 'Na aba Documentos você centraliza fotos clínicas, raio-x e arquivos do paciente, tudo organizado por data e vinculado à ficha.',
      simulacao: 'ficha',
    };

    const orcamentoStep: TourStep = {
      id: 'ORCAMENTOS',
      path: '/dashboard/orcamentos',
      title: 'Orçamentos Inteligentes',
      description: 'Orçamento gerado em segundos pela IA com os preços da sua tabela. Pronto para enviar ao paciente.',
      simulacao: 'orcamento',
    };

    if (role === 'secretaria') {
      return [
        {
          id: 'INTRO',
          path: '/dashboard',
          title: '',
          description: `Olá, ${firstName}! Eu sou o DEX. Seu perfil é de secretária — vou te mostrar como usar o sistema no dia a dia. Vamos lá?`,
        },
        {
          id: 'AGENDA',
          path: '/dashboard/agendamentos',
          title: 'Sua Principal Ferramenta',
          description: 'Aqui você gerencia a agenda de todos os dentistas da clínica. Novos agendamentos chegam pelo bot do WhatsApp e aparecem aqui automaticamente.',
          details: 'Você também pode criar, editar e cancelar consultas manualmente por esta tela.',
          simulacao: 'agendamento' as const,
        },
        {
          id: 'ORCAMENTOS',
          path: '/dashboard/orcamentos',
          title: 'Orçamentos dos Pacientes',
          description: 'Acompanhe os orçamentos gerados pelos dentistas. Você pode consultar o status de cada um e registrar pagamentos recebidos.',
          simulacao: 'orcamento' as const,
        },
        { id: 'FINALE', path: '/dashboard', title: 'Tudo pronto!', description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom trabalho!' },
      ];
    }

    if (role === 'dentista') {
      return [
        { id: 'INTRO',    path: '/dashboard',            title: '',                      description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX. Vou te mostrar o sistema em 1 minuto. Vamos lá?` },
        { id: 'AGENDA',   path: '/dashboard/agendamentos', title: 'Sua Agenda',          description: 'Acompanhe seus pacientes do dia. O bot do WhatsApp agenda consultas direto aqui.', simulacao: 'agendamento' as const },
        ahaMoment,
        orcamentoStep,
        { id: 'FINALE',   path: '/dashboard',            title: 'Tudo pronto!',          description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom atendimento!' },
      ];
    }

    // admin (owner)
    const temEquipe = plano === 'BASICO' || plano === 'CLINICA';

    return [
      { id: 'INTRO',        path: '/dashboard',              title: '',                         description: `Olá, Doutor(a) ${firstName}! Eu sou o DEX. Vou te mostrar o sistema em 1 minuto. Vamos lá?` },
      { id: 'AGENDA',       path: '/dashboard/agendamentos', title: 'Agenda Inteligente',       description: 'Sua agenda integrada ao bot de WhatsApp. Pacientes agendados lá aparecem aqui na hora.', simulacao: 'agendamento' as const },
      ahaMoment,
      orcamentoStep,
      ...(temEquipe ? [{
        id: 'CONFIG_EQUIPE' as const,
        path: '/dashboard/configuracoes',
        title: 'Adicione sua Secretária',
        description: 'Seu plano inclui secretária. Cadastre-a aqui agora — com ela no sistema, o bot do WhatsApp agenda consultas automaticamente e você foca só nos atendimentos.',
        details: 'Sem secretária cadastrada, o agendamento automático por WhatsApp não funciona.',
        targetId: 'dex-tour-equipe',
      }] : []),
      { id: 'CONFIG_CLINICA', path: '/dashboard/configuracoes', title: 'Configurações Essenciais', description: 'Defina seus horários e sua tabela de preços para que eu possa gerar orçamentos com precisão.', targetId: 'dex-tour-procedimentos' },
      { id: 'FINALE',       path: '/dashboard',              title: 'Tudo pronto!',             description: 'Se precisar de ajuda, é só me chamar aqui no canto. Bom trabalho, Doutor(a)!' },
    ];
  }, [role, firstName, plano]);

  const NAV_STEPS = useMemo(() => STEPS.filter(s => s.id !== 'INTRO' && s.id !== 'FINALE'), [STEPS]);
  const step = STEPS[stepIndex];

  // ── Init (first visit only) ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(onboardingKey(dentistaId))) return;

    setDims({ w: window.innerWidth, h: window.innerHeight });
    const saved = localStorage.getItem(tourStepKey(dentistaId));
    const idx   = saved ? parseInt(saved, 10) : 0;
    setStepIndex(isNaN(idx) ? 0 : idx);

    // Usuários convidados chegam com ?welcome=true na URL, o que faz o
    // WelcomeModal abrir ao mesmo tempo que o tour DEX. Para evitar sobreposição,
    // aguardamos o modal ser dispensado antes de ativar o tour.
    const welcomeOpen = new URLSearchParams(window.location.search).get('welcome') === 'true';

    if (welcomeOpen) {
      let postWelcomeTimer: ReturnType<typeof setTimeout> | null = null;
      const onDismissed = () => {
        // Pequena pausa para o modal terminar sua animação de saída
        postWelcomeTimer = setTimeout(() => setActive(true), 600);
      };
      window.addEventListener('welcome-modal-dismissed', onDismissed, { once: true });
      return () => {
        window.removeEventListener('welcome-modal-dismissed', onDismissed);
        if (postWelcomeTimer !== null) clearTimeout(postWelcomeTimer);
      };
    }

    // Fluxo normal: dentista que criou a clínica, sem modal de boas-vindas
    const t = setTimeout(() => setActive(true), 900);
    return () => clearTimeout(t);
  }, [dentistaId]);

  // ── Navigate to correct page with transition message ──────────────────────
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
      // Wait 1400ms (transition shown) then route
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
    // Steps com simulação: tooltip aparece 1.4s depois (simulação começa primeiro)
    const delay = step?.simulacao ? 1400 : 520;
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

  const navIdx = NAV_STEPS.findIndex(s => s.id === step.id);
  const isLast = stepIndex === STEPS.length - 1;
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
  // TRANSITION OVERLAY — shows while navigating to next page
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (transitioning) {
    return (
      <motion.div
        key="transition"
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: 'rgba(0,0,0,0.90)', zIndex: 9999 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {SkipBtn}
        <motion.div layoutId="dex-spotlight" layout transition={{ type: 'spring', damping: 24, stiffness: 200 }}>
          <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <DexIcon size={88} />
          </motion.div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#2f9c85' }} />
          Vamos para a próxima tela...
        </motion.p>
      </motion.div>
    );
  }

  // Guard: only render the step UI when on its page
  if (pathname !== step.path) return null;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INTRO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step.id === 'INTRO') {
    return (
      <>
        <motion.div
          className="fixed inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.68) 100%)',
            backdropFilter: 'blur(3px)',
            zIndex: 9990,
          }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        />

        <motion.div className="fixed inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 9999 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {SkipBtn}

          <motion.div layoutId="dex-spotlight" layout transition={{ type: 'spring', damping: 24, stiffness: 200 }}>
            <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
              <DexIcon size={108} />
            </motion.div>
          </motion.div>

          <AnimatePresence>
            {bubbleReady && (
              <motion.div
                initial={{ opacity: 0, y: 22, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 170 }}
                className="mt-8 w-[340px] max-w-[90vw] rounded-3xl px-8 py-7 relative"
                style={{
                  background: 'rgba(9,9,11,0.97)',
                  border: '1.5px solid rgba(47,156,133,0.4)',
                  boxShadow: '0 24px 64px -12px rgba(0,0,0,0.9), 0 0 48px rgba(47,156,133,0.12)',
                }}
              >
                {/* Bubble tail pointing up */}
                <div className="absolute -top-[10px] left-1/2 -translate-x-1/2 w-5 h-5 rotate-45"
                  style={{ background: 'rgba(9,9,11,0.97)', borderTop: '1.5px solid rgba(47,156,133,0.4)', borderLeft: '1.5px solid rgba(47,156,133,0.4)' }} />

                <p className="text-white/85 text-sm leading-relaxed mb-6 text-center">
                  Olá,{' '}
                  <strong style={{ color: '#2f9c85' }}>{firstName}</strong>!{' '}
                  Eu sou o <strong className="text-white">DEX</strong>, a inteligência artificial do DentIA.{' '}
                  Vou te mostrar como dominar sua clínica em 1 minuto. Vamos lá?
                </p>
                <button onClick={next}
                  className="w-full py-3 px-6 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 8px 28px -4px rgba(47,156,133,0.55)' }}
                >
                  Iniciar Tour <ArrowRight className="w-4 h-4" />
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
        <motion.div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.52)', zIndex: 9990, pointerEvents: 'none' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

        <motion.div className="fixed inset-0" style={{ zIndex: 9999, pointerEvents: 'none' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          {/* DEX glides from center to FAB corner */}
          <motion.div
            style={{ position: 'fixed', width: DEX_SIZE, height: DEX_SIZE }}
            initial={{ x: centerLeft, y: centerTop, scale: 1 }}
            animate={{
              x: fabLeft - (DEX_SIZE - DEX_FAB_SIZE) / 2,
              y: fabTop  - (DEX_SIZE - DEX_FAB_SIZE) / 2,
              scale: DEX_FAB_SIZE / DEX_SIZE,
            }}
            transition={{ type: 'spring', damping: 18, stiffness: 90, delay: 0.15 }}
          >
            <DexIcon size={DEX_SIZE} />
          </motion.div>

          {/* Bubble to the left of FAB */}
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.55 }}
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
            {/* Tail pointing right */}
            <div className="absolute right-[-9px] top-1/2 -translate-y-1/2 w-4 h-4 rotate-45"
              style={{ background: 'rgba(9,9,11,0.97)', borderTop: '1.5px solid rgba(47,156,133,0.5)', borderRight: '1.5px solid rgba(47,156,133,0.5)' }} />
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.1 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2"
            style={{ pointerEvents: 'auto' }}
          >
            <button onClick={complete}
              className="flex items-center gap-2 py-3 px-8 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)', boxShadow: '0 8px 28px -4px rgba(47,156,133,0.55)' }}
            >
              Começar a usar o DEX <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
      </>
    );
  }

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
                <p className="text-white/82 text-sm leading-relaxed mb-3">{step.description}</p>
                {step.details && (
                  <p className="text-white/50 text-xs leading-relaxed mb-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {step.details}
                  </p>
                )}
                <StepDots total={NAV_STEPS.length} current={navIdx} />
                <NavRow onBack={back} onNext={next} showBack={stepIndex > 1} label={nextLabel} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SPOTLIGHT steps — CONFIG_EQUIPE & CONFIG_CLINICA
  // DEX glides via layoutId; bubble appears after DEX settles
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (step.id === 'CONFIG_EQUIPE' || step.id === 'CONFIG_CLINICA') {
    const dexPos    = targetRect ? dexNear(targetRect, dims) : { top: centerTop, left: centerLeft };
    const bubblePos = bubbleNear(dexPos, dims);
    const arrowToX  = targetRect ? targetRect.left + targetRect.width  / 2 : dims.w / 2;
    const arrowToY  = targetRect ? targetRect.top  + targetRect.height / 2 : dims.h / 2;
    const nextLabel = isLast ? 'Concluir' : 'Próximo';

    return (
      <LayoutGroup>
        {/* Spotlight or fallback overlay */}
        {targetRect
          ? <Spotlight key={`spot-${step.id}`} rect={targetRect} />
          : <motion.div key="spot-fallback" className="fixed inset-0"
              style={{ background: 'rgba(0,0,0,0.74)', zIndex: 9990 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        }

        {/* Skip */}
        <div style={{ position: 'fixed', zIndex: 9999 }}>{SkipBtn}</div>

        {/* DEX — uses layoutId so it glides when stepIndex changes on same page */}
        <motion.div
          layoutId="dex-spotlight"
          layout
          style={{ position: 'fixed', top: dexPos.top, left: dexPos.left, zIndex: 9997 }}
          transition={{ type: 'spring', damping: 24, stiffness: 200 }}
        >
          <motion.div animate={{ y: [0, -11, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <DexIcon size={DEX_SIZE} />
          </motion.div>
        </motion.div>

        {/* Curved arrow DEX → target */}
        <AnimatePresence>
          {targetRect && bubbleReady && (
            <CurvedArrow key={`arrow-${step.id}`}
              fromX={dexPos.left + DEX_SIZE / 2}
              fromY={dexPos.top  + DEX_SIZE / 2}
              toX={arrowToX} toY={arrowToY}
            />
          )}
        </AnimatePresence>

        {/* Speech bubble — appears after DEX settles */}
        <AnimatePresence mode="wait">
          {bubbleReady && (
            <motion.div
              key={`bubble-${step.id}`}
              style={{ position: 'fixed', top: bubblePos.top, left: bubblePos.left, zIndex: 9999, width: BUBBLE_W }}
              initial={{ opacity: 0, scale: 0.88, x: -12 }}
              animate={{ opacity: 1, scale: 1,    x: 0 }}
              exit={{   opacity: 0, scale: 0.92,  x: 8 }}
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
