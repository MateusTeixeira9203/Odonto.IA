'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Bot, Send, Sparkles, MessageSquare, Copy, Check, ChevronUp,
  Calendar, FileText, TrendingUp, AlertTriangle, CreditCard, User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import type { DexContextData } from '@/app/api/dex/context/route';
import type { DexPatientContext } from '@/app/api/dex/patient-context/route';
// Chave escopada por usuário — deve ser idêntica à do DexOnboarding
const userOnboardingKey = (id: string) => `dex_onboarding_v1_${id}`;

// Chave de resumo semanal — muda toda segunda-feira
function currentWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `dex_week_${d.getFullYear()}_${week}`;
}

// ── Chat types ────────────────────────────────────────────────────────────────

type MessageRole = 'dex' | 'user';
type MessageType = 'text' | 'alert' | 'tour';

interface ChatAction {
  label: string;
  href: string;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  actions?: ChatAction[];
}

// ── Chat history type (mirrors API) ──────────────────────────────────────────

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function buildGreeting(nome: string, ctx: DexContextData): string {
  const firstName = nome.split(' ')[0];
  const hour = new Date().getHours();
  const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  let msg = `${saudacao}, ${firstName}! `;

  if (ctx.agendamentosHoje === 0) {
    msg += 'Sua agenda está livre hoje. ';
  } else if (ctx.agendamentosHoje === 1) {
    msg += ctx.proximoPaciente
      ? `Você tem 1 consulta hoje — ${ctx.proximoHorario ? `às ${ctx.proximoHorario}` : 'próximo'} é ${ctx.proximoPaciente}. `
      : 'Você tem 1 consulta agendada hoje. ';
  } else {
    msg += `Você tem ${ctx.agendamentosHoje} consultas hoje. `;
    if (ctx.proximoPaciente) {
      msg += `${ctx.proximoHorario ? `Às ${ctx.proximoHorario}` : 'Próximo'}: ${ctx.proximoPaciente}. `;
    }
  }

  if (ctx.receitaProjetadaHoje > 0) {
    msg += `Receita registrada hoje: R$ ${ctx.receitaProjetadaHoje.toFixed(2).replace('.', ',')}. `;
  }

  if (ctx.followUpPendentes > 0) {
    msg += `⚠️ ${ctx.followUpPendentes} orçamento${ctx.followUpPendentes > 1 ? 's' : ''} sem retorno há +3 dias. `;
  }

  msg += 'Como posso ajudar?';
  return msg;
}

// ── Suggestion chips ─────────────────────────────────────────────────────────

interface SuggestionChip {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  message: string;
}

const CHIPS_DASHBOARD: SuggestionChip[] = [
  { icon: Calendar,      label: 'Agenda de hoje',        sublabel: 'Ver todas as consultas',     message: 'Como está minha agenda hoje?' },
  { icon: FileText,      label: 'Briefing do próximo',   sublabel: 'Resumo pré-consulta',        message: 'Gera o briefing do meu próximo paciente' },
  { icon: TrendingUp,    label: 'Orçamentos parados',    sublabel: 'Sem retorno há mais de 3 dias', message: 'Quais orçamentos estão sem retorno há mais de 3 dias?' },
  { icon: Sparkles,      label: 'Sugestões do dia',      sublabel: 'O que priorizar agora',      message: 'O que você sugere que eu faça hoje na clínica?' },
];

const CHIPS_PACIENTE: SuggestionChip[] = [
  { icon: User,          label: 'Resumo clínico',        sublabel: 'Histórico completo',         message: 'Me faça um resumo clínico deste paciente' },
  { icon: AlertTriangle, label: 'Alergias e alertas',    sublabel: 'Verificar contraindicações', message: 'Quais são as alergias e alertas deste paciente?' },
  { icon: CreditCard,    label: 'Orçamentos abertos',    sublabel: 'Status financeiro',          message: 'Quais orçamentos este paciente tem em aberto?' },
  { icon: FileText,      label: 'Última ficha',          sublabel: 'Evolução mais recente',      message: 'Me mostre o histórico da última ficha deste paciente' },
];

// ── WhatsApp commands ─────────────────────────────────────────────────────────

const DEX_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: 'agenda', desc: 'Consultas de hoje' },
  { cmd: 'lucro', desc: 'Saldo financeiro do mês' },
  { cmd: 'pacientes', desc: 'Próximo a chegar' },
  { cmd: 'ajuda', desc: 'Menu de comandos' },
];

// ── Patient profile tour ──────────────────────────────────────────────────────

const PATIENT_TOUR_KEY = 'patient_profile_tour_v1';

interface TourStep {
  tabId: string | null;
  title: string;
  content: string;
}

