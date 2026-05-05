'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, QrCode, RefreshCw, Loader2, CheckCircle2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AnimatePresence, motion } from 'motion/react';

type ConnStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface InstanceApiResponse {
  status?: string;
  qrcode?: string | null;
  instanceName?: string;
  error?: string;
}

function normalizeStatus(raw: string | undefined): ConnStatus {
  if (raw === 'connected' || raw === 'open') return 'connected';
  if (raw === 'connecting') return 'connecting';
  return 'disconnected';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (status: ConnStatus) => void;
}

export function WhatsAppConnectSheet({ open, onOpenChange, onStatusChange }: Props) {
  const [status,  setStatus]  = useState<ConnStatus>('disconnected');
  const [qrcode,  setQrcode]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Busca status inicial ao abrir
  useEffect(() => {
    if (!open) return;
    void fetch('/api/whatsapp/instance')
      .then(r => r.json())
      .then((data: InstanceApiResponse) => {
        const s = normalizeStatus(data.status);
        setStatus(s);
        onStatusChange?.(s);
        if (data.qrcode) setQrcode(data.qrcode);
      })
      .catch(() => {});
  }, [open, onStatusChange]);

  // Polling enquanto conectando
  useEffect(() => {
    if (status !== 'connecting') return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch('/api/whatsapp/instance');
        const data = await res.json() as InstanceApiResponse;
        const next = normalizeStatus(data.status);
        setStatus(next);
        onStatusChange?.(next);
        if (data.qrcode) setQrcode(data.qrcode);
        if (next === 'connected') {
          clearInterval(interval);
          setQrcode(null);
          toast.success('WhatsApp conectado com sucesso!');
        }
      } catch { /* ignora erros de rede */ }
    }, 3_000);
    return () => clearInterval(interval);
  }, [status, onStatusChange]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/whatsapp/instance', { method: 'POST' });
      const data = await res.json() as InstanceApiResponse;
      if (!res.ok) { toast.error(data.error ?? 'Erro ao criar instância'); return; }
      setStatus('connecting');
      onStatusChange?.('connecting');
      setQrcode(data.qrcode ?? null);
      toast.success('Escaneie o QR Code para conectar.');
    } catch { toast.error('Erro ao conectar WhatsApp'); }
    finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja desconectar o WhatsApp?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/instance', { method: 'DELETE' });
      if (!res.ok) { toast.error('Erro ao desconectar'); return; }
      setStatus('disconnected');
      onStatusChange?.('disconnected');
      setQrcode(null);
      toast.success('WhatsApp desconectado');
    } catch { toast.error('Erro ao desconectar WhatsApp'); }
    finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 sm:w-96 flex flex-col gap-6 pt-8" style={{ marginLeft: 80 }}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-heading text-xl">
            <MessageCircle className="w-5 h-5 text-teal" />
            WhatsApp da Clínica
          </SheetTitle>
        </SheetHeader>

        <AnimatePresence mode="wait">

          {/* Desconectado */}
          {(status === 'disconnected' || status === 'error') && (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-6 py-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <WifiOff className="w-7 h-7 text-zinc-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">WhatsApp desconectado</p>
                <p className="text-sm text-text-secondary">Conecte para ativar o atendimento automático da clínica.</p>
              </div>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 w-full justify-center"
                style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                Conectar via QR Code
              </button>
            </motion.div>
          )}

          {/* Conectando — QR Code */}
          {status === 'connecting' && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-4"
            >
              {qrcode ? (
                <div className="bg-white p-4 rounded-2xl shadow-lg ring-4 ring-teal/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52"
                  />
                </div>
              ) : (
                <div className="w-52 h-52 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                </div>
              )}
              <div className="text-center space-y-1">
                <p className="font-semibold text-text-primary text-sm">Escaneie com o WhatsApp</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  No celular da clínica: <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong>
                </p>
              </div>
              <div className="flex items-center gap-2 text-teal/70 text-sm">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Aguardando conexão…
              </div>
            </motion.div>
          )}

          {/* Conectado */}
          {status === 'connected' && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-6 py-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">WhatsApp conectado</p>
                <p className="text-sm text-text-secondary">O bot está ativo e atendendo automaticamente.</p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl transition-all disabled:opacity-60 w-full justify-center"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                Desconectar
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
