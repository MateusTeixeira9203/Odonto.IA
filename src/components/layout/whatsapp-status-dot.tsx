'use client';

import { useEffect, useState } from 'react';

type ConnStatus = 'connected' | 'connecting' | 'disconnected';

interface InstanceApiResponse {
  status?: string;
}

/**
 * Pequeno indicador de conexão do WhatsApp.
 * Busca o status da instância da clínica via /api/whatsapp/instance
 * e atualiza a cada 30 segundos.
 */
export function WhatsAppStatusDot() {
  const [status, setStatus] = useState<ConnStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res  = await fetch('/api/whatsapp/instance');
        if (!res.ok) return;
        const data = await res.json() as InstanceApiResponse;
        if (cancelled) return;

        const s = data.status;
        if (s === 'connected' || s === 'open')              setStatus('connected');
        else if (s === 'connecting')                         setStatus('connecting');
        else                                                 setStatus('disconnected');
      } catch {
        // ignora erros de rede silenciosamente
      }
    };

    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!status) return null;

  const dotClass: Record<ConnStatus, string> = {
    connected:    'bg-teal',
    connecting:   'bg-teal/50 animate-pulse',
    disconnected: 'bg-border',
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass[status]}`}
      title={status === 'connected' ? 'WhatsApp Conectado' : status === 'connecting' ? 'Conectando…' : 'Desconectado'}
    />
  );
}
