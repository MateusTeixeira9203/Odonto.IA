'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WifiOff,
  QrCode,
  RefreshCw,
  Loader2,
  CheckCircle2,
  BotMessageSquare,
  Phone,
  Save,
  Sparkles,
  MessageSquare,
  Zap,
  Bot,
  CalendarCheck,
  Ban,
  PlayCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { WhatsAppStatus } from '@/services/whatsapp.service';
import type { BotMensagens } from '@/lib/whatsapp/template';
import type { DentistaRole } from '@/types/database';
import { salvarMensagensBot } from '../actions';

type Tab = 'identidade' | 'saudacoes' | 'respostas';

interface InstanceApiResponse {
  status?: string;
  qrcode?: string | null;
  instanceName?: string;
  error?: string;
}

interface BotPageClientProps {
  initialStatus:       WhatsAppStatus;
  initialQrcode:       string | null;
  initialInstanceName: string | null;
  initialMensagens:    BotMensagens;
  role:                DentistaRole;
  clinicaNome:         string;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function normalizeStatus(raw: string | undefined): WhatsAppStatus {
  if (raw === 'connected' || raw === 'open')                            return 'connected';
  if (raw === 'connecting')                                              return 'connecting';
  if (raw === 'inactive' || raw === 'close' || raw === 'disconnected') return 'disconnected';
  return 'error';
}

function parsePreview(text: string, assistente: string, clinicaNome: string): string {
  return text
    .replace(/\{\{nome\}\}/g,       'João')
    .replace(/\{\{clinica\}\}/g,    clinicaNome || 'Minha Clínica')
    .replace(/\{\{assistente\}\}/g, assistente  || 'DEX')
    .replace(/\{\{dentista\}\}/g,   'Dr. Carlos')
    .replace(/\{\{data_hora\}\}/g,  'quarta, 23/04 às 14h00');
}

function waBold(text: string): ReactNode[] {
  return text.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ─── Sub-componentes visuais ──────────────────────────────────────────────────

function StatusPill({ status }: { status: WhatsAppStatus }) {
  const map: Record<WhatsAppStatus, { label: string; color: string; dot: string }> = {
    connected:    { label: 'Conectado',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500' },
    connecting:   { label: 'Conectando…', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',           dot: 'bg-amber-400 animate-pulse' },
    disconnected: { label: 'Desconectado',color: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700',                dot: 'bg-zinc-400' },
    error:        { label: 'Erro',         color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',                       dot: 'bg-red-500' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── WhatsApp phone mockup ────────────────────────────────────────────────────

function ChatBubble({ text, side = 'left', time }: { text: string; side?: 'left' | 'right'; time?: string }) {
  const lines = text.split('\n');
  return (
    <div className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[88%] px-2.5 py-1.5 text-[10px] leading-snug shadow-sm ${
          side === 'right'
            ? 'bg-[#dcf8c6] text-gray-800 rounded-[10px] rounded-tr-[3px]'
            : 'bg-white text-gray-800 rounded-[10px] rounded-tl-[3px]'
        }`}
      >
        {lines.map((line, i, arr) => (
          <span key={i}>
            {waBold(line)}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
        {time && <span className="block text-right text-[8px] text-gray-400 mt-0.5">{time}</span>}
      </div>
    </div>
  );
}

function WaButton({ label }: { label: string }) {
  return (
    <div className="flex justify-center mt-1 mb-1">
      <div className="w-[90%] px-2 py-1.5 rounded-[10px] bg-white border border-[#25d366]/40 text-[10px] text-[#128c7e] font-semibold text-center shadow-sm">
        {label}
      </div>
    </div>
  );
}

function WaDivider({ label }: { label: string }) {
  return (
    <>
      <div className="h-px bg-[#ccc]/40 my-2.5" />
      <p className="text-[8px] text-center text-[#999] mb-1.5 font-semibold tracking-widest uppercase">{label}</p>
    </>
  );
}

function PhonePreview({
  tab,
  mensagens,
  clinicaNome,
}: {
  tab: Tab;
  mensagens: BotMensagens;
  clinicaNome: string;
}) {
  const assistente = mensagens.nome_assistente || 'DEX';

  const renderBubbles = () => {
    if (tab === 'identidade') {
      return (
        <>
          <ChatBubble text="oi" side="right" time="14:00" />
          <ChatBubble
            text={`Olá! Seja bem-vindo(a) à ${clinicaNome || 'Minha Clínica'}! 😊\nSou o *${assistente}*, assistente virtual.`}
            time="14:00"
          />
          <WaButton label={mensagens.titulo_menu_principal || 'Agendar Consulta'} />
        </>
      );
    }
    if (tab === 'saudacoes') {
      return (
        <>
          <p className="text-[8px] text-center text-[#999] mb-1.5 mt-0.5 font-semibold tracking-widest uppercase">Paciente novo</p>
          <ChatBubble text="oi" side="right" time="14:00" />
          <ChatBubble text={parsePreview(mensagens.msg_novo_paciente, assistente, clinicaNome)} time="14:00" />
          <WaDivider label="Paciente retornando" />
          <ChatBubble text="oi" side="right" time="14:05" />
          <ChatBubble text={parsePreview(mensagens.msg_paciente_antigo, assistente, clinicaNome)} time="14:05" />
        </>
      );
    }
    return (
      <>
        <p className="text-[8px] text-center text-[#999] mb-1.5 mt-0.5 font-semibold tracking-widest uppercase">Confirmação</p>
        <ChatBubble text={parsePreview(mensagens.msg_confirmacao, assistente, clinicaNome)} time="14:10" />
        <WaDivider label="Sem horários" />
        <ChatBubble text={parsePreview(mensagens.msg_sem_horario, assistente, clinicaNome)} time="14:11" />
      </>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary font-mono mb-3">Pré-visualização</p>
      <div
        className="w-60 rounded-[2.5rem] overflow-hidden"
        style={{
          background: '#111',
          border: '7px solid #1c1c1c',
          boxShadow: '0 30px 70px -15px rgba(0,0,0,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.06)',
        }}
      >
        {/* Status bar */}
        <div className="bg-[#111] px-4 pt-2 pb-1 flex items-center justify-between">
          <span className="text-white/70 text-[8px] font-medium">9:41</span>
          <div className="w-14 h-3 bg-black rounded-full" />
          <span className="text-white/70 text-[8px]">100%</span>
        </div>
        {/* WA header */}
        <div className="bg-[#075e54] px-3 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#128c7e] flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-[11px] font-bold leading-tight truncate">{clinicaNome || 'Minha Clínica'}</p>
            <p className="text-[#b2dfdb] text-[9px] leading-tight">{assistente} · online</p>
          </div>
        </div>
        {/* Chat area */}
        <div
          className="px-2.5 py-2 overflow-y-auto"
          style={{ minHeight: 200, maxHeight: 340, background: '#e5ddd5' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderBubbles()}
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Input bar */}
        <div className="bg-[#f0f0f0] px-2 py-1.5 flex items-center gap-1.5">
          <div className="flex-1 bg-white rounded-full px-2.5 py-1">
            <span className="text-[9px] text-gray-400">Mensagem</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] leading-none">↑</span>
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-[9px] text-text-secondary text-center max-w-52 leading-relaxed">
        Prévia com dados de exemplo — as mensagens reais usam os dados do paciente.
      </p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function BotPageClient({
  initialStatus,
  initialQrcode,
  initialInstanceName,
  initialMensagens,
  role,
  clinicaNome,
}: BotPageClientProps) {
  const [status,        setStatus]        = useState<WhatsAppStatus>(initialStatus);
  const [qrcode,        setQrcode]        = useState<string | null>(initialQrcode);
  const [instanceName,  setInstanceName]  = useState<string | null>(initialInstanceName);
  const [actionLoading, setActionLoading] = useState(false);
  const [mensagens,     setMensagens]     = useState<BotMensagens>(initialMensagens);
  const [salvandoMsg,   setSalvandoMsg]   = useState(false);
  const [activeTab,     setActiveTab]     = useState<Tab>('identidade');
  const [testeNumero,   setTesteNumero]   = useState('');
  const [testeLoading,  setTesteLoading]  = useState(false);

  const canManage = role === 'admin' || role === 'secretaria';

  useEffect(() => {
    if (status !== 'connecting') return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch('/api/whatsapp/instance');
        const data = await res.json() as InstanceApiResponse;
        const next = normalizeStatus(data.status);
        setStatus(next);
        if (data.qrcode) setQrcode(data.qrcode);
        if (next === 'connected') {
          clearInterval(interval);
          setQrcode(null);
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch { /* ignora erros de rede */ }
    }, 3_000);
    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/instance', { method: 'POST' });
      const data = await res.json() as InstanceApiResponse;
      if (!res.ok) { toast.error(data.error ?? 'Erro ao criar instância'); return; }
      setInstanceName(data.instanceName ?? null);
      setStatus('connecting');
      setQrcode(data.qrcode ?? null);
      toast.success('Instância criada! Escaneie o QR Code.');
    } catch { toast.error('Erro ao conectar WhatsApp'); }
    finally { setActionLoading(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?\n\nO bot deixará de atender automaticamente até reconectar.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instance', { method: 'DELETE' });
      if (!res.ok) { toast.error('Erro ao desconectar'); return; }
      setInstanceName(null);
      setStatus('disconnected');
      setQrcode(null);
      toast.success('WhatsApp desconectado');
    } catch { toast.error('Erro ao desconectar WhatsApp'); }
    finally { setActionLoading(false); }
  };

  const handleSalvar = async () => {
    setSalvandoMsg(true);
    try {
      const r = await salvarMensagensBot(mensagens);
      if (r.ok) toast.success('Mensagens salvas!');
      else toast.error(r.erro ?? 'Erro ao salvar');
    } catch { toast.error('Erro ao salvar mensagens'); }
    finally { setSalvandoMsg(false); }
  };

  const handleSimularFluxo = async () => {
    if (!testeNumero.trim()) { toast.error('Informe o número de destino'); return; }
    setTesteLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/testar-fluxo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ numero: testeNumero }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Erro ao simular fluxo'); return; }
      toast.success('Fluxo iniciado! Verifique o WhatsApp do número informado.');
      setTesteNumero('');
    } catch { toast.error('Erro ao simular fluxo'); }
    finally { setTesteLoading(false); }
  };

  const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: 'identidade', label: 'Identidade', icon: <Bot className="w-3.5 h-3.5" /> },
    { id: 'saudacoes',  label: 'Saudações',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'respostas',  label: 'Respostas',  icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative max-w-5xl mx-auto p-8 space-y-6"
    >
      {/* ── Em Breve overlay ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-50 rounded-3xl backdrop-blur-sm bg-bg/60 flex flex-col items-center justify-center gap-4 pointer-events-auto">
        <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center">
          <BotMessageSquare className="w-7 h-7 text-teal" />
        </div>
        <div className="text-center">
          <p className="font-heading text-3xl text-text-primary mb-2">Em Breve</p>
          <p className="text-sm text-text-secondary max-w-xs">
            O bot de atendimento automático estará disponível com a integração oficial do WhatsApp.
          </p>
        </div>
      </div>
      {/* ── Cabeçalho ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal/10 flex items-center justify-center shrink-0">
            <BotMessageSquare className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h1 className="font-heading text-2xl text-text-primary leading-none mb-1">Bot WhatsApp</h1>
            <p className="text-sm text-text-secondary">
              Assistente automático que agenda consultas 24h pelo WhatsApp
            </p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      {/* ── Conexão (full width, compacto) ────────────────────────────────────── */}
      {canManage && (
        <div className="bg-surface rounded-3xl border border-border p-5">
          <AnimatePresence mode="wait">
            {(status === 'disconnected' || status === 'error') && (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <WifiOff className="w-5 h-5 text-text-secondary shrink-0" />
                  <div>
                    <p className="font-semibold text-text-primary text-sm">WhatsApp desconectado</p>
                    <p className="text-xs text-text-secondary mt-0.5">O bot não está atendendo. Conecte para ativar o atendimento automático.</p>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shrink-0"
                  style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Conectar via QR Code
                </button>
              </motion.div>
            )}

            {status === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-center gap-6"
              >
                <div className="bg-white p-4 rounded-2xl shadow-lg ring-4 ring-teal/10 shrink-0">
                  {qrcode && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                      alt="QR Code WhatsApp"
                      className="w-44 h-44"
                    />
                  )}
                </div>
                <div>
                  <p className="font-bold text-text-primary mb-1 text-sm">Escaneie com o WhatsApp</p>
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">
                    No celular da clínica, abra o WhatsApp → <strong>Configurações</strong> →{' '}
                    <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
                  </p>
                  <div className="flex items-center gap-2 text-teal/70 text-sm">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Aguardando conexão…
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Bot ativo e atendendo</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Pacientes que enviarem mensagem recebem resposta automática do DEX.
                      {instanceName && <span className="font-mono ml-1 opacity-40 text-[10px]">({instanceName})</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl transition-all disabled:opacity-60 shrink-0"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                  Desconectar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Duas colunas: Form + Preview ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_256px] gap-6 items-start">

        {/* Coluna esquerda: Tabs + Formulário */}
        <div className="bg-surface rounded-3xl border border-border p-6 space-y-5">

          {/* Seletor de tabs */}
          <div className="flex gap-1 p-1 bg-surface-alt rounded-2xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-surface text-teal shadow-sm border border-border'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dica de variáveis */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-teal/5 border border-teal/15 px-3.5 py-2.5">
            <Sparkles className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Variáveis disponíveis:{' '}
              {(['{{nome}}', '{{clinica}}', '{{assistente}}', '{{dentista}}', '{{data_hora}}'] as const).map((v, i) => (
                <span key={v}>
                  <code className="font-mono bg-teal/10 text-teal px-1 py-0.5 rounded text-[10px]">{v}</code>
                  {i < 4 ? ' · ' : ''}
                </span>
              ))}
            </p>
          </div>

          {/* Conteúdo da tab */}
          <AnimatePresence mode="wait">
            {activeTab === 'identidade' && (
              <motion.div
                key="identidade"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Nome do Assistente</label>
                  </div>
                  <Input
                    value={mensagens.nome_assistente}
                    onChange={e => setMensagens(p => ({ ...p, nome_assistente: e.target.value }))}
                    placeholder="Ex: DEX"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-text-secondary">
                    Nome com o qual o bot se apresenta, usado via <code className="font-mono text-teal text-[10px]">{'{{assistente}}'}</code> em todas as mensagens.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Botão do Menu Principal</label>
                  </div>
                  <Input
                    value={mensagens.titulo_menu_principal}
                    onChange={e => setMensagens(p => ({ ...p, titulo_menu_principal: e.target.value }))}
                    placeholder="Ex: Agendar Consulta"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-text-secondary">
                    Texto do botão que o paciente pressiona para iniciar o agendamento.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'saudacoes' && (
              <motion.div
                key="saudacoes"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Saudação — Paciente Novo</label>
                  </div>
                  <Textarea
                    value={mensagens.msg_novo_paciente}
                    onChange={e => setMensagens(p => ({ ...p, msg_novo_paciente: e.target.value }))}
                    placeholder="Ex: Olá! Seja bem-vindo(a) à {{clinica}}! Sou o {{assistente}}."
                    rows={3}
                    className="rounded-xl resize-none"
                  />
                  <p className="text-xs text-text-secondary">Enviada na primeira mensagem de quem nunca entrou em contato.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Saudação — Paciente Retornando</label>
                  </div>
                  <Textarea
                    value={mensagens.msg_paciente_antigo}
                    onChange={e => setMensagens(p => ({ ...p, msg_paciente_antigo: e.target.value }))}
                    placeholder="Ex: Olá, {{nome}}! Sou o {{assistente}}. Como posso te ajudar hoje?"
                    rows={3}
                    className="rounded-xl resize-none"
                  />
                  <p className="text-xs text-text-secondary">Enviada quando um paciente já cadastrado manda nova mensagem.</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'respostas' && (
              <motion.div
                key="respostas"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Mensagem de Confirmação</label>
                  </div>
                  <Textarea
                    value={mensagens.msg_confirmacao}
                    onChange={e => setMensagens(p => ({ ...p, msg_confirmacao: e.target.value }))}
                    placeholder="Ex: ✅ Agendamento confirmado pelo {{assistente}}! Dentista: {{dentista}} | Data: {{data_hora}}"
                    rows={4}
                    className="rounded-xl resize-none"
                  />
                  <p className="text-xs text-text-secondary">
                    Enviada após o paciente confirmar o horário. Usa{' '}
                    <code className="font-mono text-teal text-[10px]">{'{{dentista}}'}</code> e{' '}
                    <code className="font-mono text-teal text-[10px]">{'{{data_hora}}'}</code>.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Ban className="w-3.5 h-3.5 text-teal" />
                    <label className="text-sm font-semibold text-text-primary">Sem Horários Disponíveis</label>
                  </div>
                  <Textarea
                    value={mensagens.msg_sem_horario}
                    onChange={e => setMensagens(p => ({ ...p, msg_sem_horario: e.target.value }))}
                    placeholder="Ex: Não encontrei horários disponíveis. Tente outro dentista ou outra data!"
                    rows={2}
                    className="rounded-xl resize-none"
                  />
                  <p className="text-xs text-text-secondary">
                    Enviada quando não há horários livres para o dentista ou data selecionada.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão salvar */}
          <button
            onClick={handleSalvar}
            disabled={salvandoMsg}
            className="w-full flex items-center justify-center gap-2 py-3 bg-teal hover:bg-teal-lt text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60"
            style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
          >
            {salvandoMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Mensagens
          </button>
        </div>

        {/* Coluna direita: Mockup do WhatsApp */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <PhonePreview tab={activeTab} mensagens={mensagens} clinicaNome={clinicaNome} />
          </div>
        </div>
      </div>

      {/* ── Testar fluxo completo (só quando conectado) ───────────────────────── */}
      {canManage && (
        <AnimatePresence>
          {status === 'connected' && (
            <motion.div
              key="teste"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-surface rounded-3xl border border-border p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-teal flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white">3</span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary font-mono">
                  Testar Fluxo Completo
                </p>
              </div>
              <p className="text-sm text-text-secondary mb-4 ml-8">
                Simule um atendimento completo do DEX. O bot vai enviar mensagens para o número informado como se fosse um paciente novo — você pode interagir pelo celular para sentir o fluxo.
              </p>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="space-y-1.5 flex-1 min-w-52 max-w-xs">
                  <label className="text-sm font-semibold text-text-primary">Número de destino</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <Input
                      placeholder="5511999999999"
                      value={testeNumero}
                      onChange={e => setTesteNumero(e.target.value)}
                      className="pl-9 rounded-xl"
                    />
                  </div>
                  <p className="text-xs text-text-secondary">País + DDD + número, sem espaços ou hífens</p>
                </div>
                <button
                  onClick={handleSimularFluxo}
                  disabled={testeLoading || !testeNumero.trim()}
                  className="flex items-center gap-2 px-5 py-3 bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shrink-0"
                  style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
                >
                  {testeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Simular Atendimento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
