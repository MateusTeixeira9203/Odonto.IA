'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi,
  WifiOff,
  QrCode,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle2,
  BotMessageSquare,
  Phone,
  MessageSquare,
  Save,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import type { WhatsAppStatus } from '@/services/whatsapp.service';
import type { BotMensagens } from '@/lib/whatsapp/template';
import type { DentistaRole } from '@/types/database';
import { salvarMensagensBot } from '../actions';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InstanceApiResponse {
  status?: string;
  qrcode?: string | null;
  instanceName?: string;
  error?: string;
}

interface BotPageClientProps {
  initialStatus:        WhatsAppStatus;
  initialQrcode:        string | null;
  initialInstanceName:  string | null;
  initialMensagens:     BotMensagens;
  role:                 DentistaRole;
}

// ─── Componente ───────────────────────────────────────────────────────────────

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

  // Enviar Teste
  const [testeNumero,   setTesteNumero]   = useState('');
  const [testeMensagem, setTesteMensagem] = useState('Olá! Este é um teste da DentIA. 👋');
  const [testeLoading,  setTesteLoading]  = useState(false);

  // Mensagens do bot
  const [mensagens,    setMensagens]    = useState<BotMensagens>(initialMensagens);
  const [salvandoMsg,  setSalvandoMsg]  = useState(false);

  // Polling enquanto conectando
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
      } catch {
        // ignora erros de rede no polling
      }
    }, 3_000);

    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/instance', { method: 'POST' });
      const data = await res.json() as InstanceApiResponse;

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao criar instância');
        return;
      }

      setInstanceName(data.instanceName ?? null);
      setStatus('connecting');
      setQrcode(data.qrcode ?? null);
      toast.success('Instância criada! Escaneie o QR Code.');
    } catch {
      toast.error('Erro ao conectar WhatsApp');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?\n\nOs pacientes não receberão atendimento automático até reconectar.')) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instance', { method: 'DELETE' });

      if (!res.ok) {
        toast.error('Erro ao desconectar');
        return;
      }

      setInstanceName(null);
      setStatus('disconnected');
      setQrcode(null);
      toast.success('WhatsApp desconectado');
    } catch {
      toast.error('Erro ao desconectar WhatsApp');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnviarTeste = async () => {
    if (!testeNumero.trim()) {
      toast.error('Informe o número de destino');
      return;
    }
    setTesteLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/enviar-teste', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ numero: testeNumero, mensagem: testeMensagem }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao enviar mensagem');
        return;
      }
      toast.success('Mensagem de teste enviada!');
      setTesteNumero('');
    } catch {
      toast.error('Erro ao enviar mensagem de teste');
    } finally {
      setTesteLoading(false);
    }
  };

  const handleSalvarMensagens = async () => {
    setSalvandoMsg(true);
    try {
      const resultado = await salvarMensagensBot(mensagens);
      if (resultado.ok) {
        toast.success('Mensagens salvas com sucesso!');
      } else {
        toast.error(resultado.erro ?? 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar mensagens');
    } finally {
      setSalvandoMsg(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto p-8 space-y-6"
    >
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-teal/10 flex items-center justify-center">
          <BotMessageSquare className="w-5 h-5 text-teal" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-[--color-black] dark:text-white">
            Bot WhatsApp
          </h1>
          <p className="text-sm text-[--color-gray-md]">
            {role === 'secretaria'
              ? 'Gerencie a conexão do WhatsApp da clínica'
              : 'Conexão, mensagens e testes do assistente virtual'}
          </p>
        </div>
      </div>

      {/* ── Card: Status da Conexão (secretária) ──────────────────────────────── */}
      {(role === 'admin' || role === 'secretaria') && <div className="bg-surface rounded-3xl border border-[--color-border] p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[--color-gray-md] font-mono mb-3">
              Status da Conexão
            </p>
            <StatusBadge status={status} />
          </div>

          <div className="flex gap-2">
            {(status === 'disconnected' || status === 'error') && (
              <Button
                onClick={handleConnect}
                disabled={actionLoading}
                className="bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold shadow-md shadow-teal/20"
              >
                {actionLoading
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <QrCode className="w-4 h-4 mr-2" />
                }
                Conectar WhatsApp
              </Button>
            )}
            {status === 'connected' && (
              <Button
                onClick={handleDisconnect}
                disabled={actionLoading}
                variant="destructive"
                className="rounded-xl"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <WifiOff className="w-4 h-4 mr-2" />
                Desconectar
              </Button>
            )}
          </div>
        </div>

        {/* QR Code */}
        <AnimatePresence>
          {status === 'connecting' && qrcode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-4"
            >
              <div className="bg-white p-5 rounded-2xl shadow-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56"
                />
              </div>
              <div className="mt-5 text-center max-w-sm">
                <p className="font-semibold text-[--color-black] dark:text-white mb-1">
                  Escaneie o QR Code
                </p>
                <p className="text-sm text-[--color-gray-md]">
                  Abra o WhatsApp no celular da clínica, vá em{' '}
                  <strong>Configurações → Aparelhos conectados</strong> e escaneie.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-teal/70">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Aguardando conexão...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status: Conectado */}
        <AnimatePresence>
          {status === 'connected' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-3 bg-teal-pale dark:bg-teal/15 rounded-2xl px-5 py-4"
            >
              <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />
              <div>
                <p className="font-semibold text-teal">WhatsApp Ativo</p>
                <p className="text-sm text-teal/70">
                  O bot está recebendo e respondendo mensagens automaticamente.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {instanceName && (
          <p className="text-xs font-mono text-[--color-gray-md]">
            Instância: <span className="text-[--color-black] dark:text-white">{instanceName}</span>
          </p>
        )}
      </div>}

      {/* ── Card: Enviar Teste (secretária, só quando conectado) ──────────────── */}
      {(role === 'admin' || role === 'secretaria') &&
      <AnimatePresence>
        {status === 'connected' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-surface rounded-3xl border border-[--color-border] p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-teal" />
              <h2 className="font-semibold text-[--color-black] dark:text-white">
                Enviar Mensagem de Teste
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="teste-numero" className="text-sm text-[--color-gray-md]">
                  Número de destino
                </Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--color-gray-md]" />
                  <Input
                    id="teste-numero"
                    placeholder="5511999999999"
                    value={testeNumero}
                    onChange={e => setTesteNumero(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
                <p className="text-xs text-[--color-gray-md] mt-1">
                  Código do país + DDD + número (sem espaços ou traços)
                </p>
              </div>

              <div>
                <Label htmlFor="teste-mensagem" className="text-sm text-[--color-gray-md]">
                  Mensagem
                </Label>
                <Input
                  id="teste-mensagem"
                  value={testeMensagem}
                  onChange={e => setTesteMensagem(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>

              <Button
                onClick={handleEnviarTeste}
                disabled={testeLoading || !testeNumero.trim()}
                className="w-full bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold"
              >
                {testeLoading
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Send className="w-4 h-4 mr-2" />
                }
                Enviar Teste
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>}

      {/* ── Card: Personalizar Mensagens (sempre visível) ─────────────────────── */}
      <div className="bg-surface rounded-3xl border border-[--color-border] p-6 space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal" />
          <h2 className="font-semibold text-[--color-black] dark:text-white">
            Personalizar Mensagens
          </h2>
        </div>

        {/* Dica de variáveis */}
        <div className="flex items-start gap-3 rounded-2xl bg-teal/5 dark:bg-teal/10 border border-teal/20 px-4 py-3">
          <Sparkles className="w-4 h-4 text-teal shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[--color-black] dark:text-white mb-1">
              Variáveis disponíveis
            </p>
            <p className="text-xs text-[--color-gray-md] leading-relaxed">
              Use{' '}
              <code className="font-mono bg-teal/10 text-teal px-1.5 py-0.5 rounded-md">
                {'{{nome}}'}
              </code>{' '}
              para inserir o nome do paciente e{' '}
              <code className="font-mono bg-teal/10 text-teal px-1.5 py-0.5 rounded-md">
                {'{{clinica}}'}
              </code>{' '}
              para o nome da clínica. Esses valores são substituídos automaticamente no envio.
            </p>
          </div>
        </div>

        {/* Campo: Título do Menu Principal */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[--color-black] dark:text-white">
            Título do Menu Principal
          </Label>
          <Input
            value={mensagens.titulo_menu_principal}
            onChange={e => setMensagens(prev => ({ ...prev, titulo_menu_principal: e.target.value }))}
            placeholder="Ex: Agendar Consulta"
            className="rounded-xl"
          />
          <p className="text-xs text-[--color-gray-md]">
            Texto do botão que abre a lista de dentistas no WhatsApp.
          </p>
        </div>

        {/* Campo: Mensagem para Novo Paciente */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[--color-black] dark:text-white">
            Mensagem para Novo Paciente
          </Label>
          <Textarea
            value={mensagens.msg_novo_paciente}
            onChange={e => setMensagens(prev => ({ ...prev, msg_novo_paciente: e.target.value }))}
            placeholder="Ex: Sou a assistente virtual da {{clinica}}. Como posso te ajudar?"
            rows={3}
            className="rounded-xl resize-none"
          />
          <p className="text-xs text-[--color-gray-md]">
            Exibida na primeira vez que o paciente entrar em contato.
          </p>
        </div>

        {/* Campo: Mensagem para Paciente Antigo */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-[--color-black] dark:text-white">
            Mensagem para Paciente Antigo
          </Label>
          <Textarea
            value={mensagens.msg_paciente_antigo}
            onChange={e => setMensagens(prev => ({ ...prev, msg_paciente_antigo: e.target.value }))}
            placeholder="Ex: Que bom te ver de volta, {{nome}}! Como posso te ajudar?"
            rows={3}
            className="rounded-xl resize-none"
          />
          <p className="text-xs text-[--color-gray-md]">
            Exibida quando um paciente já cadastrado envia uma nova mensagem.
          </p>
        </div>

        <Button
          onClick={handleSalvarMensagens}
          disabled={salvandoMsg}
          className="w-full bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold"
        >
          {salvandoMsg
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Save className="w-4 h-4 mr-2" />
          }
          Salvar Mensagens
        </Button>
      </div>

      {/* ── Dica quando desconectado ──────────────────────────────────────────── */}
      {(status === 'disconnected' || status === 'error') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-[--color-teal-pale] dark:bg-teal/10 border border-teal/20 px-5 py-4"
        >
          <p className="text-sm text-[--color-black] dark:text-teal-lt">
            <strong>Dica:</strong> Configure as mensagens acima antes de conectar. Em produção,
            defina{' '}
            <code className="font-mono text-xs bg-teal/10 px-1 rounded">
              NEXT_PUBLIC_APP_URL
            </code>{' '}
            com a URL pública da aplicação para que o webhook funcione corretamente.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function normalizeStatus(raw: string | undefined): WhatsAppStatus {
  if (raw === 'connected' || raw === 'open')                             return 'connected';
  if (raw === 'connecting')                                               return 'connecting';
  if (raw === 'inactive' || raw === 'close' || raw === 'disconnected')  return 'disconnected';
  return 'error';
}
