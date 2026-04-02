"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { Loader2, QrCode, RefreshCw } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InstanciaWhatsApp {
  instance_name: string;
  /** status normalizado para este componente */
  status: "disconnected" | "connecting" | "connected";
  qrcode?: string;
  phone_number?: string;
}

interface InstanceApiResponse {
  status?: string;
  qrcode?: string | null;
  instanceName?: string;
  error?: string;
}

interface AbaConexaoProps {
  initialInstance: InstanciaWhatsApp | null;
}

// ─── Normalização de status ───────────────────────────────────────────────────

/** Mapeia valores da API para os 3 estados do componente. */
function normalizeStatus(raw: string | undefined): "disconnected" | "connecting" | "connected" {
  if (raw === "connected" || raw === "open") return "connected";
  if (raw === "connecting") return "connecting";
  return "disconnected";
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AbaConexao({ initialInstance }: AbaConexaoProps) {
  const [instance, setInstance] = useState<InstanciaWhatsApp | null>(initialInstance);
  const [status, setStatus]     = useState<"disconnected" | "connecting" | "connected">(
    normalizeStatus(initialInstance?.status),
  );
  const [qrCode, setQrCode]     = useState<string>(initialInstance?.qrcode ?? "");
  const [loading, setLoading]   = useState(false);

  // Polling enquanto conectando
  useEffect(() => {
    if (status !== "connecting") return;

    const interval = setInterval(async () => {
      try {
        const res  = await fetch("/api/whatsapp/instance");
        const data = await res.json() as InstanceApiResponse;

        const next = normalizeStatus(data.status);
        setStatus(next);
        if (data.qrcode) setQrCode(data.qrcode);

        if (next === "connected") {
          clearInterval(interval);
          toast.success("WhatsApp conectado com sucesso!");
        }
      } catch (err) {
        console.error("[AbaConexao] erro no polling:", err);
      }
    }, 3_000);

    return () => clearInterval(interval);
  }, [status]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/whatsapp/instance", { method: "POST" });
      const data = await res.json() as InstanceApiResponse;

      if (!res.ok) {
        toast.error(data.error ?? "Erro ao criar instância");
        return;
      }

      setInstance({ instance_name: data.instanceName ?? "", status: "connecting" });
      setStatus("connecting");
      setQrCode(data.qrcode ?? "");
      toast.success("Instância criada! Escaneie o QR Code.");
    } catch (err) {
      console.error("[AbaConexao] erro ao conectar:", err);
      toast.error("Erro ao conectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Deseja desconectar o WhatsApp?\n\nOs pacientes não receberão atendimento automático até reconectar.",
      )
    ) return;

    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/instance", { method: "DELETE" });

      if (!res.ok) {
        toast.error("Erro ao desconectar");
        return;
      }

      setInstance(null);
      setStatus("disconnected");
      setQrCode("");
      toast.success("WhatsApp desconectado");
    } catch (err) {
      console.error("[AbaConexao] erro ao desconectar:", err);
      toast.error("Erro ao desconectar WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[--color-surface] rounded-3xl border border-[--color-border] p-8 space-y-8"
    >
      {/* Status e botão principal */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2 text-[--color-text-primary]">
            Status da Conexão
          </h2>
          <StatusBadge status={status} />
        </div>

        {status === "disconnected" && (
          <Button
            onClick={handleConnect}
            disabled={loading}
            size="lg"
            className="bg-[--color-teal] hover:bg-[--color-teal-dark] text-white text-base font-semibold px-6 py-5 rounded-2xl shadow-lg shadow-[--color-teal]/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <QrCode className="w-5 h-5 mr-2" />
            )}
            Conectar WhatsApp
          </Button>
        )}

        {status === "connected" && (
          <Button
            onClick={handleDisconnect}
            disabled={loading}
            size="lg"
            variant="destructive"
            className="text-lg px-8 py-6 rounded-2xl"
          >
            {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
            Desconectar
          </Button>
        )}
      </div>

      {/* QR Code */}
      <AnimatePresence>
        {status === "connecting" && qrCode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center py-8"
          >
            <div className="bg-white p-6 rounded-2xl shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="w-64 h-64"
              />
            </div>

            <div className="mt-6 text-center max-w-md">
              <p className="text-lg font-medium text-[--color-text-primary] mb-2">
                Escaneie o QR Code
              </p>
              <p className="text-[--color-text-secondary]">
                Abra o WhatsApp no celular que será usado como atendente da clínica,
                vá em <strong>Configurações → Aparelhos conectados</strong> e escaneie este código.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Aguardando conexão...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telefone conectado */}
      {status === "connected" && instance?.phone_number && (
        <div className="bg-[--color-teal-pale] dark:bg-[--color-teal]/20 rounded-2xl p-6">
          <p className="text-[--color-text-secondary] mb-1">Número conectado:</p>
          <p className="text-2xl font-mono font-semibold text-[--color-teal-dark]">
            {instance.phone_number}
          </p>
        </div>
      )}
    </motion.div>
  );
}