const PATIENT_TOUR_STEPS: TourStep[] = [
  { tabId: null,               title: '🤖 Bem-vindo ao Perfil do Paciente!', content: 'Aqui é onde a mágica acontece. Vou te mostrar as 4 áreas principais.' },
  { tabId: 'tab-fichas',       title: '📝 Fichas Clínicas',                  content: 'Aqui você preenche a anamnese, evolução e odontograma do paciente.' },
  { tabId: 'tab-documentos',   title: '📄 Documentos',                       content: 'Gere atestados, receitas e termos de consentimento em 1 clique.' },
  { tabId: 'tab-apresentacao', title: '🖥️ Apresentação ao Paciente',           content: 'Monte seções com texto gerado por IA e fotos do histórico. Apresente em tela cheia na cadeira e exporte o PDF para o paciente levar.' },
  { tabId: 'tab-orcamento',    title: '💰 Orçamento',                        content: 'Monte o plano de tratamento, aprove valores e feche o negócio!' },
];

const TAB_SWITCH_MAP: Record<string, string> = {
  'tab-fichas':       'fichas',
  'tab-documentos':   'documentos',
  'tab-apresentacao': 'planejamento',
  'tab-orcamento':    'orcamentos',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface DexWidgetProps {
  role: DentistaRole;
  plano?: PlanoId;
  nome: string;
  dentistaId: string;
}

export function DexWidget({ plano, nome, dentistaId }: DexWidgetProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [ctxData, setCtxData] = useState<DexContextData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [profileTourStep, setProfileTourStep] = useState<number | null>(null);
  const [chipsVisible, setChipsVisible] = useState(true);
  const [barCtx, setBarCtx] = useState<DexContextData | null>(null);
  const [patientCtxPreload, setPatientCtxPreload] = useState<DexPatientContext | null>(null);
  const [patientHasAlert, setPatientHasAlert] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevIsPatientPage = useRef(false);
  const pathname = usePathname();
  const patientId = pathname?.match(/^\/dashboard\/pacientes\/([^/]+)$/)?.[1] ?? null;
  const isPatientPage = patientId !== null;
  // Onboarding gate: FAB is hidden until the onboarding tour is complete
  const [onboardingDone, setOnboardingDone] = useState(false);
  // Brief × badge shown right after onboarding completes (4 s)
  const [showWelcomeBadge, setShowWelcomeBadge] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geminiHistoryRef = useRef<GeminiMessage[]>([]);

  // Observa mudanças de tema (dark/light) no <html> e sinaliza que o DOM está pronto
  useEffect(() => {
    setMounted(true);
    const el = document.documentElement;
    setIsDark(el.classList.contains('dark'));
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Gate FAB visibility behind onboarding completion (chave escopada por usuário)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(userOnboardingKey(dentistaId))) {
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

  // Driver.js auto-tour desabilitado — substituído pelo tour DEX completo
  // O botão "Rever tour" no chat ainda funciona manualmente via handleReplayTour

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Carrega contexto e exibe saudação ao abrir
  useEffect(() => {
    if (!isOpen || contextLoaded) return;
    setContextLoaded(true);
    setIsTyping(true);

    // Reutiliza contextos já carregados — zero chamadas duplicadas à API
    const dexCtxPromise = barCtx
      ? Promise.resolve(barCtx)
      : fetch('/api/dex/context').then((r) => r.json() as Promise<DexContextData>);
    const patCtxPromise = patientId
      ? patientCtxPreload
        ? Promise.resolve(patientCtxPreload)
        : fetch(`/api/dex/patient-context?patientId=${patientId}`)
            .then((r) => r.json() as Promise<DexPatientContext>)
            .catch(() => null)
      : Promise.resolve(null);

    void Promise.all([dexCtxPromise, patCtxPromise])
      .then(([ctx, patCtx]: [DexContextData, DexPatientContext | null]) => {
        setCtxData(ctx);
        setTimeout(() => {
          setIsTyping(false);
          const initial: ChatMessage[] = [
            {
              id: 'greeting',
              role: 'dex',
              type: 'text',
              content: buildGreeting(nome, ctx),
            },
          ];
          if (ctx.orcamentosPendentes > 0) {
            initial.push({
              id: 'alert-orcamentos',
              role: 'dex',
              type: 'alert',
              content: `Você tem ${ctx.orcamentosPendentes} orçamento${ctx.orcamentosPendentes > 1 ? 's' : ''} aguardando aprovação.`,
              actions: [{ label: 'Ver orçamentos', href: '/dashboard/orcamentos' }],
            });
          }
          if (ctx.proximoAgendamentoId && ctx.proximoPaciente) {
            initial.push({
              id: 'briefing-prompt',
              role: 'dex',
              type: 'alert',
              content: `Próximo paciente: ${ctx.proximoPaciente}${ctx.proximoHorario ? ` às ${ctx.proximoHorario}` : ''}. Deseja o briefing pré-consulta?`,
              actions: [
                { label: '📋 Gerar briefing', href: '__briefing__' },
                { label: '🩺 Iniciar consulta', href: `/consulta/${ctx.proximoAgendamentoId}` },
              ],
            });
          }
          if (patCtx && !('error' in patCtx)) {
            const fichasText = patCtx.fichasRecentes.length > 0
              ? patCtx.fichasRecentes.map((f, i) => `${i + 1}. ${f.data}: ${f.queixa}`).join('\n')
              : 'Nenhuma ficha anterior.';
            const orcText = patCtx.orcamentosAbertos.length > 0
              ? patCtx.orcamentosAbertos.map((o) => `R$ ${o.total.toFixed(2)} (${o.status})`).join(', ')
              : null;
            initial.push({
              id: 'patient-context',
              role: 'dex',
              type: 'text',
              content: [
                `👤 ${patCtx.nome} · ${patCtx.idade}`,
                `📝 Fichas:\n${fichasText}`,
                orcText ? `💰 Orçamentos: ${orcText}` : null,
              ].filter(Boolean).join('\n'),
            });
            geminiHistoryRef.current = [
              {
                role: 'model',
                parts: [{
                  text: `Paciente em tela: ${patCtx.nome} (${patCtx.idade}). Fichas recentes: ${fichasText}. ${orcText ? `Orçamentos: ${orcText}.` : ''}`,
                }],
              },
            ];
          }
          if (isPatientPage && typeof window !== 'undefined' && !localStorage.getItem(PATIENT_TOUR_KEY)) {
            initial.push({
              id: 'tour-offer',
              role: 'dex',
              type: 'alert',
              content: 'Primeira visita ao perfil? Posso te guiar pelas áreas principais em menos de 1 minuto.',
              actions: [{ label: '🗺️ Iniciar tour', href: '__start_tour__' }],
            });
          }

          // Aniversariantes do dia
          if (ctx.aniversariantesHoje.length > 0) {
            const nomes = ctx.aniversariantesHoje.map((p) => p.nome).join(', ');
            initial.push({
              id: 'aniversario',
              role: 'dex',
              type: 'alert',
              content: `🎂 ${ctx.aniversariantesHoje.length === 1 ? 'Hoje é aniversário de' : 'Aniversariantes de hoje:'} ${nomes}! Quer gerar uma mensagem de parabéns?`,
              actions: [{ label: '🎉 Gerar mensagem', href: '__birthday__' }],
            });
          }

          // Resumo semanal — exibe apenas na primeira abertura da semana
          if (typeof window !== 'undefined' && localStorage.getItem('dex_week_summary') !== currentWeekKey()) {
            localStorage.setItem('dex_week_summary', currentWeekKey());
            const linhas = [
              `📊 Resumo desta semana:`,
              `• ${ctx.consultasSemana} consulta${ctx.consultasSemana !== 1 ? 's' : ''} agendada${ctx.consultasSemana !== 1 ? 's' : ''}`,
              `• ${ctx.orcamentosAprovadosSemana} orçamento${ctx.orcamentosAprovadosSemana !== 1 ? 's' : ''} aprovado${ctx.orcamentosAprovadosSemana !== 1 ? 's' : ''}`,
              ctx.orcamentosPendentes > 0 ? `• ${ctx.orcamentosPendentes} orçamento${ctx.orcamentosPendentes !== 1 ? 's' : ''} aguardando resposta` : null,
              ctx.followUpPendentes > 0 ? `• ⚠️ ${ctx.followUpPendentes} paciente${ctx.followUpPendentes !== 1 ? 's' : ''} sem retorno há +3 dias` : null,
            ].filter(Boolean).join('\n');
            initial.push({
              id: 'weekly-summary',
              role: 'dex',
              type: 'text',
              content: linhas,
            });
          }

          setMessages(initial);
        }, 800);
      })
      .catch(() => {
        setIsTyping(false);
        setMessages([
          {
            id: 'greeting',
            role: 'dex',
            type: 'text',
            content: `Olá, ${nome.split(' ')[0]}! Estou pronto para ajudar. Como posso auxiliar você hoje?`,
          },
        ]);
      });
  }, [isOpen, contextLoaded, nome, patientId, isPatientPage]);

  // Foca o input ao abrir
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Carrega contexto completo para a barra — reutilizado ao abrir o painel (sem double-fetch)
  useEffect(() => {
    if (!onboardingDone) return;
    fetch('/api/dex/context')
      .then((r) => r.json() as Promise<DexContextData>)
      .then((ctx) => setBarCtx(ctx))
      .catch(() => {});
  }, [onboardingDone]);

  // Pré-carrega contexto do paciente para o indicador visual — não abre o painel
  useEffect(() => {
    if (!patientId || !onboardingDone) {
      setPatientCtxPreload(null);
      setPatientHasAlert(false);
      prevIsPatientPage.current = false;
      return;
    }
    fetch(`/api/dex/patient-context?patientId=${patientId}`)
      .then((r) => r.json() as Promise<DexPatientContext>)
      .then((ctx) => {
        if ('error' in ctx) return;
        setPatientCtxPreload(ctx);
        setPatientHasAlert(!!(
          ctx.fichasRecentes.length > 0 ||
          ctx.orcamentosAbertos.length > 0
        ));
      })
      .catch(() => {});
  }, [patientId, onboardingDone]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setContextLoaded(false);
    setMessages([]);
    setInputValue('');
    setIsTyping(false);
    setChipsVisible(true);
    geminiHistoryRef.current = [];
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, []);

  const handleReplayTour = useCallback(() => {
    setIsOpen(false);
    // driver.js loaded dynamically — it accesses browser globals at init time
    // and cannot be statically imported in an SSR context
    setTimeout(async () => {
      // Carregar CSS e módulo dinamicamente (browser-only)
      // @ts-expect-error — CSS modules don't expose TS types
      void import('driver.js/dist/driver.css');
      const { driver } = await import('driver.js');
      const tourSteps = [
        { element: '#sidebar',           popover: { title: 'Navegação Principal', description: 'Aqui você acessa todas as funcionalidades da sua clínica.' } },
        { element: '#pacientes-link',    popover: { title: 'Pacientes',           description: 'Cadastre e gerencie pacientes com histórico clínico completo.' } },
        { element: '#orcamentos-link',   popover: { title: 'Orçamentos',          description: 'Gere orçamentos automaticamente com IA.' } },
        { element: '#agendamentos-link', popover: { title: 'Agendamentos',        description: 'Organize sua agenda com visualização semanal.' } },
        { element: '#configuracoes-link',popover: { title: 'Configurações',       description: 'Ajuste a clínica, horários, procedimentos e WhatsApp.' } },
      ].filter(s => !!document.querySelector(s.element));
      driver({ steps: tourSteps, showProgress: true, nextBtnText: 'Próximo →', prevBtnText: '← Anterior', doneBtnText: '✓ Entendi!' }).drive();
    }, 400);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    setInputValue('');
    setChipsVisible(false);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', type: 'text', content: text },
    ]);
    setIsTyping(true);

    // Adiciona a mensagem do usuário ao histórico para o Gemini
    geminiHistoryRef.current = [
      ...geminiHistoryRef.current,
      { role: 'user', parts: [{ text }] },
    ];

    try {
      const res = await fetch('/api/dex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: geminiHistoryRef.current.slice(0, -1) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply ?? 'Não consegui processar a resposta. Tente novamente.';

      // Adiciona resposta do modelo ao histórico
      geminiHistoryRef.current = [
        ...geminiHistoryRef.current,
        { role: 'model', parts: [{ text: reply }] },
      ];

      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}`, role: 'dex', type: 'text', content: reply },
      ]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}`, role: 'dex', type: 'text', content: 'Erro de conexão. Tente novamente em instantes.' },
      ]);
    }
  }, [inputValue, isTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleBriefing = useCallback(async () => {
    if (!ctxData?.proximoAgendamentoId || briefingLoading) return;
    setBriefingLoading(true);
    setIsTyping(true);
    // Remove the briefing prompt message so it doesn't linger
    setMessages((prev) => prev.filter((m) => m.id !== 'briefing-prompt'));
    try {
      const res = await fetch(`/api/dex/briefing?agendamentoId=${ctxData.proximoAgendamentoId}`);
      const data = (await res.json()) as { briefing?: string; pacienteNome?: string; hora?: string; error?: string };
      const text = data.briefing ?? 'Não foi possível gerar o briefing. Tente novamente.';
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `briefing-${Date.now()}`, role: 'dex', type: 'text', content: text },
      ]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `briefing-err-${Date.now()}`, role: 'dex', type: 'text', content: 'Erro ao buscar briefing. Tente novamente.' },
      ]);
    } finally {
      setBriefingLoading(false);
    }
  }, [ctxData, briefingLoading]);

  const goToStep = useCallback((step: number) => {
    if (step < 0 || step >= PATIENT_TOUR_STEPS.length) return;
    const s = PATIENT_TOUR_STEPS[step];
    setProfileTourStep(step);
    setMessages((prev) => [
      ...prev,
      {
        id: `tour-step-${step}-${Date.now()}`,
        role: 'dex' as MessageRole,
        type: 'tour' as MessageType,
        content: `${s.title}\n\n${s.content}`,
      },
    ]);
    if (s.tabId && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dex:highlight-tab', { detail: s.tabId }));
      const tabValue = TAB_SWITCH_MAP[s.tabId];
      if (tabValue) window.dispatchEvent(new CustomEvent('dex:switch-tab', { detail: tabValue }));
    }
  }, []);

  const startProfileTour = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.id !== 'tour-offer'));
    goToStep(0);
  }, [goToStep]);

  const endTour = useCallback(() => {
    setProfileTourStep(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PATIENT_TOUR_KEY, 'done');
      window.dispatchEvent(new CustomEvent('dex:highlight-tab', { detail: null }));
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `tour-done-${Date.now()}`,
        role: 'dex' as MessageRole,
        type: 'text' as MessageType,
        content: '✅ Tour concluído! Agora você conhece as principais áreas do perfil. Qualquer dúvida, é só perguntar.',
      },
    ]);
  }, []);

  const handleChipSend = useCallback(async (text: string) => {
    setChipsVisible(false);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user' as MessageRole, type: 'text' as MessageType, content: text },
    ]);
    setIsTyping(true);
    geminiHistoryRef.current = [...geminiHistoryRef.current, { role: 'user', parts: [{ text }] }];
    try {
      const res = await fetch('/api/dex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: geminiHistoryRef.current.slice(0, -1) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply ?? 'Não consegui processar a resposta. Tente novamente.';
      geminiHistoryRef.current = [...geminiHistoryRef.current, { role: 'model', parts: [{ text: reply }] }];
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `d-${Date.now()}`, role: 'dex' as MessageRole, type: 'text' as MessageType, content: reply },
      ]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `d-err-${Date.now()}`, role: 'dex' as MessageRole, type: 'text' as MessageType, content: 'Erro de conexão. Tente novamente.' },
      ]);
    }
  }, []);

  const handleAction = useCallback(
    (href: string) => {
      if (href === '__briefing__') {
        void handleBriefing();
        return;
      }
      if (href === '__start_tour__') {
        startProfileTour();
        return;
      }
      if (href === '__birthday__') {
        void handleChipSend('Gera uma mensagem de parabéns de aniversário para enviar pelo WhatsApp para o paciente aniversariante de hoje');
        return;
      }
      handleClose();
      router.push(href);
    },
    [handleClose, router, handleBriefing, startProfileTour, handleChipSend],
  );

  const suggestionChips: SuggestionChip[] = isPatientPage ? CHIPS_PACIENTE : CHIPS_DASHBOARD;

  // ── Cores derivadas do tema ───────────────────────────────────────────────

  const panelBg = isDark
    ? 'linear-gradient(180deg, rgba(9,9,11,0.99) 0%, rgba(14,14,16,1) 100%)'
    : 'linear-gradient(180deg, #f8fffe 0%, #fafaf8 100%)';
  const panelBorder = isDark ? 'rgba(47,156,133,0.25)' : '#c8e6e0';
  const panelShadow = isDark
    ? '0 -24px 70px -10px rgba(0,0,0,0.75), 0 0 0 1px rgba(47,156,133,0.10)'
    : '0 -16px 60px -8px rgba(0,0,0,0.14), 0 0 0 1px rgba(47,156,133,0.12)';
  const headerBg = isDark
    ? 'linear-gradient(135deg, rgba(47,156,133,0.08) 0%, transparent 60%)'
    : 'linear-gradient(135deg, rgba(47,156,133,0.07) 0%, rgba(248,255,254,0.0) 60%)';
  const dividerColor = isDark ? 'rgba(47,156,133,0.14)' : 'rgba(47,156,133,0.15)';
  const textPrimary = isDark ? 'rgba(255,255,255,0.93)' : '#0d1a18';
  const textMuted = isDark ? 'rgba(255,255,255,0.32)' : '#4a6b65';
  const textFaint = isDark ? 'rgba(255,255,255,0.18)' : '#7a9e98';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : '#eef8f6';
  const inputBorder = isDark ? 'rgba(255,255,255,0.09)' : '#b8d8d3';
  const chipBg = isDark ? 'rgba(47,156,133,0.08)' : '#e4f5f1';
  const chipBorder = isDark ? 'rgba(47,156,133,0.20)' : '#a8d8d0';
  const chipLabelColor = isDark ? 'rgba(255,255,255,0.84)' : '#0d2e29';
  const chipSublabelColor = isDark ? 'rgba(255,255,255,0.38)' : '#3d7a72';
  const tourDotInactive = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(47,156,133,0.20)';
  const tourBackBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(47,156,133,0.06)';
  const tourBackBorder = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(47,156,133,0.18)';
  const tourBackColor = isDark ? 'rgba(255,255,255,0.42)' : '#3d7a72';

  return (
    <>
      {/* ── Backdrop + Painel via Portal — fora de qualquer stacking context ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && onboardingDone && (
            <>
              {/* Backdrop com desfoque — z-[998] acima de todo conteúdo */}
              <motion.div
                className="fixed inset-0 backdrop-blur-md"
                style={{ zIndex: 998, background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(180,220,215,0.45)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
              />

              {/* Painel — 70vw centralizado na viewport */}
              <motion.div
                style={{
                  position: 'fixed',
                  bottom: '92px',
                  left: '50%',
                  width: '70vw',
                  maxWidth: '740px',
                  height: 'min(76vh, 640px)',
                  zIndex: 999,
                  borderRadius: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: panelBg,
                  border: `1px solid ${panelBorder}`,
                  boxShadow: panelShadow,
                }}
                initial={{ opacity: 0, x: '-50%', y: 18, scale: 0.97 }}
                animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
                exit={{ opacity: 0, x: '-50%', y: 10, scale: 0.98 }}
                transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              >
                    {/* Header do painel */}
                    <div
                      className="flex items-center justify-between px-5 py-4 shrink-0"
                      style={{
                        background: headerBg,
                        borderBottom: `1px solid ${dividerColor}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                              background: isDark ? 'rgba(47,156,133,0.18)' : 'rgba(47,156,133,0.14)',
                              border: `1px solid ${isDark ? 'rgba(47,156,133,0.35)' : 'rgba(47,156,133,0.35)'}`,
                              boxShadow: isDark ? 'none' : '0 2px 8px rgba(47,156,133,0.12)',
                            }}
                          >
                            <Bot className="w-4.5 h-4.5" style={{ color: '#2f9c85' }} />
                          </div>
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                            style={{
                              background: '#2f9c85',
                              borderColor: isDark ? 'rgba(9,9,11,1)' : '#f8fffe',
                              boxShadow: '0 0 6px rgba(47,156,133,0.5)',
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-bold tracking-wide" style={{ color: textPrimary }}>DEX</div>
                          <div className="text-[10px] font-mono tracking-widest" style={{ color: isDark ? 'rgba(47,156,133,0.75)' : '#2f9c85' }}>
                            ASSISTENTE CLÍNICO
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowCommands((v) => !v)}
                          className="p-2 rounded-xl transition-all hover:scale-105"
                          style={{
                            color: showCommands ? '#2f9c85' : isDark ? 'rgba(255,255,255,0.30)' : '#5a8a83',
                            background: showCommands
                              ? isDark ? 'rgba(47,156,133,0.12)' : 'rgba(47,156,133,0.10)'
                              : 'transparent',
                          }}
                          title="Comandos WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleClose}
                          className="p-2 rounded-xl transition-all hover:scale-105"
                          style={{
                            color: isDark ? 'rgba(255,255,255,0.35)' : '#5a8a83',
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(47,156,133,0.06)',
                          }}
                          aria-label="Fechar DEX"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* WhatsApp commands accordion */}
                    <AnimatePresence>
                      {showCommands && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="shrink-0 overflow-hidden"
                          style={{ borderBottom: `1px solid ${dividerColor}` }}
                        >
                          <div className="px-5 py-3 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: textMuted }}>
                              Envie para o número da clínica
                            </p>
                            {DEX_COMMANDS.map((c) => (
                              <div key={c.cmd} className="flex items-center justify-between py-1">
                                <span className="font-mono text-xs font-bold" style={{ color: '#2f9c85' }}>/{c.cmd}</span>
                                <span className="text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.40)' }}>{c.desc}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Chat area */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
                      {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} onAction={handleAction} isDark={isDark} />
                      ))}

                      <AnimatePresence>
                        {isTyping && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-end gap-2"
                          >
                            <DexAvatar isDark={isDark} />
                            <div
                              className="px-4 py-3 rounded-2xl rounded-bl-sm"
                              style={{
                                background: isDark ? 'rgba(47,156,133,0.10)' : 'rgba(47,156,133,0.07)',
                                border: `1px solid ${isDark ? 'rgba(47,156,133,0.15)' : 'rgba(47,156,133,0.20)'}`,
                              }}
                            >
                              <TypingDots />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Chips de sugestão — grid 2×2 */}
                      <AnimatePresence>
                        {chipsVisible && contextLoaded && !isTyping && messages.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.22 }}
                            className="grid grid-cols-2 gap-2"
                          >
                            {suggestionChips.map((chip) => (
                              <button
                                key={chip.label}
                                onClick={() => void handleChipSend(chip.message)}
                                className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl text-left transition-all hover:opacity-90 active:scale-[0.97]"
                                style={{
                                  background: chipBg,
                                  border: `1px solid ${chipBorder}`,
                                }}
                              >
                                <chip.icon
                                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                                  style={{ color: '#5dbeb0' }}
                                />
                                <div className="min-w-0">
                                  <div className="text-[12px] font-semibold leading-snug" style={{ color: chipLabelColor }}>
                                    {chip.label}
                                  </div>
                                  <div className="text-[10px] mt-0.5 leading-snug" style={{ color: chipSublabelColor }}>
                                    {chip.sublabel}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input / Tour controls */}
                    {profileTourStep !== null ? (
                      <div className="px-4 pb-4 pt-3 shrink-0" style={{ borderTop: `1px solid ${dividerColor}` }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-mono" style={{ color: textMuted }}>
                            Passo {profileTourStep + 1} de {PATIENT_TOUR_STEPS.length}
                          </span>
                          <div className="flex gap-1">
                            {PATIENT_TOUR_STEPS.map((_, i) => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                                style={{ background: i <= profileTourStep ? '#2f9c85' : tourDotInactive }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {profileTourStep > 0 && (
                            <button
                              onClick={() => goToStep(profileTourStep - 1)}
                              className="flex-1 py-2 text-xs rounded-xl transition-all hover:opacity-80"
                              style={{ background: tourBackBg, border: `1px solid ${tourBackBorder}`, color: tourBackColor }}
                            >
                              ← Voltar
                            </button>
                          )}
                          {profileTourStep < PATIENT_TOUR_STEPS.length - 1 ? (
                            <button
                              onClick={() => goToStep(profileTourStep + 1)}
                              className="flex-1 py-2 text-xs font-bold rounded-xl transition-all hover:opacity-80"
                              style={{ background: 'rgba(47,156,133,0.12)', border: '1px solid rgba(47,156,133,0.30)', color: '#2f9c85' }}
                            >
                              Próximo →
                            </button>
                          ) : (
                            <button
                              onClick={endTour}
                              className="flex-1 py-2 text-xs font-bold rounded-xl transition-all hover:opacity-80"
                              style={{ background: 'rgba(47,156,133,0.18)', border: '1px solid rgba(47,156,133,0.40)', color: '#2f9c85' }}
                            >
                              ✓ Concluir
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 pt-3 shrink-0" style={{ borderTop: `1px solid ${dividerColor}` }}>
                        <div
                          className="flex items-center gap-2 rounded-xl px-3.5 py-3 mb-2"
                          style={{
                            background: inputBg,
                            border: `1px solid ${inputBorder}`,
                            boxShadow: isDark ? 'none' : 'inset 0 1px 3px rgba(0,0,0,0.04)',
                          }}
                        >
                          <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Peça algo ao DEX..."
                            className={`flex-1 bg-transparent text-sm outline-none ${isDark ? 'placeholder:text-white/25' : 'placeholder:text-[#7aada6]'}`}
                            style={{ color: textPrimary }}
                          />
                          <button
                            onClick={() => void handleSend()}
                            disabled={!inputValue.trim() || isTyping}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: inputValue.trim() && !isTyping ? '#2f9c85' : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.20)' }}
                            aria-label="Enviar mensagem"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={handleReplayTour}
                            className="text-[10px] transition-colors hover:opacity-60"
                            style={{ color: textFaint }}
                          >
                            Rever tour
                          </button>
                          {isPatientPage && (
                            <button
                              onClick={() => {
                                localStorage.removeItem(PATIENT_TOUR_KEY);
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: `tour-replay-${Date.now()}`,
                                    role: 'dex' as MessageRole,
                                    type: 'alert' as MessageType,
                                    content: 'Vamos retomar o tour pelo perfil do paciente?',
                                    actions: [{ label: '🗺️ Iniciar tour', href: '__start_tour__' }],
                                  },
                                ]);
                              }}
                              className="text-[10px] transition-colors hover:opacity-60"
                              style={{ color: textFaint }}
                            >
                              Rever tour do perfil
                            </button>
                          )}
                          <p className="text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)' }}>
                            DEX · DentIA{plano && <span className="font-mono ml-1" style={{ color: 'rgba(47,156,133,0.45)' }}>[{plano}]</span>}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Barra flutuante FAB — stacking context próprio z-40 ─────────────── */}
      <AnimatePresence>
        {onboardingDone && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[76%] sm:w-[48%] z-40"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
          >
            <motion.button
              onClick={() => setIsOpen((v) => !v)}
              className="relative w-full h-14 rounded-2xl flex items-center px-4 gap-3 text-white overflow-hidden outline-none focus:outline-none focus-visible:outline-none"
              style={{
                background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)',
                boxShadow: isOpen
                  ? 'none'
                  : patientHasAlert
                  ? '0 6px 28px -6px rgba(47,156,133,0.5), 0 0 0 2px rgba(251,191,36,0.35)'
                  : '0 6px 28px -6px rgba(47,156,133,0.5)',
              }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              aria-label={isOpen ? 'Fechar DEX' : 'Abrir DEX'}
            >
              {/* Brilho sutil no fundo */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-transparent pointer-events-none" />

              {/* Ícone DEX */}
              <div className="relative w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
                {/* Indicador: paciente com dados (âmbar) ou follow-ups pendentes (branco) */}
                {patientHasAlert && !isOpen ? (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-[#1a7a65] animate-pulse" />
                ) : (barCtx?.followUpPendentes ?? 0) > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white/90 border-2 border-[#2f9c85]" />
                ) : null}
              </div>

              {/* Label */}
              <span className="font-bold text-sm tracking-wide text-white shrink-0">DEX</span>

              {/* Separador */}
              <div className="w-px h-5 bg-white/20 shrink-0" />

              {/* Info contextual */}
              <div className="flex-1 text-left min-w-0">
                {isPatientPage && patientHasAlert ? (
                  <span className="text-sm text-amber-300/90 truncate font-medium">Prontuário com dados relevantes</span>
                ) : isPatientPage ? (
                  <span className="text-sm text-white/70 truncate">Contexto do paciente carregado</span>
                ) : barCtx?.proximoPaciente ? (
                  <span className="text-sm text-white/90 truncate">
                    Próximo:{' '}
                    <span className="font-semibold">{barCtx.proximoPaciente}</span>
                    {barCtx.proximoHorario && (
                      <span className="text-white/60"> · {barCtx.proximoHorario}</span>
                    )}
                  </span>
                ) : barCtx ? (
                  <span className="text-sm text-white/55">Agenda livre hoje</span>
                ) : (
                  <span className="text-sm text-white/40">Carregando...</span>
                )}
              </div>

              {/* Chevron animado */}
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="shrink-0"
              >
                <ChevronUp className="w-4 h-4 text-white/60" />
              </motion.div>

              {/* Badge de boas-vindas após onboarding */}
              <AnimatePresence>
                {showWelcomeBadge && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                    onClick={(e) => { e.stopPropagation(); setShowWelcomeBadge(false); }}
                    className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-white text-[10px] font-bold cursor-pointer z-10"
                    style={{ color: '#2f9c85' }}
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



// ── Sub-components ────────────────────────────────────────────────────────────

function DexAvatar({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: isDark ? 'rgba(47,156,133,0.18)' : '#d4eeea',
        border: `1px solid ${isDark ? 'rgba(47,156,133,0.32)' : '#9ed0c8'}`,
        boxShadow: isDark ? 'none' : '0 1px 4px rgba(47,156,133,0.15)',
      }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: isDark ? '#5dbeb0' : '#1a7a65' }} />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 h-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: '#2f9c85' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

interface ChatBubbleProps {
  message: ChatMessage;
  onAction: (href: string) => void;
  isDark: boolean;
}

function ChatBubble({ message, onAction, isDark }: ChatBubbleProps) {
  const isUser  = message.role === 'user';
  const isAlert = message.type === 'alert';
  const isTour  = message.type === 'tour';
  const [copied, setCopied] = useState(false);

  const nnIdx    = isTour ? message.content.indexOf('\n\n') : -1;
  const tourTitle = isTour ? (nnIdx >= 0 ? message.content.slice(0, nnIdx) : message.content) : '';
  const tourBody  = isTour && nnIdx >= 0 ? message.content.slice(nnIdx + 2) : '';

  function handleCopy() {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Cores das bolhas por tipo e modo
  const bubbleStyle: React.CSSProperties = (() => {
    if (isUser) {
      return isDark
        ? { background: 'rgba(47,156,133,0.18)', border: '1px solid rgba(47,156,133,0.30)', color: 'rgba(255,255,255,0.93)' }
        : { background: '#2f9c85', border: '1px solid #267f6d', color: '#ffffff', boxShadow: '0 2px 8px rgba(47,156,133,0.25)' };
    }
    if (isAlert) {
      return isDark
        ? { background: 'rgba(47,156,133,0.12)', border: '1px solid rgba(47,156,133,0.32)', color: 'rgba(255,255,255,0.88)' }
        : { background: '#e2f5f1', border: '1px solid #9ed0c8', color: '#0d3530', boxShadow: '0 1px 4px rgba(47,156,133,0.10)' };
    }
    if (isTour) {
      return isDark
        ? { background: 'rgba(47,156,133,0.08)', border: '1px solid rgba(47,156,133,0.22)', borderLeft: '3px solid #2f9c85', color: 'rgba(255,255,255,0.84)' }
        : { background: '#eaf7f4', border: '1px solid #a8d8d0', borderLeft: '3px solid #2f9c85', color: '#0d3530' };
    }
    // DEX normal
    return isDark
      ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.87)' }
      : { background: '#ffffff', border: '1px solid #d8d4cc', color: '#1a1a1a', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && <DexAvatar isDark={isDark} />}

      <div
        className={`flex flex-col gap-2 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        {/* Bubble */}
        <div
          className={`px-4 py-3 text-[13px] leading-relaxed ${
            isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
          }`}
          style={bubbleStyle}
        >
          {isAlert && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#2f9c85' }} />
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: '#2f9c85' }}
              >
                Alerta DEX
              </span>
            </div>
          )}
          {isTour ? (
            <>
              <p className="font-bold mb-1" style={{ color: '#5dbeb0' }}>{tourTitle}</p>
              {tourBody && <p className="whitespace-pre-line">{tourBody}</p>}
            </>
          ) : (
            <span className="whitespace-pre-line">{message.content}</span>
          )}
        </div>

        {/* Botão copiar — aparece em mensagens de texto do DEX */}
        {!isUser && !isTour && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] transition-all hover:opacity-70 active:scale-95 self-start"
            style={{ color: copied ? '#2f9c85' : isDark ? 'rgba(255,255,255,0.20)' : '#7a9e98' }}
            title="Copiar mensagem"
          >
            {copied
              ? <><Check className="w-3 h-3" /> Copiado</>
              : <><Copy className="w-3 h-3" /> Copiar</>
            }
          </button>
        )}

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => onAction(action.href)}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all hover:opacity-85 active:scale-95"
                style={
                  isDark
                    ? { background: 'rgba(47,156,133,0.15)', border: '1px solid rgba(47,156,133,0.35)', color: '#5dbeb0' }
                    : { background: '#2f9c85', border: '1px solid #267f6d', color: '#ffffff', boxShadow: '0 2px 6px rgba(47,156,133,0.25)' }
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
