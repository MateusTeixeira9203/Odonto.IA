'use client';

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageCircle,
  Bot,
  User,
  Send,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  UserCheck,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  listarConversas,
  buscarMensagens,
  assumirConversa,
  finalizarConversa,
  enviarMensagemManual,
  type ConversaItem,
  type MensagemItem,
} from '../actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTelefone(t: string): string {
  const d = t.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return t;
}

function tempoRelativo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '—';
  }
}

function etapaLabel(etapa: string): string {
  const mapa: Record<string, string> = {
    inicio:                 'Menu',
    coletando_nome:         'Coletando nome',
    coletando_motivo:       'Coletando motivo',
    selecionando_dentista:  'Escolhendo dentista',
    oferecendo_horarios:    'Escolhendo horário',
    aguardando_confirmacao: 'Confirmando horário',
    confirmado:             'Agendado',
    humano:                 'Com atendente',
    enviando_pdf:           'Enviando PDF',
  };
  return mapa[etapa] ?? etapa;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function BadgeStatus({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-medium">
      <Bot className="w-3 h-3" /> Bot
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-medium">
      <User className="w-3 h-3" /> Humano
    </span>
  );
}

function ConversaCard({
  conversa,
  selecionada,
  onClick,
}: {
  conversa: ConversaItem;
  selecionada: boolean;
  onClick: () => void;
}) {
  const nome    = conversa.paciente?.nome ?? null;
  const telefone = formatTelefone(conversa.telefone);

  return (
    <motion.button
      layout
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-[--color-border] transition-colors
        ${selecionada
          ? 'bg-[--color-teal-pale] dark:bg-teal/10 border-l-2 border-l-[--color-teal]'
          : 'hover:bg-[--color-surface-alt] dark:hover:bg-white/5'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[--color-teal-pale] flex items-center justify-center shrink-0 text-[--color-teal] font-bold text-sm">
            {nome ? nome[0].toUpperCase() : <Phone className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-[--color-black] dark:text-white truncate">
              {nome ?? 'Sem cadastro'}
            </p>
            <p className="text-xs font-mono text-[--color-gray-md] truncate">{telefone}</p>
          </div>
        </div>
        <span className="text-xs text-[--color-gray-md] whitespace-nowrap shrink-0">
          {tempoRelativo(conversa.ultimo_contato)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <BadgeStatus ativo={conversa.ativo} />
        <span className="text-xs text-[--color-gray-md]">{etapaLabel(conversa.etapa)}</span>
      </div>
    </motion.button>
  );
}

function BubbleMensagem({ mensagem }: { mensagem: MensagemItem }) {
  const isSaida = mensagem.direcao === 'saida';
  return (
    <div className={`flex ${isSaida ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words
          ${isSaida
            ? 'bg-[--color-teal] text-white rounded-br-sm'
            : 'bg-[--color-surface-alt] text-[--color-black] dark:bg-white/10 dark:text-white rounded-bl-sm'
          }`}
      >
        {mensagem.conteudo}
        <p className={`text-[10px] mt-1 text-right ${isSaida ? 'text-white/60' : 'text-[--color-gray-md]'}`}>
          {tempoRelativo(mensagem.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = 'todas' | 'bot' | 'humano';

interface Props {
  initialConversas: ConversaItem[];
  clinicaId: string;
}

export function WhatsAppClient({ initialConversas, clinicaId }: Props) {
  const [conversas, setConversas]             = useState<ConversaItem[]>(initialConversas);
  const [tab, setTab]                         = useState<Tab>('todas');
  const [conversaSelecionada, setSelecionada] = useState<ConversaItem | null>(null);
  const [mensagens, setMensagens]             = useState<MensagemItem[]>([]);
  const [inputTexto, setInputTexto]           = useState('');
  const [aviso, setAviso]                     = useState<string | null>(null);

  const [isPending, startTransition]  = useTransition();
  const [enviando, setEnviando]       = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);

  // ── Scroll para o fim das mensagens ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // ── Polling: conversas a cada 5s ───────────────────────────────────────────
  const refreshConversas = useCallback(async () => {
    const novas = await listarConversas();
    setConversas(novas);
    // Atualiza a conversa selecionada se ainda existir
    if (conversaSelecionada) {
      const atualizada = novas.find(c => c.id === conversaSelecionada.id);
      if (atualizada) setSelecionada(atualizada);
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    const interval = setInterval(() => void refreshConversas(), 5_000);
    return () => clearInterval(interval);
  }, [refreshConversas]);

  // ── Polling: mensagens a cada 3s quando conversa aberta ───────────────────
  useEffect(() => {
    if (!conversaSelecionada) return;

    void buscarMensagens(conversaSelecionada.id).then(setMensagens);

    const interval = setInterval(async () => {
      const msgs = await buscarMensagens(conversaSelecionada.id);
      setMensagens(msgs);
    }, 3_000);

    return () => clearInterval(interval);
  }, [conversaSelecionada?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selecionar conversa ────────────────────────────────────────────────────
  const handleSelecionar = (conversa: ConversaItem) => {
    setSelecionada(conversa);
    setMensagens([]);
    setAviso(null);
    setInputTexto('');
  };

  // ── Atualização manual ─────────────────────────────────────────────────────
  const handleAtualizar = async () => {
    setAtualizando(true);
    await refreshConversas();
    setAtualizando(false);
  };

  // ── Assumir conversa (bot → humano) ───────────────────────────────────────
  const handleAssumir = () => {
    if (!conversaSelecionada) return;
    startTransition(async () => {
      await assumirConversa(conversaSelecionada.id);
      await refreshConversas();
    });
  };

  // ── Finalizar conversa (humano → bot) ─────────────────────────────────────
  const handleFinalizar = () => {
    if (!conversaSelecionada) return;
    startTransition(async () => {
      await finalizarConversa(conversaSelecionada.id);
      await refreshConversas();
    });
  };

  // ── Enviar mensagem manual ─────────────────────────────────────────────────
  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversaSelecionada || !inputTexto.trim() || enviando) return;

    const conteudo = inputTexto.trim();
    setInputTexto('');
    setEnviando(true);
    setAviso(null);

    const resultado = await enviarMensagemManual(
      conversaSelecionada.id,
      clinicaId,
      conversaSelecionada.telefone,
      conteudo,
    );

    if (resultado.aviso) setAviso(resultado.aviso);
    const msgs = await buscarMensagens(conversaSelecionada.id);
    setMensagens(msgs);
    setEnviando(false);
    textareaRef.current?.focus();
  };

  // ── Filtro de tab ──────────────────────────────────────────────────────────
  const conversasFiltradas = conversas.filter(c => {
    if (tab === 'bot')    return c.ativo;
    if (tab === 'humano') return !c.ativo;
    return true;
  });

  const totalHumano = conversas.filter(c => !c.ativo).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[--color-bg]">

      {/* ── Painel esquerdo: lista de conversas ─────────────────────────── */}
      <div
        className={`
          w-full sm:w-80 lg:w-96 flex-shrink-0
          flex flex-col border-r border-[--color-border]
          bg-[--color-surface] dark:bg-zinc-900
          ${conversaSelecionada ? 'hidden sm:flex' : 'flex'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-[--color-border] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[--color-teal]" />
            <div>
              <h1 className="font-serif text-lg font-semibold text-[--color-black] dark:text-white leading-none">
                WhatsApp
              </h1>
              <p className="text-xs text-[--color-gray-md] mt-0.5">{conversas.length} conversa(s)</p>
            </div>
          </div>
          <button
            onClick={() => void handleAtualizar()}
            className="p-1.5 rounded-lg hover:bg-[--color-surface-alt] text-[--color-gray-md] transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[--color-border]">
          {(['todas', 'bot', 'humano'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors
                ${tab === t
                  ? 'text-[--color-teal] border-b-2 border-[--color-teal]'
                  : 'text-[--color-gray-md] hover:text-[--color-black] dark:hover:text-white'
                }`}
            >
              {t === 'todas' ? `Todas (${conversas.length})`
                : t === 'bot' ? `Bot (${conversas.length - totalHumano})`
                : `Humano (${totalHumano})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[--color-gray-md]">
              <MessageCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma conversa</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {conversasFiltradas.map(c => (
                <ConversaCard
                  key={c.id}
                  conversa={c}
                  selecionada={conversaSelecionada?.id === c.id}
                  onClick={() => handleSelecionar(c)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Painel direito: detalhe da conversa ──────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col overflow-hidden
          ${conversaSelecionada ? 'flex' : 'hidden sm:flex'}
        `}
      >
        {!conversaSelecionada ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 text-[--color-gray-md]"
          >
            <MessageCircle className="w-16 h-16 opacity-20" />
            <p className="text-base font-medium">Selecione uma conversa</p>
            <p className="text-sm opacity-70">Clique em um contato para ver o histórico</p>
          </motion.div>
        ) : (
          <motion.div
            key={conversaSelecionada.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Header da conversa */}
            <div className="px-4 py-3 border-b border-[--color-border] bg-[--color-surface] dark:bg-zinc-900 flex items-center gap-3">
              {/* Botão voltar (mobile) */}
              <button
                onClick={() => setSelecionada(null)}
                className="sm:hidden p-1.5 rounded-lg hover:bg-[--color-surface-alt] text-[--color-gray-md]"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-[--color-teal-pale] flex items-center justify-center text-[--color-teal] font-bold shrink-0">
                {conversaSelecionada.paciente?.nome?.[0]?.toUpperCase() ?? <Phone className="w-4 h-4" />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[--color-black] dark:text-white truncate">
                  {conversaSelecionada.paciente?.nome ?? 'Sem cadastro'}
                </p>
                <p className="text-xs font-mono text-[--color-gray-md]">
                  {formatTelefone(conversaSelecionada.telefone)}
                </p>
              </div>

              {/* Status + ações */}
              <div className="flex items-center gap-2 shrink-0">
                <BadgeStatus ativo={conversaSelecionada.ativo} />
                {conversaSelecionada.ativo ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAssumir}
                    disabled={isPending}
                    className="text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Assumir
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleFinalizar}
                    disabled={isPending}
                    className="text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Devolver ao bot
                  </Button>
                )}
              </div>
            </div>

            {/* Aviso de erro/warning */}
            <AnimatePresence>
              {aviso && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs flex justify-between items-center">
                    <span>{aviso}</span>
                    <button onClick={() => setAviso(null)} className="ml-2 opacity-70 hover:opacity-100">×</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {mensagens.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[--color-gray-md] text-sm opacity-60">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                mensagens.map(m => <BubbleMensagem key={m.id} mensagem={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de resposta */}
            <div className="border-t border-[--color-border] bg-[--color-surface] dark:bg-zinc-900 p-3">
              <form onSubmit={(e) => void handleEnviar(e)} className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={inputTexto}
                  onChange={e => setInputTexto(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleEnviar(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  className="flex-1 min-h-[44px] max-h-32 resize-none text-sm rounded-xl border-[--color-border] focus:border-[--color-teal] focus:ring-[--color-teal]/20"
                  rows={1}
                />
                <Button
                  type="submit"
                  disabled={!inputTexto.trim() || enviando}
                  className="h-11 w-11 p-0 shrink-0 bg-[--color-teal] hover:bg-[--color-teal-lt] rounded-xl"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
