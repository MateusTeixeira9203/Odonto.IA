'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Bot, Send, Mic, Sparkles, MessageSquare,
} from 'lucide-react';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import type { DexContextData } from '@/app/api/dex/context/route';
// Chave escopada por usuário — deve ser idêntica à do DexOnboarding
const userOnboardingKey = (id: string) => `dex_onboarding_v1_${id}`;

// ── Chat types ────────────────────────────────────────────────────────────────

type MessageRole = 'dex' | 'user';
type MessageType = 'text' | 'alert';

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

// ── Mock responses ────────────────────────────────────────────────────────────

function getMockResponse(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('paciente')) {
    return 'Verifiquei os registros. Posso te ajudar a localizar um paciente, acessar o histórico clínico ou registrar uma nova evolução. Qual é o nome do paciente?';
  }
  if (lower.includes('orçamento') || lower.includes('orcamento')) {
    return 'Consultei os orçamentos. Posso te ajudar a criar um novo a partir de uma evolução clínica ou verificar o status de cobranças existentes. O que precisa?';
  }
  if (lower.includes('agenda') || lower.includes('consulta')) {
    return 'Verifiquei a agenda. Posso mostrar os detalhes de cada consulta ou ajudar a encaixar um novo horário. Precisa reagendar alguém?';
  }
  if (lower.includes('whatsapp') || lower.includes('mensagem')) {
    return 'O WhatsApp está configurado para envios automáticos. Quer enviar uma confirmação para algum paciente ou verificar o status da conexão nas Configurações?';
  }
  if (lower.includes('financeiro') || lower.includes('pagamento') || lower.includes('valor')) {
    return 'Consultei o financeiro. Os pagamentos registrados estão em ordem. Quer ver um resumo do mês ou conferir um orçamento específico?';
  }
  if (lower.includes('ficha') || lower.includes('evolução') || lower.includes('evolucao')) {
    return 'Posso te ajudar com fichas clínicas. Registre uma evolução em voz ou texto e eu identifico os procedimentos e crio o orçamento automaticamente.';
  }
  return 'Entendido! Ainda estou expandindo minha inteligência para responder com mais precisão. Em breve poderei consultar dados em tempo real. Por enquanto, posso te direcionar para qualquer seção do sistema.';
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
      ? `Você tem 1 consulta hoje — o próximo é ${ctx.proximoPaciente}. `
      : 'Você tem 1 consulta agendada hoje. ';
  } else {
    msg += `Você tem ${ctx.agendamentosHoje} consultas hoje. `;
    if (ctx.proximoPaciente) {
      msg += `O próximo é ${ctx.proximoPaciente}. `;
    }
  }

  msg += 'Como posso ajudar?';
  return msg;
}

// ── WhatsApp commands ─────────────────────────────────────────────────────────

