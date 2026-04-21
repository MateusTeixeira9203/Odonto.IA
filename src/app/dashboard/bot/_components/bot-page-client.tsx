'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WifiOff,
  QrCode,
  RefreshCw,
  Loader2,
  Send,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { WhatsAppStatus } from '@/services/whatsapp.service';
import type { BotMensagens } from '@/lib/whatsapp/template';
import type { DentistaRole } from '@/types/database';
import { salvarMensagensBot } from '../actions';

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
}

function StatusPill({ status }: { status: WhatsAppStatus }) {
  const map: Record<WhatsAppStatus, { label: string; color: string; dot: string }> = {
    connected:    { label: 'Conectado',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', dot: 'bg-emerald-500' },
    connecting:   { label: 'Conectando…',  color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',           dot: 'bg-amber-400 animate-pulse' },
    disconnected: { label: 'Desconectado', color: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700',                dot: 'bg-zinc-400' },
    error:        { label: 'Erro',          color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',                       dot: 'bg-red-500' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-6 h-6 rounded-full bg-teal flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-white">{n}</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary font-mono">{label}</p>
    </div>
  );
}

export function BotPageClient({
  initialStatus,
  initialQrcode,
  initialInstanceName,
  initialMensagens,
  role,
}: BotPageClientProps) {
  const [status,        setStatus]        = useState<WhatsAppStatus>(initialStatus);
  const [qrcode,        setQrcode]        = useState<string | null>(initialQrcode);
  const [instanceName,  setInstanceName]  = useState<string | null>(initialInstanceName);
  const [actionLoading, setActionLoading] = useState(false);

  const [testeNumero,   setTesteNumero]   = useState('');
  const [testeMensagem, setTesteMensagem] = useState('Olá! Este é um teste da DentIA. 👋');
  const [testeLoading,  setTesteLoading]  = useState(false);

  const [mensagens,   setMensagens]   = useState<BotMensagens>(initialMensagens);
  const [salvandoMsg, setSalvandoMsg] = useState(false);

  const canManageConnection = role === 'admin' || role === 'secretaria';

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

  const handleEnviarTeste = async () => {
    if (!testeNumero.trim()) { toast.error('Informe o número de destino'); return; }
    setTesteLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/enviar-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: testeNumero, mensagem: testeMensagem }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast.error(data.error ?? 'Erro ao enviar mensagem'); return; }
      toast.success('Mensagem de teste enviada!');
      setTesteNumero('');
    } catch { toast.error('Erro ao enviar mensagem de teste'); }
    finally { setTesteLoading(false); }
  };

  const handleSalvarMensagens = async () => {
    setSalvandoMsg(true);
    try {
      const resultado = await salvarMensagensBot(mensagens);
      if (resultado.ok) toast.success('Mensagens salvas com sucesso!');
      else toast.error(resultado.erro ?? 'Erro ao salvar');
    } catch { toast.error('Erro ao salvar mensagens'); }
    finally { setSalvandoMsg(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto p-8 space-y-6"
    >
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

      {/* ── Passo 1: Conexão ──────────────────────────────────────────────────── */}
      {canManageConnection && (
        <div className="bg-surface rounded-3xl border border-border p-6">
          <StepLabel n={1} label="Conectar WhatsApp" />

          <AnimatePresence mode="wait">
            {/* Desconectado ou erro */}
            {(status === 'disconnected' || status === 'error') && (
              <motion.div
                key="disconnected"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-alt border border-border flex-1">
                  <WifiOff className="w-8 h-8 text-text-secondary shrink-0" />
                  <div>
                    <p className="font-semibold text-text-primary text-sm">Bot desconectado</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Conecte o WhatsApp da clínica para o bot começar a atender automaticamente.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-3 bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 shrink-0"
                  style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
                >
                  {actionLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <QrCode className="w-4 h-4" />}
                  Conectar via QR Code
                </button>
              </motion.div>
            )}

            {/* Conectando — QR Code */}
            {status === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4 gap-5"
              >
                <div className="bg-white p-5 rounded-2xl shadow-xl ring-4 ring-teal/10">
                  {qrcode && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                      alt="QR Code WhatsApp"
                      className="w-52 h-52"
                    />
                  )}
                </div>
                <div className="text-center max-w-xs">
                  <p className="font-semibold text-text-primary mb-1">Escaneie com o WhatsApp</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    No celular da clínica, abra o WhatsApp → <strong>Configurações</strong> → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-teal/70 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Aguardando conexão…
                </div>
              </motion.div>
            )}

            {/* Conectado */}
            {status === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Bot ativo e atendendo</p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-500 mt-0.5">
                      Pacientes que enviarem mensagem recebem resposta automática do bot.
                    </p>
                    {instanceName && (
                      <p className="text-[10px] font-mono text-emerald-600/50 mt-1">Instância: {instanceName}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl transition-all disabled:opacity-60 shrink-0"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                  Desconectar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Passo 2: Personalizar Mensagens ───────────────────────────────────── */}
      <div className="bg-surface rounded-3xl border border-border p-6 space-y-5">
        <StepLabel n={2} label="Personalizar Mensagens do Bot" />

        {/* Variáveis disponíveis */}
        <div className="flex items-start gap-3 rounded-2xl bg-teal/5 border border-teal/15 px-4 py-3">
          <Sparkles className="w-4 h-4 text-teal shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary leading-relaxed">
            Variáveis substituídas automaticamente:{' '}
            {(['{{nome}}', '{{clinica}}', '{{assistente}}', '{{dentista}}', '{{data_hora}}'] as const).map((v, i) => (
              <span key={v}><code className="font-mono bg-teal/10 text-teal px-1.5 py-0.5 rounded-md">{v}</code>{i < 4 ? ' · ' : ''}</span>
            ))}
          </p>
        </div>

        <div className="space-y-5">
          {/* Nome do assistente */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Nome do Assistente</label>
            </div>
            <Input
              value={mensagens.nome_assistente}
              onChange={e => setMensagens(prev => ({ ...prev, nome_assistente: e.target.value }))}
              placeholder="Ex: DEX"
              className="rounded-xl"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Nome com o qual o bot se apresenta. Usado automaticamente em todas as mensagens via <code className="font-mono text-teal text-[11px]">{'{{assistente}}'}</code>.
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Título do Menu */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Botão do Menu Principal</label>
            </div>
            <Input
              value={mensagens.titulo_menu_principal}
              onChange={e => setMensagens(prev => ({ ...prev, titulo_menu_principal: e.target.value }))}
              placeholder="Ex: Agendar Consulta"
              className="rounded-xl"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Texto do botão que o paciente pressiona para iniciar o agendamento.
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Mensagem novo paciente */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Saudação — Paciente Novo</label>
            </div>
            <Textarea
              value={mensagens.msg_novo_paciente}
              onChange={e => setMensagens(prev => ({ ...prev, msg_novo_paciente: e.target.value }))}
              placeholder="Ex: Olá! Seja bem-vindo(a) à {{clinica}}! Sou o {{assistente}}, assistente virtual da clínica."
              rows={3}
              className="rounded-xl resize-none"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Enviada na primeira mensagem de quem nunca entrou em contato.
            </p>
          </div>

          {/* Mensagem paciente antigo */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Saudação — Paciente Retornando</label>
            </div>
            <Textarea
              value={mensagens.msg_paciente_antigo}
              onChange={e => setMensagens(prev => ({ ...prev, msg_paciente_antigo: e.target.value }))}
              placeholder="Ex: Olá, {{nome}}! Sou o {{assistente}}. Como posso te ajudar hoje?"
              rows={3}
              className="rounded-xl resize-none"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Enviada quando um paciente já cadastrado manda nova mensagem.
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Mensagem de confirmação */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Mensagem de Confirmação</label>
            </div>
            <Textarea
              value={mensagens.msg_confirmacao}
              onChange={e => setMensagens(prev => ({ ...prev, msg_confirmacao: e.target.value }))}
              placeholder="Ex: ✅ Agendamento confirmado pelo {{assistente}}! Dentista: {{dentista}} | Data: {{data_hora}}"
              rows={4}
              className="rounded-xl resize-none"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Enviada após o paciente confirmar o horário. Variáveis: <code className="font-mono text-teal text-[11px]">{'{{dentista}}'}</code> e <code className="font-mono text-teal text-[11px]">{'{{data_hora}}'}</code>.
            </p>
          </div>

          {/* Mensagem sem horário */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Ban className="w-3.5 h-3.5 text-teal" />
              <label className="text-sm font-semibold text-text-primary">Sem Horários Disponíveis</label>
            </div>
            <Textarea
              value={mensagens.msg_sem_horario}
              onChange={e => setMensagens(prev => ({ ...prev, msg_sem_horario: e.target.value }))}
              placeholder="Ex: Não encontrei horários disponíveis. Tente outro dentista ou outra data!"
              rows={2}
              className="rounded-xl resize-none"
            />
            <p className="text-xs text-text-secondary pl-0.5">
              Enviada quando não há horários livres para o dentista ou data selecionada.
            </p>
          </div>
        </div>

        <button
          onClick={handleSalvarMensagens}
          disabled={salvandoMsg}
          className="w-full flex items-center justify-center gap-2 py-3 bg-teal hover:bg-teal-lt text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60"
          style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
        >
          {salvandoMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Mensagens
        </button>
      </div>

      {/* ── Passo 3: Testar (só quando conectado) ────────────────────────────── */}
      {canManageConnection && (
        <AnimatePresence>
          {status === 'connected' && (
            <motion.div
              key="teste"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-surface rounded-3xl border border-border p-6 space-y-4"
            >
              <StepLabel n={3} label="Enviar Mensagem de Teste" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
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
                  <p className="text-xs text-text-secondary">País + DDD + número, sem espaços</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-text-primary">Mensagem</label>
                  <Input
                    value={testeMensagem}
                    onChange={e => setTesteMensagem(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <button
                onClick={handleEnviarTeste}
                disabled={testeLoading || !testeNumero.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
              >
                {testeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Teste
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function normalizeStatus(raw: string | undefined): WhatsAppStatus {
  if (raw === 'connected' || raw === 'open')                            return 'connected';
  if (raw === 'connecting')                                              return 'connecting';
  if (raw === 'inactive' || raw === 'close' || raw === 'disconnected') return 'disconnected';
  return 'error';
}
