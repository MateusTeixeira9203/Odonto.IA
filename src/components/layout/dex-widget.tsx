'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bot, ArrowLeft, Stethoscope, AlertTriangle, AlertCircle, Mail, CalendarX, UserMinus, TrendingUp, CalendarDays, DollarSign, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import type { DexContextData } from '@/app/api/dex/context/route';
import type { DexPatientContext } from '@/app/api/dex/patient-context/route';
import type { DexConsultationContext } from '@/app/api/dex/consultation-context/route';

const userOnboardingKey = (id: string) => `dex_onboarding_v1_${id}`;

interface DexWidgetProps {
  role: DentistaRole;
  plano?: PlanoId;
  nome: string;
  dentistaId: string;
  hideTrigger?: boolean;
}

export function DexWidget({ nome, dentistaId, hideTrigger }: DexWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen]           = useState(false);
  const [panelView, setPanelView]     = useState<'home' | 'insight'>('home');
  const [activeInsight, setActiveInsight] = useState<InsightItem | null>(null);
  const [isDark, setIsDark]           = useState(false);
  const [mounted, setMounted]         = useState(false);

  // ── Onboarding gate ──────────────────────────────────────────────────────────
  const [onboardingDone, setOnboardingDone]       = useState(false);
  const [showWelcomeBadge, setShowWelcomeBadge]   = useState(false);

  // ── Context ──────────────────────────────────────────────────────────────────
  const [barCtx, setBarCtx]                         = useState<DexContextData | null>(null);
  const [patientCtxPreload, setPatientCtxPreload]   = useState<DexPatientContext | null>(null);
  const [patientHasAlert, setPatientHasAlert]       = useState(false);
  const [consultaCtx, setConsultaCtx]               = useState<DexConsultationContext | null>(null);
  // Controla se os alertas de follow-up já foram vistos nesta sessão
  const [followUpSeen, setFollowUpSeen]             = useState(false);

  const patientId      = pathname?.match(/^\/dashboard\/pacientes\/([^/]+)$/)?.[1] ?? null;
  const consultaId     = pathname?.match(/^\/consulta\/([^/]+)/)?.[1] ?? null;
  const isPatientPage  = patientId !== null;
  const isConsultaPage = consultaId !== null;

  // Tema
  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    setIsDark(el.classList.contains('dark'));
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Listener externo — dock pode abrir/fechar via evento
  useEffect(() => {
    const handler = () => {
      setIsOpen(prev => {
        const opening = !prev;
        if (opening) {
          setPatientHasAlert(false);
          setFollowUpSeen(true);
        }
        return opening;
      });
    };
    window.addEventListener('dex-toggle', handler);
    return () => window.removeEventListener('dex-toggle', handler);
  }, []);

  // Onboarding gate — também aceita a chave legada "dex_welcome_v1_*"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const legacyKey = `dex_welcome_v1_${dentistaId}`;
    if (localStorage.getItem(userOnboardingKey(dentistaId)) || localStorage.getItem(legacyKey)) {
      setOnboardingDone(true);
      return;
    }
    const handler = () => {
      setOnboardingDone(true);
      setShowWelcomeBadge(true);
      setTimeout(() => setShowWelcomeBadge(false), 4000);
    };
    window.addEventListener('dex-onboarding-done', handler);
    return () => window.removeEventListener('dex-onboarding-done', handler);
  }, [dentistaId]);

  // Carrega contexto da barra
  useEffect(() => {
    if (!onboardingDone) return;
    fetch('/api/dex/context')
      .then((r) => r.json() as Promise<DexContextData>)
      .then((ctx) => setBarCtx(ctx))
      .catch(() => {});
  }, [onboardingDone]);

  // Pré-carrega contexto do paciente (perfil)
  useEffect(() => {
    if (!patientId || !onboardingDone) {
      setPatientCtxPreload(null);
      setPatientHasAlert(false);
      return;
    }
    fetch(`/api/dex/patient-context?patientId=${patientId}`)
      .then((r) => r.json() as Promise<DexPatientContext>)
      .then((ctx) => {
        if ('error' in ctx) return;
        setPatientCtxPreload(ctx);
        setPatientHasAlert(!!(ctx.fichasRecentes.length > 0 || ctx.orcamentosAbertos.length > 0));
      })
      .catch(() => {});
  }, [patientId, onboardingDone]);

  // Pré-carrega contexto da consulta ativa
  useEffect(() => {
    if (!consultaId || !onboardingDone) {
      setConsultaCtx(null);
      return;
    }
    fetch(`/api/dex/consultation-context?agendamentoId=${consultaId}`)
      .then((r) => r.json() as Promise<DexConsultationContext>)
      .then((ctx) => {
        if ('error' in ctx) return;
        setConsultaCtx(ctx);
      })
      .catch(() => {});
  }, [consultaId, onboardingDone]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPanelView('home');
    setActiveInsight(null);
  }, []);

  const handleNavigate = useCallback((href: string) => {
    handleClose();
    router.push(href);
  }, [handleClose, router]);

  const handleInsightClick = useCallback((insight: InsightItem) => {
    if (insight.items.length > 0) {
      setActiveInsight(insight);
      setPanelView('insight');
    } else {
      handleClose();
      router.push(insight.href);
    }
  }, [handleClose, router]);

  // ── Cores derivadas do tema ──────────────────────────────────────────────────
  const bg        = isDark ? '#0d0f0e' : '#ffffff';
  const textMain  = isDark ? 'rgba(255,255,255,0.92)' : '#0d1a18';
  const textMuted = isDark ? 'rgba(255,255,255,0.38)' : '#5a7a74';
  const rowBg     = isDark ? 'rgba(255,255,255,0.04)' : '#f5faf9';

  const firstName = nome.split(' ')[0];

  return (
    <>
      {/* ── Painel via Portal ─────────────────────────────────────────────────── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && onboardingDone && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 backdrop-blur-sm"
                style={{ zIndex: 998, background: isDark ? 'rgba(0,0,0,0.50)' : 'rgba(180,220,215,0.35)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
              />

              {/* Painel */}
              <motion.div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  width: '65vw',
                  height: '75vh',
                  zIndex: 999,
                  borderRadius: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: bg,
                  border: '2px solid #2f9c85',
                  boxShadow: isDark
                    ? '0 24px 80px -10px rgba(0,0,0,0.80), 0 0 0 1px rgba(47,156,133,0.15)'
                    : '0 24px 70px -10px rgba(47,156,133,0.22), 0 8px 32px rgba(0,0,0,0.12)',
                }}
                initial={{ opacity: 0, x: '-50%', y: '-46%', scale: 0.96 }}
                animate={{ opacity: 1, x: '-50%', y: '-50%', scale: 1    }}
                exit={{   opacity: 0, x: '-50%', y: '-46%', scale: 0.97 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              >
                <AnimatePresence mode="wait">
                  {panelView === 'insight' && activeInsight ? (
                    <InsightView
                      key="insight"
                      insight={activeInsight}
                      onBack={() => setPanelView('home')}
                      onClose={handleClose}
                      onNavigate={handleNavigate}
                      isDark={isDark}
                      bg={bg}
                      textMain={textMain}
                      textMuted={textMuted}
                      rowBg={rowBg}
                    />
                  ) : (
                    <HomeView
                      key="home"
                      ctx={barCtx}
                      firstName={firstName}
                      isPatientPage={isPatientPage}
                      patientHasAlert={patientHasAlert}
                      patientCtx={patientCtxPreload}
                      isConsultaPage={isConsultaPage}
                      consultaCtx={consultaCtx}
                      onInsightClick={handleInsightClick}
                      onClose={handleClose}
                      isDark={isDark}
                      bg={bg}
                      textMain={textMain}
                      textMuted={textMuted}
                      rowBg={rowBg}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* ── FAB circular — oculto quando dock assume o trigger ── */}
      <AnimatePresence>
        {onboardingDone && !hideTrigger && (
          <motion.div
            className="fixed bottom-7 right-7 z-40"
            initial={{ opacity: 0, scale: 0.6, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 16 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
          >
            <motion.button
              onClick={() => {
                const opening = !isOpen;
                setIsOpen(opening);
                if (opening) {
                  // Para o piscar ao abrir — o dentista "viu" os alertas
                  setPatientHasAlert(false);
                  setFollowUpSeen(true);
                }
              }}
              className="relative w-14 h-14 rounded-full flex items-center justify-center outline-none focus:outline-none focus-visible:outline-none overflow-visible"
              style={{
                background: isOpen
                  ? 'linear-gradient(135deg, #1a7a65 0%, #145f50 100%)'
                  : 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)',
                boxShadow: isOpen
                  ? '0 4px 20px -4px rgba(47,156,133,0.35)'
                  : patientHasAlert
                  ? '0 8px 32px -6px rgba(47,156,133,0.55), 0 0 0 2.5px rgba(251,191,36,0.50)'
                  : '0 8px 32px -6px rgba(47,156,133,0.55)',
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              aria-label={isOpen ? 'Fechar DEX' : 'Abrir DEX'}
            >
              {!isOpen && (patientHasAlert || (!followUpSeen && (barCtx?.followUpPendentes ?? 0) > 0)) && (
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(47,156,133,0.30)' }} />
              )}

              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div key="close" initial={{ opacity: 0, rotate: -90, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.6 }} transition={{ duration: 0.18 }}>
                    <X className="w-5 h-5 text-white" />
                  </motion.div>
                ) : (
                  <motion.div key="bot" initial={{ opacity: 0, rotate: 90, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -90, scale: 0.6 }} transition={{ duration: 0.18 }}>
                    <Bot className="w-5 h-5 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {!isOpen && patientHasAlert && (
                <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
              )}
              {!isOpen && !patientHasAlert && !followUpSeen && (barCtx?.followUpPendentes ?? 0) > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-white border-2 border-[#2f9c85]" />
              )}

              <AnimatePresence>
                {showWelcomeBadge && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                    onClick={(e) => { e.stopPropagation(); setShowWelcomeBadge(false); }}
                    className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-white text-teal text-[10px] font-bold cursor-pointer z-10 whitespace-nowrap"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                  >
                    Olá! 👋
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Home View ─────────────────────────────────────────────────────────────────

// ── Insights proativos ────────────────────────────────────────────────────────

interface InsightDetailItem {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

interface InsightItem {
  id: string;
  Icon: LucideIcon;
  label: string;
  sublabel: string;
  accent: 'red' | 'amber' | 'teal' | 'blue';
  href: string;
  items: InsightDetailItem[];
}

function gerarInsights(ctx: DexContextData): InsightItem[] {
  const items: InsightItem[] = [];

  if (ctx.orcamentosAtrasados30d > 0) {
    items.push({
      id: 'atrasados30',
      Icon: AlertCircle,
      label: `${ctx.orcamentosAtrasados30d} orçamento${ctx.orcamentosAtrasados30d > 1 ? 's' : ''} sem resposta há +30 dias`,
      sublabel: 'Risco de perder o tratamento',
      accent: 'red',
      href: '/dashboard/orcamentos',
      items: (ctx.orcamentosAtrasados30dList ?? []).map((o) => ({
        id: o.id,
        label: o.paciente,
        sublabel: `R$ ${o.total.toLocaleString('pt-BR')} · aguardando`,
        href: `/dashboard/pacientes/${o.pacienteId}`,
      })),
    });
  }

  if (ctx.followUpPendentes > 0) {
    items.push({
      id: 'followup',
      Icon: Mail,
      label: `${ctx.followUpPendentes} orçamento${ctx.followUpPendentes > 1 ? 's' : ''} aguardando retorno`,
      sublabel: 'Enviado há +3 dias sem resposta',
      accent: 'amber',
      href: '/dashboard/orcamentos',
      items: (ctx.followUpPendentesList ?? []).map((o) => ({
        id: o.id,
        label: o.paciente,
        sublabel: `R$ ${o.total.toLocaleString('pt-BR')} · enviado`,
        href: `/dashboard/pacientes/${o.pacienteId}`,
      })),
    });
  }

  if (ctx.orcamentosAprovadosSemAgendamento > 0) {
    items.push({
      id: 'aprov_sem_agenda',
      Icon: CalendarX,
      label: `${ctx.orcamentosAprovadosSemAgendamento} tratamento${ctx.orcamentosAprovadosSemAgendamento > 1 ? 's' : ''} aprovado${ctx.orcamentosAprovadosSemAgendamento > 1 ? 's' : ''} sem agendar`,
      sublabel: 'Paciente disse sim — falta marcar',
      accent: 'amber',
      href: '/dashboard/orcamentos',
      items: (ctx.orcamentosAprovadosSemAgendamentoList ?? []).map((o) => ({
        id: o.id,
        label: o.paciente,
        sublabel: `R$ ${o.total.toLocaleString('pt-BR')} · aprovado`,
        href: `/dashboard/pacientes/${o.pacienteId}`,
      })),
    });
  }

  if (ctx.pacientesInativos60d > 0) {
    const n = Math.min(ctx.pacientesInativos60d, 99);
    items.push({
      id: 'inativos',
      Icon: UserMinus,
      label: `${n}+ paciente${n > 1 ? 's' : ''} sem consulta há +60 dias`,
      sublabel: 'Momento ideal para reativar',
      accent: 'blue',
      href: '/dashboard/pacientes',
      items: (ctx.pacientesInativos60dList ?? []).map((p) => ({
        id: p.id,
        label: p.nome,
        sublabel: 'Sem consulta há +60 dias',
        href: `/dashboard/pacientes/${p.id}`,
      })),
    });
  }

  if (ctx.agendamentosAmanha > 0) {
    items.push({
      id: 'amanha',
      Icon: CalendarDays,
      label: `Amanhã: ${ctx.agendamentosAmanha} consulta${ctx.agendamentosAmanha > 1 ? 's' : ''} agendada${ctx.agendamentosAmanha > 1 ? 's' : ''}`,
      sublabel: 'Revise os briefings antes de começar',
      accent: 'teal',
      href: '/dashboard/agendamentos',
      items: [],
    });
  }

  if (ctx.orcamentosAprovadosSemana > 0 && items.length < 3) {
    items.push({
      id: 'aprovados_semana',
      Icon: TrendingUp,
      label: `${ctx.orcamentosAprovadosSemana} orçamento${ctx.orcamentosAprovadosSemana > 1 ? 's' : ''} aprovado${ctx.orcamentosAprovadosSemana > 1 ? 's' : ''} esta semana`,
      sublabel: 'Bom ritmo de conversão',
      accent: 'teal',
      href: '/dashboard/orcamentos',
      items: [],
    });
  }

  return items.slice(0, 4);
}

const INSIGHT_COLORS: Record<InsightItem['accent'], { bg: string; border: string; icon: string }> = {
  red:   { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.20)',   icon: '#ef4444' },
  amber: { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  icon: '#f59e0b' },
  teal:  { bg: 'rgba(47,156,133,0.08)',  border: 'rgba(47,156,133,0.22)',  icon: '#2f9c85' },
  blue:  { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.20)',  icon: '#3b82f6' },
};

// ── Insight View (drill-down) ─────────────────────────────────────────────────

interface InsightViewProps {
  insight: InsightItem;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (href: string) => void;
  isDark: boolean;
  bg: string;
  textMain: string;
  textMuted: string;
  rowBg: string;
}

function InsightView({
  insight, onBack, onClose, onNavigate,
  isDark, bg, textMain, textMuted, rowBg,
}: InsightViewProps) {
  const colors   = INSIGHT_COLORS[insight.accent];
  const divider  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(47,156,133,0.12)';
  const pageName = insight.href.includes('pacientes') ? 'Pacientes' : 'Orçamentos';

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 18 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-70"
            style={{ color: '#2f9c85' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 h-px" style={{ background: divider }} />
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-5 pb-5 space-y-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(255,255,255,0.08) transparent' : 'rgba(47,156,133,0.12) transparent',
        }}
      >
        {/* Badge do insight */}
        {(() => {
          const Icon = insight.Icon;
          return (
            <div
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
            >
              <div
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                style={{ background: colors.border }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: colors.icon }} />
              </div>
              <div>
                <p className="text-sm font-bold leading-snug" style={{ color: textMain }}>{insight.label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>{insight.sublabel}</p>
              </div>
            </div>
          );
        })()}

        {/* Lista de pacientes */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-0.5 mb-1">
            <div className="h-px flex-1" style={{ background: divider }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
              Pacientes envolvidos
            </span>
            <div className="h-px flex-1" style={{ background: divider }} />
          </div>

          {insight.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.href)}
              className="w-full rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all hover:brightness-105 text-left group"
              style={{ background: rowBg, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e8f0ef'}` }}
            >
              {/* Avatar inicial */}
              <div
                className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #2f9c85, #1a7a65)' }}
              >
                {item.label.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: textMain }}>{item.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>{item.sublabel}</p>
              </div>
              <ChevronRight
                className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                style={{ color: colors.icon }}
              />
            </button>
          ))}
        </div>

        {/* Botão "Ver todos" */}
        <button
          onClick={() => onNavigate(insight.href)}
          className="w-full py-3 rounded-xl text-xs font-bold transition-all hover:brightness-105 flex items-center justify-center gap-1.5"
          style={{ background: colors.bg, border: `1.5px solid ${colors.border}`, color: colors.icon }}
        >
          Ver todos em {pageName}
          <ChevronRight className="w-3 h-3" />
        </button>

        {/* Aviso se lista está truncada */}
        {insight.items.length >= 5 && (
          <p className="text-center text-[10px]" style={{ color: textMuted }}>
            Mostrando os 5 mais antigos · veja todos em {pageName}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  scheduled:   'Agendado',
  confirmed:   'Confirmado',
  checked_in:  'Na Recepção',
  in_progress: 'Em Atendimento',
  completed:   'Realizado',
  cancelled:   'Cancelado',
  no_show:     'Faltou',
};
const STATUS_DOT: Record<string, string> = {
  scheduled:   '#f59e0b',
  confirmed:   '#2f9c85',
  checked_in:  '#3b82f6',
  in_progress: '#8b5cf6',
  completed:   '#94a3b8',
  cancelled:   '#ef4444',
  no_show:     '#ef4444',
};

interface HomeViewProps {
  ctx: DexContextData | null;
  firstName: string;
  isPatientPage: boolean;
  patientHasAlert: boolean;
  patientCtx: DexPatientContext | null;
  isConsultaPage: boolean;
  consultaCtx: DexConsultationContext | null;
  onInsightClick: (insight: InsightItem) => void;
  onClose: () => void;
  isDark: boolean;
  bg: string;
  textMain: string;
  textMuted: string;
  rowBg: string;
}

function HomeView({
  ctx, firstName, isPatientPage, patientHasAlert, patientCtx,
  isConsultaPage, consultaCtx,
  onInsightClick, onClose,
  isDark, bg, textMain, textMuted, rowBg,
}: HomeViewProps) {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const receita = ctx?.receitaProjetadaHoje ?? 0;
  const divider = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(47,156,133,0.12)';

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2f9c85, #1a7a65)' }}>
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              {/* dot online */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: bg }} />
            </div>
            <div>
              <p className="text-base font-bold leading-tight" style={{ color: textMain }}>
                {saudacao}, {firstName}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-widest mt-0.5" style={{ color: '#2f9c85' }}>
                DEX · assistente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 mt-0.5 shrink-0"
            style={{ color: textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 h-px" style={{ background: divider }} />
      </div>

      {/* ── Conteúdo scrollável ─────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-5 pb-4 space-y-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? 'rgba(255,255,255,0.08) transparent' : 'rgba(47,156,133,0.12) transparent',
        }}
      >

        {/* Skeletons enquanto ctx carrega */}
        {!ctx && (
          <>
            <div className="rounded-xl animate-pulse" style={{ background: rowBg, height: 40 }} />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-xl animate-pulse" style={{ background: rowBg, height: 76 }} />
              ))}
            </div>
          </>
        )}

        {/* Consulta ativa */}
        {isConsultaPage && consultaCtx && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ background: 'rgba(47,156,133,0.10)', border: '1px solid rgba(47,156,133,0.30)' }}>
            <Stethoscope className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#2f9c85' }} />
            <div className="min-w-0">
              <p className="text-xs font-bold" style={{ color: '#2f9c85' }}>Consulta ativa · {consultaCtx.hora}</p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: textMuted }}>
                {consultaCtx.paciente.nome} · {consultaCtx.paciente.idadeStr}
                {consultaCtx.paciente.planejamentoAtivo ? ` · ${consultaCtx.paciente.planejamentoAtivo.titulo}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Alerta do paciente em tela */}
        {isPatientPage && patientHasAlert && patientCtx && (
          <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{patientCtx.nome}</p>
              <p className="text-[11px] mt-0.5" style={{ color: textMuted }}>
                {patientCtx.fichasRecentes.length} ficha{patientCtx.fichasRecentes.length !== 1 ? 's' : ''} · {patientCtx.orcamentosAbertos.length} orçamento{patientCtx.orcamentosAbertos.length !== 1 ? 's' : ''} em aberto
              </p>
            </div>
          </div>
        )}

        {/* Aniversariantes do dia */}
        {(ctx?.aniversariantesHoje ?? []).length > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(253,224,71,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <span className="text-lg shrink-0">🎂</span>
            <div className="min-w-0">
              <p className="text-xs font-bold" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
                {ctx!.aniversariantesHoje.length === 1 ? 'Aniversariante hoje' : `${ctx!.aniversariantesHoje.length} aniversariantes hoje`}
              </p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: textMuted }}>
                {ctx!.aniversariantesHoje.map(a => a.nome.split(' ')[0]).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Agenda do dia */}
        {ctx && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1" style={{ background: divider }} />
              <span className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: textMuted }}>Agenda de hoje</span>
              <div className="h-px flex-1" style={{ background: divider }} />
            </div>

            {(ctx.agendamentosHojeList ?? []).length > 0 ? (
              <div className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e8f0ef'}` }}>
                {(ctx.agendamentosHojeList ?? []).slice(0, 5).map((ag, i) => (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5"
                    style={{
                      background: i % 2 === 0 ? rowBg : 'transparent',
                      borderTop: i > 0 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f0f5f4'}` : 'none',
                    }}>
                    <span className="text-xs font-mono font-semibold shrink-0" style={{ color: '#2f9c85', minWidth: 36 }}>{ag.hora}</span>
                    <span className="flex-1 text-xs font-medium mx-3 truncate" style={{ color: textMain }}>{ag.paciente}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT[ag.status] ?? '#94a3b8' }} />
                      <span className="text-[10px]" style={{ color: textMuted }}>{STATUS_LABEL[ag.status] ?? ag.status}</span>
                    </span>
                  </div>
                ))}
                {(ctx.agendamentosHojeList ?? []).length > 5 && (
                  <div className="px-3.5 py-2 text-[10px]" style={{ color: textMuted, background: rowBg }}>
                    +{ctx.agendamentosHojeList.length - 5} mais
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl text-xs text-center" style={{ background: rowBg, color: textMuted }}>
                Nenhuma consulta agendada
              </div>
            )}
          </div>
        )}

        {/* Métricas — 3 cards */}
        {ctx && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl px-3 py-3 flex flex-col gap-1" style={{ background: rowBg, border: `1px solid ${divider}` }}>
              <CalendarDays className="w-3.5 h-3.5 mb-0.5" style={{ color: textMuted }} />
              <p className="text-xl font-bold font-mono leading-none" style={{ color: textMain }}>{ctx.agendamentosHoje}</p>
              <p className="text-[10px] leading-tight" style={{ color: textMuted }}>consultas<br />hoje</p>
            </div>
            <div className="rounded-xl px-3 py-3 flex flex-col gap-1" style={{ background: rowBg, border: `1px solid ${divider}` }}>
              <DollarSign className="w-3.5 h-3.5 mb-0.5" style={{ color: '#2f9c85' }} />
              <p className="text-xl font-bold font-mono leading-none" style={{ color: textMain }}>
                {receita >= 1000
                  ? `R$${(receita / 1000).toFixed(1)}k`
                  : `R$${receita.toFixed(0)}`}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: textMuted }}>receita<br />hoje</p>
            </div>
            <div className="rounded-xl px-3 py-3 flex flex-col gap-1" style={{ background: rowBg, border: `1px solid ${divider}` }}>
              <TrendingUp className="w-3.5 h-3.5 mb-0.5" style={{ color: textMuted }} />
              <p className="text-xl font-bold font-mono leading-none" style={{ color: textMain }}>{ctx.consultasSemana}</p>
              <p className="text-[10px] leading-tight" style={{ color: textMuted }}>consultas<br />semana</p>
            </div>
          </div>
        )}

        {/* ── Radar Dex — insights proativos ─────────────────────────────────── */}
        {ctx && (() => {
          const insights = gerarInsights(ctx);
          if (insights.length === 0) return null;
          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="h-px flex-1" style={{ background: divider }} />
                <span className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: textMuted }}>
                  Radar Dex
                </span>
                <div className="h-px flex-1" style={{ background: divider }} />
              </div>

              {insights.map((insight) => {
                const colors = INSIGHT_COLORS[insight.accent];
                const Icon = insight.Icon;
                return (
                  <button
                    key={insight.id}
                    onClick={() => onInsightClick(insight)}
                    className="w-full rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all hover:brightness-105 active:scale-[0.985] text-left"
                    style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                  >
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                      style={{ background: colors.border }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: colors.icon }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-snug" style={{ color: textMain }}>
                        {insight.label}
                      </p>
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: textMuted }}>
                        {insight.sublabel}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: colors.icon, opacity: insight.items.length > 0 ? 0.7 : 0.35 }} />
                  </button>
                );
              })}
            </div>
          );
        })()}

      </div>

    </motion.div>
  );
}