const DEX_COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: 'agenda', desc: 'Consultas de hoje' },
  { cmd: 'lucro', desc: 'Saldo financeiro do mês' },
  { cmd: 'pacientes', desc: 'Próximo a chegar' },
  { cmd: 'ajuda', desc: 'Menu de comandos' },
];

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
  // Onboarding gate: FAB is hidden until the onboarding tour is complete
  const [onboardingDone, setOnboardingDone] = useState(false);
  // Brief × badge shown right after onboarding completes (4 s)
  const [showWelcomeBadge, setShowWelcomeBadge] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    fetch('/api/dex/context')
      .then((r) => r.json())
      .then((ctx: DexContextData) => {
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
  }, [isOpen, contextLoaded, nome]);

  // Foca o input ao abrir
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setContextLoaded(false);
    setMessages([]);
    setInputValue('');
    setIsTyping(false);
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

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    setInputValue('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', type: 'text', content: text },
    ]);

    setIsTyping(true);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `d-${Date.now()}`,
          role: 'dex',
          type: 'text',
          content: getMockResponse(text),
        },
      ]);
    }, 1500);
  }, [inputValue, isTyping]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAction = useCallback(
    (href: string) => {
      handleClose();
      router.push(href);
    },
    [handleClose, router],
  );

  return (
    <>
      {/* Floating Button — hidden until onboarding completes */}
      <AnimatePresence>
        {onboardingDone && (
          <motion.button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white"
            style={{
              background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
              boxShadow: '0 8px 24px -4px rgba(47,156,133,0.5)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Abrir DEX"
          >
            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-teal pointer-events-none" />
            <Bot className="w-6 h-6 relative z-10" />

            {/* Brief × badge shown right after onboarding — "I'm here" moment */}
            <AnimatePresence>
              {showWelcomeBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWelcomeBadge(false);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center z-20 cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-2.5 h-2.5 text-teal" style={{ color: '#2f9c85' }} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            {/* Sidebar */}
            <motion.aside
              className="fixed right-0 top-0 h-full w-full sm:w-[380px] z-50 flex flex-col overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(9,9,11,0.98) 0%, rgba(13,13,13,0.99) 100%)',
                borderLeft: '1px solid rgba(47,156,133,0.20)',
                boxShadow: '-24px 0 80px -12px rgba(0,0,0,0.6)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ borderBottom: '1px solid rgba(47,156,133,0.15)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'rgba(47,156,133,0.15)',
                        border: '1px solid rgba(47,156,133,0.3)',
                      }}
                    >
                      <Bot className="w-5 h-5" style={{ color: '#2f9c85' }} />
                    </div>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 animate-pulse"
                      style={{ background: '#2f9c85', borderColor: 'rgba(9,9,11,0.98)' }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">DEX</div>
                    <div
                      className="text-[10px] font-mono"
                      style={{ color: 'rgba(47,156,133,0.8)' }}
                    >
                      SEU ASSISTENTE CLÍNICO
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowCommands((v) => !v)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: showCommands ? '#2f9c85' : 'rgba(255,255,255,0.3)' }}
                    title="Comandos WhatsApp"
                    aria-label="Comandos WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-lg transition-colors hover:text-white"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
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
                    style={{ borderBottom: '1px solid rgba(47,156,133,0.10)' }}
                  >
                    <div className="px-5 py-3 space-y-1">
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-2"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        Envie para o número da clínica
                      </p>
                      {DEX_COMMANDS.map((c) => (
                        <div key={c.cmd} className="flex items-center justify-between py-1">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: '#2f9c85' }}
                          >
                            /{c.cmd}
                          </span>
                          <span
                            className="text-[11px]"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                          >
                            {c.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat area */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} onAction={handleAction} />
                ))}

                {/* Typing indicator */}
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-end gap-2"
                    >
                      <DexAvatar />
                      <div
                        className="px-4 py-3 rounded-2xl rounded-bl-sm"
                        style={{
                          background: 'rgba(47,156,133,0.10)',
                          border: '1px solid rgba(47,156,133,0.15)',
                        }}
                      >
                        <TypingDots />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div
                className="px-4 pb-4 pt-3 shrink-0"
                style={{ borderTop: '1px solid rgba(47,156,133,0.10)' }}
              >
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-2"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Peça algo ao DEX..."
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <button
                    title="Entrada por voz — em breve"
                    className="p-1.5 rounded-lg cursor-not-allowed"
                    style={{ color: 'rgba(255,255,255,0.18)' }}
                    disabled
                    aria-label="Microfone (em breve)"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      color:
                        inputValue.trim() && !isTyping
                          ? '#2f9c85'
                          : 'rgba(255,255,255,0.18)',
                    }}
                    aria-label="Enviar mensagem"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleReplayTour}
                  className="w-full text-center text-[10px] transition-colors hover:text-white/40"
                  style={{ color: 'rgba(255,255,255,0.18)' }}
                >
                  Rever tour da plataforma
                </button>
              </div>

              {/* Footer */}
              <div
                className="px-5 py-2 shrink-0"
                style={{ borderTop: '1px solid rgba(47,156,133,0.07)' }}
              >
                <p
                  className="text-[10px] text-center"
                  style={{ color: 'rgba(255,255,255,0.15)' }}
                >
                  DEX · IA clínica pela DentIA
                  {plano && (
                    <span
                      className="ml-2 font-mono"
                      style={{ color: 'rgba(47,156,133,0.4)' }}
                    >
                      [{plano}]
                    </span>
                  )}
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DexAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'rgba(47,156,133,0.15)',
        border: '1px solid rgba(47,156,133,0.3)',
      }}
    >
      <Bot className="w-3.5 h-3.5" style={{ color: '#2f9c85' }} />
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
}

function ChatBubble({ message, onAction }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isAlert = message.type === 'alert';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && <DexAvatar />}

      <div
        className={`flex flex-col gap-2 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}
      >
        {/* Bubble */}
        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
          }`}
          style={
            isUser
              ? {
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.11)',
                  color: 'rgba(255,255,255,0.82)',
                }
              : isAlert
              ? {
                  background: 'rgba(47,156,133,0.09)',
                  border: '1px solid rgba(47,156,133,0.28)',
                  color: 'rgba(255,255,255,0.75)',
                }
              : {
                  background: 'rgba(47,156,133,0.10)',
                  border: '1px solid rgba(47,156,133,0.15)',
                  color: 'rgba(255,255,255,0.75)',
                }
          }
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
          {message.content}
        </div>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => onAction(action.href)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 active:scale-95"
                style={{
                  background: 'rgba(47,156,133,0.15)',
                  border: '1px solid rgba(47,156,133,0.35)',
                  color: '#2f9c85',
                }}
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
